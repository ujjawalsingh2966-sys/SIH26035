import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { config } from '../src/config/env';
import { testSession } from './helpers/persistedIdentity';
import { EvaluationService, observationFingerprint } from '../src/services/EvaluationService';
import { assessProgramme } from '../src/services/ProgrammeAssessment';
import { ReportService } from '../src/services/ReportService';
import { manufacturerStore, instrumentStore, testCaseStore, observationStore, auditStore } from '../src/repositories';
import type { Instrument, Manufacturer, ObservationRecord, ObservationType, TestCase } from '../src/types/domain';
import { SimplePdfGenerator } from '../src/utils/SimplePdfGenerator';
import { convertToUnit } from '../src/calculations/unitConversion';
import Decimal from 'decimal.js';

const instrument: Instrument = {
  id: 'p0-scale', manufacturerId: 'p0-manufacturer', name: 'Integrity scale', model: 'P0', serialNumber: 'P0-001',
  isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true,
  accuracyClass: 'III', maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', hasTare: false,
  weighingUnit: 'g', n: '3000', hasAuxiliaryIndication: false, isGrading: false, softwareControlled: false,
  declaredSpecifications: { unit: 'g', maxCapacity: '15000', minCapacity: '100', e: '5', d: '5' },
};
const manufacturer: Manufacturer = { id: instrument.manufacturerId, name: 'Synthetic manufacturer', address: 'Isolated test site', identifier: 'P0-M' };
const now = '2026-10-18T10:00:00Z';
const technician = testSession('p0-tech', 'Technician', 'p0-tech@example.test');
const reviewer = testSession('p0-reviewer', 'Reviewer', 'p0-reviewer@example.test');
const core: ObservationType[] = ['WEIGHING', 'ECCENTRICITY', 'REPEATABILITY', 'ZERO_SETTING'];
const raw = { testType: 'WEIGHING' as const, load: '5000', indication: '5005', additionalWeights: '2.5', unit: 'g' as const };
function fixture() {
  const testCase: TestCase = {
    id: 'p0-case', instrumentId: instrument.id, technicianId: 'p0-tech', reviewerId: 'p0-reviewer', status: 'UNDER_REVIEW',
    revision: 0, createdAt: now, updatedAt: now,
    laboratoryConditions: { temperature: '20', humidity: '50', pressure: '1013' },
    testConfiguration: { weighing: 'NOT STARTED', eccentricity: 'NOT STARTED', repeatability: 'NOT STARTED', tare: 'NOT APPLICABLE', zeroSetting: 'NOT STARTED' },
    programmeDetermination: { standard: 'OIML R 76-1:2006', determinedBy: 'synthetic-lab-plan', determinedAt: now,
      requirements: core.map(testType => ({ testType, minimumObservations: 1 })) },
  };
  // Synthetic resolved evaluations test the completeness/aggregation contract.
  // They do not assert implemented REP/ZERO metrology. Real API evaluation of
  // those procedures remains BLOCKED, and no public API can install this plan.
  const observations: ObservationRecord[] = core.map(testType => {
    const row: ObservationRecord = { ...raw, id: `p0-${testType}`, testCaseId: testCase.id, testType, sequence: 1 };
    row.evaluation = EvaluationService.evaluateObservation(instrument, raw, true);
    row.evaluation.inputFingerprint = observationFingerprint(instrument, row, true);
    return row;
  });
  return { testCase, observations };
}
beforeEach(() => {
  manufacturerStore.clear(); instrumentStore.clear(); testCaseStore.clear(); observationStore.clear(); auditStore.clear();
  manufacturerStore.saveItem(manufacturer); instrumentStore.saveItem(instrument);
});

