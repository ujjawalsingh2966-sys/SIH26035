import { clearRepository } from '../helpers/persistenceFixtures';
import request from 'supertest';
import { developmentStaffPassword, provisionLegacyTestStaff } from '../helpers/developmentStaffPassword';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import { config } from '../../src/config/env';
import { testSession } from '../helpers/persistedIdentity';
import { testCaseStore, instrumentStore, observationStore, auditStore } from '../../src/repositories';
import { AuditService } from '../../src/services/AuditService';
import { AuditRecord, TestCaseStatus } from '../../src/types/domain';
import { JsonStore } from '../../src/repositories/JsonStore';

const token = testSession;
function checked(response: request.Response, status: number) {
  expect(response.status).toBe(status);
  return response;
}
let tech: string;
beforeAll(async () => {
tech = (await token('tech-workflow', 'Technician'));
});
let otherTech: string;
beforeAll(async () => {
otherTech = (await token('tech-other', 'Technician'));
});
let reviewer: string;
beforeAll(async () => {
reviewer = (await token('reviewer-workflow', 'Reviewer'));
});
let otherReviewer: string;
beforeAll(async () => {
otherReviewer = (await token('reviewer-other', 'Reviewer'));
});
let admin: string;
beforeAll(async () => {
admin = (await token('admin-workflow', 'Administrator'));
});
const raw = { load: '5000', indication: '5005', additionalWeights: '3', unit: 'g', zeroError: '0' };
let testCaseId: string;

async function revision() { return (await testCaseStore.findById(testCaseId))!.revision ?? 0; }
async function workflow(action: string, auth: string, extra: object = {}) {
  return request(app).post(`/api/v1/test-cases/${testCaseId}/workflow/${action}`)
    .set('Authorization', `Bearer ${auth}`).send({ expectedRevision: (await revision()), ...extra });
}
async function resume(auth = tech) {
  return request(app).put(`/api/v1/test-cases/${testCaseId}/status`)
    .set('Authorization', `Bearer ${auth}`).send({ status: 'TESTING', expectedRevision: (await revision()) });
}
function observe(auth = tech) {
  return request(app).post('/api/v1/observations').set('Authorization', `Bearer ${auth}`)
    .send({ testCaseId, testType: 'WEIGHING', sequence: 1, ...raw });
}
async function setState(status: TestCaseStatus, reviewerId = 'reviewer-workflow') {
  const record = (await testCaseStore.findById(testCaseId))!;
  (await testCaseStore.saveItem({ ...record, status, reviewerId }));
}

beforeEach(async () => {
  // JsonStore selects a fresh OS temp directory under NODE_ENV=test.
  (await clearRepository(testCaseStore)); (await clearRepository(instrumentStore)); (await clearRepository(observationStore)); (await clearRepository(auditStore));
  (await instrumentStore.saveItem({
    id: 'instrument-workflow', manufacturerId: 'test-manufacturer', name: 'Workflow Scale', model: 'WS-1', serialNumber: 'WF-01',
    isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true,
    accuracyClass: 'III', maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', hasTare: true
  }));
  testCaseId = 'test-workflow';
  (await testCaseStore.saveItem({
    id: testCaseId, instrumentId: 'instrument-workflow', technicianId: 'tech-workflow', status: 'DRAFT', revision: 0,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    testConfiguration: { weighing: 'NOT STARTED', eccentricity: 'NOT STARTED', repeatability: 'NOT STARTED', tare: 'NOT STARTED', zeroSetting: 'NOT STARTED' }
  }));
});

