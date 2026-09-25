import request from 'supertest';
import app from '../../src/app';
import { testCaseStore, instrumentStore, manufacturerStore, observationStore } from '../../src/repositories';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config/env';

let server: any;

const technicianToken = jwt.sign({ id: 'tech-eval-1', role: 'Technician', email: 'tech-eval@example.com' }, config.jwtSecret);

beforeAll((done) => {
  server = app.listen(0, () => done());
});

afterAll((done) => {
  server.close(done);
});

/**
 * P0.1: Wires CalculationEngine -> RuleEngine -> ComplianceEngine into the live app.
 * These tests drive the real HTTP API (not the engines directly) to prove an observation
 * entered through the API produces a real, persisted PASS/FAIL/BLOCKED verdict, and that
 * the review workflow and report now depend on that persisted result.
 */
describe('Live Evaluation Pipeline Integration (Calculation -> Rule -> Compliance)', () => {
  let manufacturerId: string;

  beforeEach(() => {
    testCaseStore.clear();
    instrumentStore.clear();
    manufacturerStore.clear();
    observationStore.clear();

    manufacturerStore.saveItem({
      id: 'mfg-eval',
      name: 'Eval Manufacturer',
      address: '1 Eval St',
      identifier: 'EVAL-01'
    });
    manufacturerId = 'mfg-eval';
  });

  async function createInScopeInstrument(overrides: Record<string, any> = {}) {
    const res = await request(server)
      .post('/api/v1/instruments')
      .set('Authorization', `Bearer ${technicianToken}`)
      .send({
        manufacturerId,
        name: 'Eval Scale',
        model: 'ES-100',
        serialNumber: 'SN-EVAL-1',
        isWeighing: true,
        isManual: true,
        isElectronic: true,
        isSingleRange: true,
        accuracyClass: 'III',
        maxCapacity: '15000',
        minCapacity: '100',
        e: '5',
        d: '5',
        hasTare: true,
        ...overrides
      })
      .expect(201);
    return res.body.data;
  }

  async function createTestCaseInTesting(instrumentId: string) {
    const createRes = await request(server)
      .post('/api/v1/test-cases')
      .set('Authorization', `Bearer ${technicianToken}`)
      .send({ instrumentId })
      .expect(201);
    const testCaseId = createRes.body.data.id;

    await request(server)
      .put(`/api/v1/test-cases/${testCaseId}/status`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .send({ status: 'TESTING' })
      .expect(200);

    return testCaseId;
  }

  it('PASS: an in-tolerance observation persists a real PASS verdict and explainability trace', async () => {
    const instrument = await createInScopeInstrument();
    const testCaseId = await createTestCaseInTesting(instrument.id);

    // Same values as GT-01-PASS-III-NOR: Ec=4.5g, MPE(Class III, m=1000)=5g -> PASS
    const obsRes = await request(server)
      .post('/api/v1/observations')
      .set('Authorization', `Bearer ${technicianToken}`)
      .send({ testCaseId, testType: 'WEIGHING', sequence: 1, load: '5000', indication: '5005', additionalWeights: '3' })
      .expect(201);

    const observation = obsRes.body.data;
    expect(observation.evaluation.compliance.verdict).toBe('PASS');
    expect(observation.evaluation.calculation.Ec.value).toBe('4.5');
    expect(observation.evaluation.calculation.m).toBe('1000');
    expect(observation.evaluation.rulePackage.mpeLimit?.value).toBe('5');
    expect(observation.evaluation.rulePackage.traceability?.ruleVersion).toBe('OIML-R76-1-2006-CORE-V1.0.0-MVP');
    expect(observation.evaluation.compliance.trace?.resolutionComparison).toContain('<=');

    // Confirm it was actually persisted, not just echoed in the response
    const fetchRes = await request(server)
      .get(`/api/v1/observations/${testCaseId}`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .expect(200);
    expect(fetchRes.body.data[0].evaluation.compliance.verdict).toBe('PASS');
  });

  it('FAIL: an out-of-tolerance observation persists a real FAIL verdict and can still be submitted for review', async () => {
    const instrument = await createInScopeInstrument();
    const testCaseId = await createTestCaseInTesting(instrument.id);

    // Same values as GT-02-FAIL-III-NOR: Ec=10.5g > MPE 5g -> FAIL
    const obsRes = await request(server)
      .post('/api/v1/observations')
      .set('Authorization', `Bearer ${technicianToken}`)
      .send({ testCaseId, testType: 'WEIGHING', sequence: 1, load: '5000', indication: '5010', additionalWeights: '2' })
      .expect(201);

    expect(obsRes.body.data.evaluation.compliance.verdict).toBe('FAIL');
    expect(obsRes.body.data.evaluation.compliance.trace?.resolutionComparison).toContain('>');

    // A FAIL is a *completed* evaluation - the completeness gate cares whether evaluation
    // ran, not whether the instrument passed, so a Reviewer must still be able to see it.
    const submitRes = await request(server)
      .post(`/api/v1/test-cases/${testCaseId}/workflow/submit`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .expect(200);
    expect(submitRes.body.data.status).toBe('READY_FOR_REVIEW');
  });

  it('BLOCKED: an MVP-out-of-scope test type persists a BLOCKED verdict via the live pipeline', async () => {
    const instrument = await createInScopeInstrument();
    const testCaseId = await createTestCaseInTesting(instrument.id);

    // REPEATABILITY is a valid persistence-layer ObservationType but the Rule Engine's
    // MVP scope gate blocks it (rules/engine.ts checkTestScope only permits WEIGH/ECC/TARE).
    const obsRes = await request(server)
      .post('/api/v1/observations')
      .set('Authorization', `Bearer ${technicianToken}`)
      .send({ testCaseId, testType: 'REPEATABILITY', sequence: 1, load: '5000', indication: '5005', additionalWeights: '3' })
      .expect(201);

    expect(obsRes.body.data.evaluation.rulePackage.status).toBe('BLOCKED');
    expect(obsRes.body.data.evaluation.compliance.verdict).toBe('BLOCKED');
    expect(obsRes.body.data.evaluation.compliance.trace).toBeUndefined();
  });

  it('rejects an observation outright when the instrument lacks metrological parameters needed to evaluate', async () => {
    // accuracyClass/e are optional on Instrument until the classification gate is completed
    // (types/domain.ts) - submitting against such an instrument must fail the request, not
    // silently persist an observation with no evaluation.
    const instrument = await createInScopeInstrument({ accuracyClass: undefined, e: undefined });
    const testCaseId = await createTestCaseInTesting(instrument.id);

    const obsRes = await request(server)
      .post('/api/v1/observations')
      .set('Authorization', `Bearer ${technicianToken}`)
      .send({ testCaseId, testType: 'WEIGHING', sequence: 1, load: '5000', indication: '5005', additionalWeights: '3' })
      .expect(400);
    expect(obsRes.body.error).toContain('Evaluation failed');

    const fetchRes = await request(server)
      .get(`/api/v1/observations/${testCaseId}`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .expect(200);
    expect(fetchRes.body.data.length).toBe(0);
  });

  it('rejects submission for review when zero observations have been recorded', async () => {
    const instrument = await createInScopeInstrument();
    const testCaseId = await createTestCaseInTesting(instrument.id);

    const submitRes = await request(server)
      .post(`/api/v1/test-cases/${testCaseId}/workflow/submit`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .expect(400);
    expect(submitRes.body.error).toContain('no observations have been recorded');
  });

  it('rejects submission for review when a recorded observation has not completed evaluation', async () => {
    const instrument = await createInScopeInstrument();
    const testCaseId = await createTestCaseInTesting(instrument.id);

    // Directly persists an observation bypassing the route's evaluation step, simulating a
    // data state where evaluation never completed - the gate must catch this defensively,
    // not just rely on the route always calling EvaluationService.
    observationStore.saveItem({
      id: 'obs-unevaluated',
      testCaseId,
      testType: 'WEIGHING',
      sequence: 1,
      load: '5000',
      indication: '5005',
      additionalWeights: '3'
    });

    const submitRes = await request(server)
      .post(`/api/v1/test-cases/${testCaseId}/workflow/submit`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .expect(400);
    expect(submitRes.body.error).toContain('not completed evaluation');
  });

  it('full flow: observation input -> Calculation -> Rule -> Compliance -> persisted verdict -> approved report', async () => {
    const instrument = await createInScopeInstrument();
    const testCaseId = await createTestCaseInTesting(instrument.id);

    await request(server)
      .post('/api/v1/observations')
      .set('Authorization', `Bearer ${technicianToken}`)
      .send({ testCaseId, testType: 'WEIGHING', sequence: 1, load: '5000', indication: '5005', additionalWeights: '3' })
      .expect(201);

    await request(server)
      .post(`/api/v1/test-cases/${testCaseId}/workflow/submit`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .expect(200);

    const reviewerToken = jwt.sign({ id: 'rev-eval-1', role: 'Reviewer', email: 'rev-eval@example.com' }, config.jwtSecret);

    await request(server)
      .post(`/api/v1/test-cases/${testCaseId}/workflow/start-review`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);

    await request(server)
      .post(`/api/v1/test-cases/${testCaseId}/workflow/approve`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);

    // The report's compliance summary now reflects the real, persisted Compliance Engine
    // verdict - not the previously hardcoded 'APPROVED' literal.
    const reportRes = await request(server)
      .get(`/api/v1/reports/${testCaseId}/data`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);

    expect(reportRes.body.data.complianceSummary.overallVerdict).toBe('PASS');
    expect(reportRes.body.data.complianceSummary.weighing).toBe('PASS');
    expect(reportRes.body.data.meta.ruleEngineVersion).toBe('OIML-R76-1-2006-CORE-V1.0.0-MVP');
  });
});