describe('P0 precise observation units', () => {
  it('normalizes the reproduced g/kg counterexample to the same P/E/Ec/m/MPE and PASS', () => {
    const g = EvaluationService.evaluateObservation(instrument, raw, true);
    const kg = EvaluationService.evaluateObservation(instrument, { ...raw, load: '5', indication: '5.005', additionalWeights: '0.0025', unit: 'kg' }, true);
    expect(kg.calculation).toEqual(g.calculation);
    expect(kg.rulePackage).toEqual(g.rulePackage);
    expect(kg.compliance.verdict).toBe('PASS');
    expect(kg.calculation.Ec).toEqual({ value: '5', unit: 'g' });
  });
  it.each([
    ['mg', '5000000', '5005000', '2500'], ['g', '5000', '5005', '2.5'],
    ['kg', '5', '5.005', '0.0025'], ['t', '0.005', '0.005005', '0.0000025'],
  ])('preserves equivalent physical quantities in %s', (unit, load, indication, additionalWeights) => {
    const result = EvaluationService.evaluateObservation(instrument, { ...raw, unit: unit as any, load, indication, additionalWeights }, true);
    expect(result.calculation.Ec).toEqual({ value: '5', unit: 'g' });
    expect(result.rulePackage.mpeLimit).toEqual({ value: '5', unit: 'g' });
    expect(result.compliance.verdict).toBe('PASS');
  });
  it.each([
    ['II', '5000', '0.5'], ['II', '5000.000001', '1.0'], ['II', '20000', '1.0'], ['II', '20000.000001', '1.5'],
    ['III', '500', '0.5'], ['III', '500.000001', '1.0'], ['III', '2000', '1.0'], ['III', '2000.000001', '1.5'],
    ['IIII', '50', '0.5'], ['IIII', '50.000001', '1.0'], ['IIII', '200', '1.0'], ['IIII', '200.000001', '1.5'],
  ])('selects the exact MPE band for class %s and m=%s', (accuracyClass, load, multiplier) => {
    const result = EvaluationService.evaluateObservation({ ...instrument, accuracyClass: accuracyClass as any, e: '1' },
      { ...raw, load, indication: load, additionalWeights: '0.5' }, true);
    expect(result.rulePackage.mpeMultiplier).toBe(multiplier);
    expect(result.compliance.verdict).toBe('PASS');
    const kgLoad = new Decimal(load).div(1000).toString();
    const kg = EvaluationService.evaluateObservation({ ...instrument, accuracyClass: accuracyClass as any, e: '1' },
      { ...raw, unit: 'kg', load: kgLoad, indication: kgLoad, additionalWeights: '0.0005' }, true);
    expect(kg.calculation).toEqual(result.calculation);
    expect(kg.rulePackage).toEqual(result.rulePackage);
  });
  it.each(['lb', '', 'G', 'toString', null, 123])('rejects unsupported unit %p before calculation', unit => {
    expect(() => EvaluationService.evaluateObservation(instrument, { ...raw, unit: unit as any }, true)).toThrow('Unsupported mass unit');
    expect(() => convertToUnit({ value: '1', unit: unit as any }, unit as any)).toThrow('Unsupported');
  });
  it.each(['NaN', 'Infinity', '-Infinity', '', 'bad'])('rejects non-finite/invalid observation %p', load => {
    expect(() => EvaluationService.evaluateObservation(instrument, { ...raw, load }, true)).toThrow();
  });
  it.each(['0', '-1', 'NaN', 'Infinity'])('rejects invalid instrument interval %s', e => {
    expect(() => EvaluationService.evaluateObservation({ ...instrument, e }, raw, true)).toThrow();
  });
  it('normalizes zero error too and distinguishes the exact limit from just above it', () => {
    const pass = EvaluationService.evaluateObservation(instrument, { ...raw, unit: 'kg', load: '5', indication: '5.01', additionalWeights: '0.0025', zeroError: '0.005' }, true);
    expect(pass.calculation.Ec.value).toBe('5');
    expect(pass.compliance.verdict).toBe('PASS');
    const fail = EvaluationService.evaluateObservation(instrument, { ...raw, indication: '5005.000000000001' }, true);
    expect(fail.calculation.Ec.value).toBe('5.000000000001');
    expect(fail.compliance.verdict).toBe('FAIL');
  });
  it('rejects invalid units over the real HTTP API without persisting or auditing', async () => {
    const { testCase } = fixture(); testCase.status = 'TESTING'; testCaseStore.saveItem(testCase);
    await request(app).post('/api/v1/observations').set('Authorization', `Bearer ${technician}`)
      .send({ ...raw, unit: 'lb', testCaseId: testCase.id, sequence: 1 }).expect(400);
    expect(observationStore.findAll()).toHaveLength(0); expect(auditStore.findAll()).toHaveLength(0);
  });
});