describe('Laboratory correction and review over the real HTTP API', () => {
  it.each([['Reviewer', () => reviewer], ['Administrator', () => admin]])('completes two correction cycles but blocks incomplete final approval as %s', async (_role, authFixture) => {
    const auth = authFixture();
    await checked((await resume()), 200);
    const original = (await observe().expect(201)).body.data;
    expect(original.evaluation.calculation.Ec.value).toBe('4.5');
    expect(original.evaluation.rulePackage.mpeLimit.value).toBe('5');
    await checked((await workflow('submit', tech)), 200);
    const firstSubmittedRevision = (await revision());
    await checked((await workflow('start-review', auth)), 200);
    await checked((await workflow('return', auth, { reason: '  Correct the indication  ' })), 200);
    expect((await testCaseStore.findById(testCaseId))!.reviewNotes).toBe('Correct the indication');

    // RETURNED alone never unlocks corrections or permits a direct resubmission.
    await checked((await workflow('submit', tech)), 409);
    await request(app).put(`/api/v1/observations/${original.id}`).set('Authorization', `Bearer ${tech}`).send(raw).expect(403);
    await checked((await resume()), 200);
    await request(app).put(`/api/v1/test-cases/${testCaseId}/laboratory-conditions`).set('Authorization', `Bearer ${tech}`)
      .send({ temperature: '21', humidity: '50', pressure: '1013' }).expect(200);
    const corrected = (await request(app).put(`/api/v1/observations/${original.id}`).set('Authorization', `Bearer ${tech}`)
      .send({ ...raw, indication: '5000', additionalWeights: '2.5' }).expect(200)).body.data;
    expect(corrected.evaluation.calculation.Ec.value).toBe('0');
    expect(corrected.evaluation.compliance.verdict).toBe('PASS');
    const update = (await AuditService.getHistoryForTest(testCaseId)).find(event => event.action === 'OBSERVATION_UPDATED')!;
    expect(update.metadata!.previous).toEqual(original);
    expect(update.metadata!.updated).toEqual(corrected);

    await checked((await workflow('submit', tech)), 200);
    // Same state in a later cycle: a cached transition must still be rejected.
    await checked((await workflow('start-review', auth, { expectedRevision: firstSubmittedRevision })), 409);
    await checked((await workflow('start-review', auth)), 200);
    await checked((await workflow('return', auth, { reason: 'Replace the setup observation' })), 200);
    await checked((await resume()), 200);
    await request(app).delete(`/api/v1/observations/${original.id}`).set('Authorization', `Bearer ${tech}`).expect(200);
    await request(app).delete(`/api/v1/observations/${original.id}`).set('Authorization', `Bearer ${tech}`).expect(404);
    const deletion = (await AuditService.getHistoryForTest(testCaseId)).find(event => event.action === 'OBSERVATION_DELETED')!;
    expect(deletion.metadata!.previous).toEqual(corrected);
    expect((await observationStore.findById(original.id))).toBeUndefined();
    await checked((await workflow('submit', tech)), 400); // Existing no-observations gate survives deletion.
    await observe().expect(201);
    await checked((await workflow('submit', tech)), 200);
    await checked((await workflow('start-review', auth)), 200);
    const rejected = await checked((await workflow('approve', auth)), 409);
    expect(rejected.body.error).toContain('INCOMPLETE');
    expect((await testCaseStore.findById(testCaseId))!.status).toBe('UNDER_REVIEW');
    expect((await testCaseStore.findById(testCaseId))!.approvalDate).toBeUndefined();
    const history = (await request(app).get(`/api/v1/test-cases/${testCaseId}/audit`).set('Authorization', `Bearer ${tech}`).expect(200)).body.data;
    expect(history.filter((event: any) => event.action === 'RETURN_FOR_CORRECTION').map((event: any) => event.metadata.reason))
      .toEqual(['Correct the indication', 'Replace the setup observation']);
    expect(history.filter((event: any) => event.action === 'START_TESTING')).toHaveLength(3);
    expect(history.filter((event: any) => event.action === 'SUBMIT_FOR_REVIEW')).toHaveLength(3);
    expect(history.every((event: any) => event.actorId && event.actorRole && event.timestamp)).toBe(true);
    expect(new JsonStore<AuditRecord>('audit.json').findAll().filter(event => event.testCaseId === testCaseId)).toEqual(history);
    await checked((await workflow('approve', auth)), 409);
    expect((await AuditService.getHistoryForTest(testCaseId))).toHaveLength(history.length);

    const details = (await request(app).get(`/api/v1/repository/records/${testCaseId}`).set('Authorization', `Bearer ${auth}`).expect(200)).body.data;
    expect(details.instrument.name).toBe('Workflow Scale');
    expect(details.testCase.laboratoryConditions.temperature).toBe('21');
    expect(details.history).toHaveLength(history.length);
    expect(details.programme.overallVerdict).toBe('INCOMPLETE');
    await request(app).get(`/api/v1/reports/${testCaseId}/data`).set('Authorization', `Bearer ${auth}`).expect(400);
  });

  it('does not change an observation or audit trail when correction evaluation fails', async () => {
    await checked((await resume()), 200);
    const original = (await observe().expect(201)).body.data;
    const before = (await AuditService.getHistoryForTest(testCaseId));
    await request(app).put(`/api/v1/observations/${original.id}`).set('Authorization', `Bearer ${tech}`)
      .send({ ...raw, load: 'not-a-number' }).expect(400);
    expect((await observationStore.findById(original.id))).toEqual(original);
    expect((await AuditService.getHistoryForTest(testCaseId))).toEqual(before);
  });

  it.each(['READY_FOR_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'RETURNED_FOR_CORRECTION'] as TestCaseStatus[])('locks all technician data mutations in %s', async state => {
    await checked((await resume()), 200);
    const observation = (await observe().expect(201)).body.data;
    (await setState(state));
    const before = JSON.stringify({ tc: (await testCaseStore.findById(testCaseId)), observations: (await observationStore.findAll()), audit: (await auditStore.findAll()) });
    await observe().expect(403);
    await request(app).put(`/api/v1/observations/${observation.id}`).set('Authorization', `Bearer ${tech}`).send(raw).expect(403);
    await request(app).delete(`/api/v1/observations/${observation.id}`).set('Authorization', `Bearer ${tech}`).expect(403);
    await request(app).put(`/api/v1/test-cases/${testCaseId}/laboratory-conditions`).set('Authorization', `Bearer ${tech}`)
      .send({ temperature: '25', humidity: '60', pressure: '1013' }).expect(403);
    await request(app).post('/api/v1/evidence').set('Authorization', `Bearer ${tech}`)
      .send({ testCaseId, testType: 'GENERAL', description: 'Setup', fileName: 'setup.txt', mimeType: 'text/plain', sizeBytes: 4, fileData: 'dGVzdA==' }).expect(403);
    expect(JSON.stringify({ tc: (await testCaseStore.findById(testCaseId)), observations: (await observationStore.findAll()), audit: (await auditStore.findAll()) })).toBe(before);
    if (state !== 'RETURNED_FOR_CORRECTION') await checked((await resume()), 409);
  });

  it('rejects cross-record reads, writes and transitions by another technician', async () => {
    await checked((await resume()), 200);
    const observation = (await observe().expect(201)).body.data;
    for (const path of [`/test-cases/${testCaseId}/audit`, `/observations/${testCaseId}`, `/evidence/${testCaseId}`, `/repository/records/${testCaseId}`]) {
      await request(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${otherTech}`).expect(403);
    }
    await observe(otherTech).expect(403);
    await request(app).put(`/api/v1/observations/${observation.id}`).set('Authorization', `Bearer ${otherTech}`).send(raw).expect(403);
    await request(app).delete(`/api/v1/observations/${observation.id}`).set('Authorization', `Bearer ${otherTech}`).expect(403);
    await checked((await workflow('submit', otherTech)), 403);
    await checked((await resume(otherTech)), 403);
    const list = await request(app).get('/api/v1/test-cases').set('Authorization', `Bearer ${otherTech}`).expect(200);
    expect(list.body.data).toEqual([]);
  });

  it('reuses record access rules for reviewer queues and detail endpoints', async () => {
    for (const state of ['DRAFT', 'TESTING'] as TestCaseStatus[]) {
      (await setState(state));
      expect((await request(app).get('/api/v1/test-cases').set('Authorization', `Bearer ${reviewer}`).expect(200)).body.data).toEqual([]);
      for (const endpoint of [`/observations/${testCaseId}`, `/evidence/${testCaseId}`, `/test-cases/${testCaseId}/audit`]) {
        await request(app).get(`/api/v1${endpoint}`).set('Authorization', `Bearer ${reviewer}`).expect(403);
      }
    }
    (await setState('READY_FOR_REVIEW'));
    expect((await request(app).get('/api/v1/test-cases').set('Authorization', `Bearer ${reviewer}`).expect(200)).body.data).toHaveLength(1);
    await request(app).get('/api/v1/test-cases').set('Authorization', `Bearer ${(await token('outsider', 'Applicant'))}`).expect(403);
    await request(app).get('/api/v1/test-cases').expect(401);
  });

  it.each([() => reviewer, () => admin])('requires reviewer assignment and never allows an administrator override', async authFixture => {
    const auth = authFixture();
    (await setState('UNDER_REVIEW', 'reviewer-other'));
    await checked((await workflow('approve', auth)), 403);
    await checked((await workflow('return', auth, { reason: 'Correction' })), 403);
    expect((await AuditService.getHistoryForTest(testCaseId))).toHaveLength(0);
  });

  it.each(['Reviewer', 'Administrator'])('rejects self-review and self-approval for %s even on legacy assignments', async role => {
    const self = (await token('tech-workflow', role));
    (await setState('READY_FOR_REVIEW'));
    await checked((await workflow('start-review', self)), 403);
    (await setState('UNDER_REVIEW', 'tech-workflow'));
    await checked((await workflow('approve', self)), 403);
    await checked((await workflow('return', self, { reason: 'Correction' })), 403);
  });

  it.each(['start-review', 'return', 'approve'])('forbids technician action %s', async action => {
    (await setState('UNDER_REVIEW'));
    await checked((await workflow(action, tech, { reason: 'Correction' })), 403);
  });

  it.each([() => reviewer, () => admin])('keeps review roles from changing raw data or submitting as technician', async authFixture => {
    const auth = authFixture();
    await checked((await resume()), 200);
    const observation = (await observe().expect(201)).body.data;
    (await setState('UNDER_REVIEW'));
    await observe(auth).expect(403);
    await request(app).put(`/api/v1/observations/${observation.id}`).set('Authorization', `Bearer ${auth}`).send(raw).expect(403);
    await request(app).delete(`/api/v1/observations/${observation.id}`).set('Authorization', `Bearer ${auth}`).expect(403);
    await checked((await workflow('submit', auth)), 403);
  });

  it.each([undefined, '', '   ', 42, { reason: 'bad type' }])('requires a nonblank text correction reason (%j)', async reason => {
    (await setState('UNDER_REVIEW'));
    await checked((await workflow('return', reviewer, { reason })), 400);
    expect((await testCaseStore.findById(testCaseId))!.status).toBe('UNDER_REVIEW');
    expect((await AuditService.getHistoryForTest(testCaseId))).toHaveLength(0);
  });

  it('rejects missing revisions, invalid states, duplicate transitions and competing review claims', async () => {
    await request(app).put(`/api/v1/test-cases/${testCaseId}/status`).set('Authorization', `Bearer ${tech}`).send({ status: 'TESTING' }).expect(400);
    await checked((await workflow('submit', tech)), 409);
    await checked((await resume()), 200);
    await checked((await resume()), 409);
    await observe().expect(201);
    await checked((await workflow('submit', tech)), 200);
    await checked((await workflow('submit', tech)), 409);
    await checked((await workflow('approve', reviewer)), 409);
    await checked((await workflow('return', reviewer, { reason: 'Too early' })), 409);
    const expectedRevision = (await revision());
    const claims = await Promise.all([reviewer, otherReviewer].map(auth => workflow('start-review', auth, { expectedRevision })));
    expect(claims.map(response => response.status).sort()).toEqual([200, 409]);
    expect((await AuditService.getHistoryForTest(testCaseId)).filter(event => event.action === 'START_REVIEW')).toHaveLength(1);
    await checked((await workflow('start-review', reviewer)), 409);
  });

  it('adds and reads evidence for the owner and reviewer, while rejecting cross-record uploads', async () => {
    await checked((await resume()), 200);
    const evidence = { testCaseId, testType: 'GENERAL', description: 'Setup', fileName: 'setup.txt', mimeType: 'text/plain', sizeBytes: 4, fileData: 'dGVzdA==' };
    await request(app).post('/api/v1/evidence').set('Authorization', `Bearer ${otherTech}`).send(evidence).expect(403);
    await request(app).post('/api/v1/evidence').set('Authorization', `Bearer ${tech}`).send(evidence).expect(201);
    await observe().expect(201);
    await checked((await workflow('submit', tech)), 200);
    const response = await request(app).get(`/api/v1/evidence/${testCaseId}`).set('Authorization', `Bearer ${reviewer}`).expect(200);
    expect(response.body.data.some((item: any) => item.description === 'Setup' && item.fileData === 'dGVzdA==')).toBe(true);
    expect((await AuditService.getHistoryForTest(testCaseId)).some(event => event.action === 'EVIDENCE_ADDED')).toBe(true);
  });

  it('uses explicitly provisioned stable identities and retains legacy technician ownership', async () => {
    await provisionLegacyTestStaff();
    const login = async (email: string) => (await request(app).post('/api/v1/auth/login').send({ email, password: developmentStaffPassword() }).expect(200)).body.data;
    const owner = await login('technician@example.com');
    const officer = await login('reviewer@example.com');
    const administrator = await login('admin@example.com');
    const another = await login('technician2@example.com');
    expect(owner.user.id).toBe('dev-user-01');
    expect(new Set([owner.user.id, officer.user.id, administrator.user.id, another.user.id]).size).toBe(4);
    expect((await login(' REVIEWER@example.com ')).user.id).toBe(officer.user.id);
    expect(officer.user.role).toBe('Reviewer');
    expect(administrator.user.role).toBe('Administrator');
  });
});
