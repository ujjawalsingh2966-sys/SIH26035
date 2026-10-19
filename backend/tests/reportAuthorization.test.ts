import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { config } from '../src/config/env';
import { testSession } from './helpers/persistedIdentity';
import { auditStore, instrumentStore, observationStore, testCaseStore } from '../src/repositories';
import { JsonStore } from '../src/repositories/JsonStore';
import { EvaluationService } from '../src/services/EvaluationService';
import { ReportService } from '../src/services/ReportService';
import { AuditRecord, ObservationRecord, TestCaseStatus } from '../src/types/domain';

const token = (id: string, role: string, secret = config.jwtSecret) =>
  testSession(id, role, `${id}@example.com`, secret);
const owner = token('report-owner', 'Technician');
const other = token('report-other', 'Technician');
const reviewer = token('report-reviewer', 'Reviewer');
const administrator = token('report-administrator', 'Administrator');
const testCaseId = 'protected-report-case';
const model = 'Private report model';
const representations = ['data', 'html', 'pdf'] as const;
type Representation = typeof representations[number];
let generators: jest.SpyInstance[];

function getReport(representation: Representation, auth?: string, id = testCaseId, head = false) {
  const path = `/api/v1/reports/${id}/${representation}`;
  const call = head ? request(app).head(path) : request(app).get(path);
  return auth ? call.set('Authorization', `Bearer ${auth}`) : call;
}

async function expectRejected(representation: Representation, auth: string | undefined, status: number, head = false, id = testCaseId) {
  jest.clearAllMocks();
  const beforeAudit = auditStore.findAll();
  const response = await getReport(representation, auth, id, head).expect(status);
  expect(response.headers['content-type']).toMatch(/application\/json/);
  expect(response.headers['content-disposition']).toBeUndefined();
  if (!head) {
    expect(response.body).toEqual({ success: false, error: expect.any(String) });
    expect(response.text).not.toContain(model);
    expect(response.text).not.toContain('protected-observation');
    expect(response.text).not.toContain('%PDF-');
  }
  for (const generator of generators) expect(generator).not.toHaveBeenCalled();
  expect(auditStore.findAll()).toEqual(beforeAudit);
  expect(new JsonStore<AuditRecord>('audit.json').findAll()).toEqual(beforeAudit);
}

beforeEach(() => {
  // JsonStore selects fresh OS temporary storage under Jest, never project records.
  testCaseStore.clear();
  instrumentStore.clear();
  observationStore.clear();
  auditStore.clear();
  const instrument = instrumentStore.saveItem({
    id: 'protected-instrument', manufacturerId: 'test-manufacturer', name: 'Report Scale', model,
    serialNumber: 'REPORT-SYNTHETIC', isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true,
    accuracyClass: 'III', maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', hasTare: true
  });
  testCaseStore.saveItem({
    id: testCaseId, instrumentId: instrument.id, technicianId: 'report-owner', reviewerId: 'report-reviewer',
    status: 'APPROVED', revision: 4, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    laboratoryConditions: { temperature: '21', humidity: '50', pressure: '1013' },
    testConfiguration: {
      weighing: 'COMPLETE', eccentricity: 'NOT STARTED', repeatability: 'NOT STARTED',
      tare: 'NOT STARTED', zeroSetting: 'NOT STARTED'
    }
  });
  const observation: ObservationRecord = {
    id: 'protected-observation', testCaseId, testType: 'WEIGHING', sequence: 1,
    load: '5000', indication: '5000', additionalWeights: '2.5', zeroError: '0', unit: 'g'
  };
  observation.evaluation = EvaluationService.evaluateObservation(instrument, observation, true);
  observationStore.saveItem(observation);
  // Spies call the real generators: successful HTTP responses are never mocked.
  generators = [
    jest.spyOn(ReportService, 'generateReportData'),
    jest.spyOn(ReportService, 'generateHtmlReport'),
    jest.spyOn(ReportService, 'generatePdfReport')
  ];
});

afterEach(() => jest.restoreAllMocks());