describe('P0 readable report pagination', () => {
  it('places 100 lines on two pages without overlapping rows and preserves xref offsets', () => {
    const pdf = SimplePdfGenerator.generateDocument(Array.from({ length: 100 }, (_, i) => `Measurement ${i + 1}`)).toString('latin1');
    expect(pdf).toContain('/Count 2');
    const streams = [...pdf.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(match => match[1]);
    expect(streams).toHaveLength(2);
    for (const stream of streams) {
      const positions = [...stream.matchAll(/50 (\d+) Tm/g)].map(match => match[1]);
      expect(new Set(positions).size).toBe(positions.length);
    }
    expect(pdf).toContain('(Measurement 100) Tj');
    const xref = Number(pdf.match(/startxref\n(\d+)/)![1]);
    expect(pdf.slice(xref, xref + 4)).toBe('xref');
  });
  it('wraps long completeness warnings and escapes PDF text safely', () => {
    const pdf = SimplePdfGenerator.generateDocument(['INCOMPLETE: ' + 'required '.repeat(30), '(not final) \\']).toString('latin1');
    const lines = [...pdf.matchAll(/Tm \((.*)\) Tj/g)].map(match => match[1]);
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.slice(0, -1).every(line => line.length <= 85)).toBe(true);
    expect(pdf).toContain('\\(not final\\) \\\\');
  });
});

describe('P0 programme completeness and finalization', () => {
  it('distinguishes an empty programme from PASS and requires justified N/A', () => {
    const { testCase } = fixture();
    const empty = assessProgramme(testCase, instrument, manufacturer, []);
    expect(empty).toMatchObject({ complete: false, overallVerdict: 'INCOMPLETE', observedOutcome: 'UNDETERMINED' });
    expect(empty.tests.WEIGHING.status).toBe('NOT STARTED');
    expect(empty.tests.TARE.status).toBe('NOT APPLICABLE');
    expect(assessProgramme(testCase, { ...instrument, hasTare: undefined }, manufacturer, []).tests.TARE.status).toBe('NOT STARTED');
  });
  it('treats missing saved evaluation packages as incomplete, not as an exception or PASS', () => {
    const { testCase, observations } = fixture();
    delete (observations[0].evaluation as any).rulePackage;
    expect(assessProgramme(testCase, instrument, manufacturer, observations).tests.WEIGHING.status).toBe('INCOMPLETE');
  });
  it.each(['PASS', 'FAIL'])('allows a completely determined programme with outcome %s, including a failed final report', async verdict => {
    const { testCase, observations } = fixture();
    if (verdict === 'FAIL') {
      observations[0].indication = '5010';
      observations[0].evaluation = EvaluationService.evaluateObservation(instrument, observations[0], true);
    }
    testCaseStore.saveItem(testCase); observations.forEach(row => observationStore.saveItem(row));
    const assessment = assessProgramme(testCase, instrument, manufacturer, observations);
    expect(assessment.complete).toBe(true); expect(assessment.overallVerdict).toBe(verdict);
    expect(assessment.tests.TARE).toMatchObject({ status: 'NOT APPLICABLE', reason: expect.stringContaining('hasTare=false') });
    await request(app).post(`/api/v1/test-cases/${testCase.id}/workflow/approve`).set('Authorization', `Bearer ${reviewer}`)
      .send({ expectedRevision: 0 }).expect(200);
    const report = ReportService.generateReportData(testCase.id, 'Reviewer');
    expect(report.status).toBe('FINAL'); expect(report.complianceSummary.overallVerdict).toBe(verdict);
  });
  it('never turns a single PASS row and absent programme into overall PASS or final approval', async () => {
    const { testCase, observations } = fixture(); delete testCase.programmeDetermination;
    testCaseStore.saveItem(testCase); observationStore.saveItem(observations[0]);
    const assessment = assessProgramme(testCase, instrument, manufacturer, [observations[0]]);
    expect(assessment.overallVerdict).toBe('INCOMPLETE'); expect(assessment.observedOutcome).toBe('PASS');
    expect(assessment.tests.ECCENTRICITY.status).toBe('NOT STARTED');
    await request(app).post(`/api/v1/test-cases/${testCase.id}/workflow/approve`).set('Authorization', `Bearer ${reviewer}`)
      .send({ expectedRevision: 0 }).expect(409);
    expect(testCaseStore.findById(testCase.id)?.status).toBe('UNDER_REVIEW'); expect(auditStore.findAll()).toHaveLength(0);
  });
  it.each(['BLOCKED', 'INCONCLUSIVE'])('does not accept a %s saved evaluation as complete', verdict => {
    const { testCase, observations } = fixture(); observations[0].evaluation!.compliance.verdict = verdict as any;
    expect(assessProgramme(testCase, instrument, manufacturer, observations).overallVerdict).toBe('INCOMPLETE');
  });
  it('requires real sampling, rejects client-style COMPLETE/N/A flags, and checks evaluation freshness', () => {
    const { testCase, observations } = fixture();
    testCase.testConfiguration.repeatability = 'NOT APPLICABLE';
    expect(assessProgramme(testCase, instrument, manufacturer, observations.filter(row => row.testType !== 'REPEATABILITY')).complete).toBe(false);
    testCase.programmeDetermination!.requirements[0].minimumObservations = 2;
    expect(assessProgramme(testCase, instrument, manufacturer, observations).tests.WEIGHING.status).toBe('INCOMPLETE');
    testCase.programmeDetermination!.requirements[0].minimumObservations = 1;
    observations[0].load = '6000';
    expect(assessProgramme(testCase, instrument, manufacturer, observations).complete).toBe(false);
  });
  it('keeps legacy approved records unchanged while downgrading newly generated incomplete output', () => {
    const { testCase, observations } = fixture(); testCase.status = 'APPROVED'; delete testCase.programmeDetermination;
    delete observations[0].evaluation!.calculationVersion;
    testCaseStore.saveItem(testCase); observationStore.saveItem(observations[0]);
    const before = JSON.stringify({ testCase, observations });
    const report = ReportService.generateReportData(testCase.id, 'Reviewer');
    expect(report.status).toBe('PROTOTYPE'); expect(report.complianceSummary.overallVerdict).toBe('INCOMPLETE');
    expect(JSON.stringify({ testCase, observations })).toBe(before);
    expect(ReportService.generateHtmlReport(testCase.id, 'Reviewer')).toContain('not a final compliance report');
    expect(ReportService.generatePdfReport(testCase.id, 'Reviewer').toString('latin1')).toContain('Overall: INCOMPLETE');
  });
  it.each(['manufacturer', 'instrument', 'conditions'])('requires complete %s information', missing => {
    const { testCase, observations } = fixture();
    if (missing === 'conditions') testCase.laboratoryConditions!.humidity = '101';
    expect(assessProgramme(testCase, missing === 'instrument' ? undefined : instrument,
      missing === 'manufacturer' ? undefined : manufacturer, observations).complete).toBe(false);
  });
  it('does not accept client-supplied determination or completion at case creation', async () => {
    const { testCase } = fixture();
    const response = await request(app).post('/api/v1/test-cases').set('Authorization', `Bearer ${technician}`)
      .send({ instrumentId: instrument.id, programmeDetermination: testCase.programmeDetermination,
        testConfiguration: { weighing: 'COMPLETE', repeatability: 'NOT APPLICABLE' } }).expect(201);
    expect(response.body.data.programmeDetermination).toBeUndefined();
    expect(response.body.data.testConfiguration.repeatability).toBe('NOT STARTED');
  });
});