describe.each(representations)('Laboratory report authorization: %s', representation => {
  it.each([
    ['owning technician', owner, 'Technician'],
    ['reviewer', reviewer, 'Reviewer'],
    ['administrator', administrator, 'Administrator']
  ])('allows the %s to retrieve the real approved report', async (_label, auth, role) => {
    const response = await getReport(representation, auth).expect(200);
    if (representation === 'data') {
      expect(response.body.data.testDetails.technicianId).toBe('report-owner');
      expect(response.body.data.instrumentDetails.model).toBe(model);
      expect(response.body.data.meta.generatedBy).toBe(role);
      expect(response.body.data.observationEvaluations[0]).toMatchObject({
        observationId: 'protected-observation', Ec: { value: '0', unit: 'g' }, verdict: 'PASS'
      });
      expect(response.body.data.meta.cryptographicSeal).toMatch(/^[a-f0-9]{64}$/);
    } else if (representation === 'html') {
      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain(model);
      expect(response.text).toContain(testCaseId);
    } else {
      expect(response.headers['content-type']).toMatch(/application\/pdf/);
      expect(response.headers['content-disposition']).toContain(`report-${testCaseId}.pdf`);
      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect(response.body.toString('utf8')).toContain('%PDF-');
      expect(response.body.toString('utf8')).toContain(testCaseId);
    }
    const audit = auditStore.findAll();
    expect(audit).toHaveLength(representation === 'data' ? 0 : 1);
    if (representation !== 'data') {
      expect(audit[0]).toMatchObject({ testCaseId, action: 'REPORT_GENERATED', actorRole: role });
    }
  });

  it('denies another technician before generating approved report content or recording an artifact', async () => {
    await expectRejected(representation, other, 403);
  });

  it.each([
    ['missing authentication', undefined, 401],
    ['invalid authentication', token('report-owner', 'Technician', 'invalid-report-test-secret'), 401],
    ['unsupported role', token('report-outsider', 'Applicant'), 403]
  ] as const)('rejects %s before report generation', async (_label, auth, status) => {
    await expectRejected(representation, auth, status);
  });

  it.each(['DRAFT', 'TESTING', 'READY_FOR_REVIEW', 'UNDER_REVIEW', 'RETURNED_FOR_CORRECTION'] as TestCaseStatus[])(
    'checks record access before the existing final-report gate in %s', async status => {
      testCaseStore.saveItem({ ...testCaseStore.findById(testCaseId)!, status });
      await expectRejected(representation, other, 403);
      for (const auth of [owner, administrator]) {
        const response = await getReport(representation, auth).expect(400);
        expect(response.body.error).toBe('Final test reports can only be generated from test cases in APPROVED status');
      }
      if (status === 'DRAFT' || status === 'TESTING') {
        await expectRejected(representation, reviewer, 403);
      } else {
        const response = await getReport(representation, reviewer).expect(400);
        expect(response.body.error).toBe('Final test reports can only be generated from test cases in APPROVED status');
      }
      expect(auditStore.findAll()).toEqual([]);
    }
  );

  it('also enforces authorization for implicit HEAD requests', async () => {
    await expectRejected(representation, other, 403, true);
    await expectRejected(representation, undefined, 401, true);
  });

  it('returns 404 without generation for a missing test case', async () => {
    await expectRejected(representation, owner, 404, false, 'missing-report-case');
  });
});

it('does not expose a generated PDF through direct file paths', async () => {
  await getReport('pdf', owner).expect(200);
  const beforeAudit = auditStore.findAll();
  jest.clearAllMocks();
  const fileName = `report-${testCaseId}.pdf`;
  for (const path of [
    `/reports/${fileName}`, `/uploads/reports/${fileName}`, `/data/${fileName}`,
    `/public/reports/${fileName}`, `/api/v1/reports/${fileName}`
  ]) {
    for (const auth of [owner, other]) {
      const response = await request(app).get(path).set('Authorization', `Bearer ${auth}`).expect(404);
      expect(response.body).toEqual({ success: false, error: expect.any(String) });
      expect(response.headers['content-disposition']).toBeUndefined();
    }
  }
  for (const generator of generators) expect(generator).not.toHaveBeenCalled();
  expect(auditStore.findAll()).toEqual(beforeAudit);
});

it('keeps the repository compliance-summary entry point restricted to authorized records', async () => {
  const response = await request(app).get(`/api/v1/repository/records/${testCaseId}`)
    .set('Authorization', `Bearer ${owner}`).expect(200);
    expect(response.body.data.complianceSummary.overallVerdict).toBe('INCOMPLETE');
    expect(response.body.data.programme.observedOutcome).toBe('PASS');
  jest.clearAllMocks();
  const denied = await request(app).get(`/api/v1/repository/records/${testCaseId}`)
    .set('Authorization', `Bearer ${other}`).expect(403);
  expect(denied.body).toEqual({ success: false, error: expect.any(String) });
  for (const generator of generators) expect(generator).not.toHaveBeenCalled();
  expect(auditStore.findAll()).toEqual([]);
});
