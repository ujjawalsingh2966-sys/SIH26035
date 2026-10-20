import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import { createRepositories } from '../src/repositories/createRepositories';
import { FakePg } from './helpers/fakePg';
import type { Express } from 'express';
import type { TestCase, Instrument, ObservationRecord, ObservationType } from '../src/types/domain';
import type { StaffAccount, StaffRole } from '../src/types/identity';

const now = '2026-01-01T00:00:00.000Z';
const maker = { id: 'pg-maker', name: 'Synthetic manufacturer', address: 'Isolated laboratory', identifier: 'PG-ONLY' };
const instrument: Instrument = { id: 'pg-instrument', manufacturerId: maker.id, name: 'Synthetic scale', model: 'PG', serialNumber: 'PG-ONLY',
  isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true, accuracyClass: 'III',
  maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', n: '3000', weighingUnit: 'g', hasTare: false,
  hasAuxiliaryIndication: false, isGrading: false, softwareControlled: false,
  declaredSpecifications: { unit: 'g', maxCapacity: '15000', minCapacity: '100', e: '5', d: '5' } };
const initial: TestCase = { id: 'pg-case', instrumentId: instrument.id, technicianId: 'pg-tech', status: 'TESTING', revision: 0,
  createdAt: now, updatedAt: now, laboratoryConditions: { temperature: '20', humidity: '50', pressure: '1013' },
  masterDataSnapshot: { version: 'W8LAB-MASTER-1', capturedAt: now, instrument, manufacturer: maker },
  testConfiguration: { weighing: 'NOT STARTED', eccentricity: 'NOT STARTED', repeatability: 'NOT STARTED', tare: 'NOT APPLICABLE', zeroSetting: 'NOT STARTED' } };
const input = { testCaseId: initial.id, testType: 'WEIGHING', sequence: 1, load: '5000', indication: '5000', additionalWeights: '2.5', unit: 'g' };
const ids = ['pg-tech', 'pg-other-tech', 'pg-reviewer', 'pg-other-reviewer', 'pg-admin'] as const;
let app: Express, fake: FakePg, bundle: ReturnType<typeof createRepositories>;
let session: typeof import('../src/services/SessionService');
let staffService: typeof import('../src/services/StaffService');
let evaluation: typeof import('../src/services/EvaluationService');
let reports: typeof import('../src/services/ReportService');
let native: typeof import('../src/services/NativeApplicability');
let business: typeof import('../src/services/AccountService');
let password: string, passwordHash: string;
let tokens: Record<string, string>;
let identities: StaffAccount[];

beforeAll(async () => {
  // Generated synthetic credentials are used only in memory and are never logged.
  password = randomBytes(24).toString('hex');
  passwordHash = await require('../src/services/StaffService').hashStaffPassword(password);
});
beforeEach(async () => {
  fake = new FakePg();
  bundle = createRepositories({ environment: { PERSISTENCE_ADAPTER: 'postgres' }, postgresPool: fake });
  jest.isolateModules(() => {
    // Only the persistence boundary is mocked. Routes, sessions, policy, metrology and reports are real.
    jest.doMock('../src/repositories/createRepositories', () => ({ getRepositories: () => bundle }));
    app = require('../src/app').default;
    session = require('../src/services/SessionService'); staffService = require('../src/services/StaffService');
    evaluation = require('../src/services/EvaluationService'); reports = require('../src/services/ReportService');
    native = require('../src/services/NativeApplicability'); business = require('../src/services/AccountService');
  });
  identities = ids.map(id => ({ id, name: 'Synthetic staff', email: `${id}@example.test`,
    role: (id.includes('reviewer') ? 'Reviewer' : id.includes('admin') ? 'Administrator' : 'Technician') as StaffRole,
    active: true, passwordHash, credentialVersion: 0, createdAt: now, updatedAt: now, createdBy: 'synthetic-setup' }));
  fake.seed('staff_accounts', identities); fake.seed('manufacturers', [maker]); fake.seed('instruments', [instrument]); fake.seed('test_cases', [initial]);
  tokens = {};
  for (const account of identities) tokens[account.id] = await session.issueSession(account);
});
afterEach(() => { jest.dontMock('../src/repositories/createRepositories'); jest.restoreAllMocks(); });

const observe = () => request(app).post('/api/v1/observations').set('Authorization', `Bearer ${tokens['pg-tech']}`).send(input);
const workflow = (action: string, token = tokens['pg-reviewer']) => request(app).post(`/api/v1/test-cases/${initial.id}/workflow/${action}`)
  .set('Authorization', `Bearer ${token}`).send({ expectedRevision: 0 });

it.each(['pg-tech', 'pg-reviewer', 'pg-admin'])('authenticates persistent staff with the original KDF/JWT/session contract: %s', async id => {
  const response = await request(app).post('/api/v1/auth/login').send({ email: `${id}@example.test`, password }).expect(200);
  expect(response.body.data.user.id).toBe(id); expect(response.body.data.user).not.toHaveProperty('passwordHash');
  expect(response.body.data.user).not.toHaveProperty('credentialVersion'); expect(response.headers['cache-control']).toBe('no-store');
  const token = response.body.data.token;
  await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`).expect(200);
  await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
});

it('preserves wrong-password, inactive, expired-session and escalation rejection', async () => {
  await request(app).post('/api/v1/auth/login').send({ email: identities[0].email, password: randomBytes(20).toString('hex') }).expect(401);
  await bundle.staffStore.saveItem({ ...identities[0], active: false });
  await request(app).post('/api/v1/auth/login').send({ email: identities[0].email, password }).expect(401);
  await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokens['pg-tech']}`).expect(401);
  await request(app).post('/api/v1/auth/login').send({ email: identities[2].email, password, role: 'Administrator' }).expect(400);
  const storedSession = (await bundle.sessionStore.findAll()).find(item => item.accountId === 'pg-reviewer')!;
  await bundle.sessionStore.saveItem({ ...storedSession, expiresAt: now });
  await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokens['pg-reviewer']}`).expect(401);
  await request(app).get('/api/v1/staff').set('Authorization', `Bearer ${tokens['pg-other-tech']}`).expect(403);
  await request(app).patch('/api/v1/staff/pg-other-tech').set('Authorization', `Bearer ${tokens['pg-admin']}`).send({ role: 'Administrator' }).expect(400);
});

it('preserves the separate Business account/password format and denies staff-only routes', async () => {
  const account = await business.createBusinessAccount('Synthetic Business', 'pg-business@example.test', password);
  expect(account.passwordHash.split(':')).toHaveLength(2);
  const response = await request(app).post('/api/v1/auth/login').send({ email: account.email, password }).expect(200);
  const token = response.body.data.token;
  await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  await request(app).get('/api/v1/test-cases').set('Authorization', `Bearer ${token}`).expect(403);
  await request(app).post('/api/v1/auth/register').send({ name: 'Synthetic Escalation', email: 'pg-escalate@example.test', password, role: 'Administrator' }).expect(403);
});

it('rolls back observation, case revision and audit on a failed SQL flush, then retries once successfully', async () => {
  fake.failNext(text => text.startsWith('INSERT INTO w8lab.audit_events'));
  const failed = await observe().expect(503);
  expect(failed.text).not.toContain('Synthetic private');
  expect(fake.records('observations')).toEqual([]); expect(fake.records('audit_events')).toEqual([]);
  expect(fake.records('test_cases')).toEqual([initial]);
  const created = await observe().expect(201);
  expect(created.body.data.evaluation.compliance.verdict).toBe('PASS');
  expect(fake.records('observations')).toHaveLength(1); expect(fake.records('audit_events')).toHaveLength(1);
  expect((await bundle.testCaseStore.findById(initial.id))!.revision).toBe(1);
});

it('preserves unit normalization, invalid-unit validation and cross-user record policy', async () => {
  const grams = evaluation.EvaluationService.evaluateObservation(instrument, input as any, true);
  const response = await request(app).post('/api/v1/observations').set('Authorization', `Bearer ${tokens['pg-tech']}`)
    .send({ ...input, load: '5', indication: '5', additionalWeights: '0.0025', unit: 'kg' }).expect(201);
  expect(response.body.data.evaluation.calculation).toEqual(grams.calculation);
  expect(response.body.data.evaluation.compliance.verdict).toBe(grams.compliance.verdict);
  await request(app).post('/api/v1/observations').set('Authorization', `Bearer ${tokens['pg-tech']}`).send({ ...input, unit: 'lb' }).expect(400);
  expect(fake.records('observations')).toHaveLength(1);
  await request(app).get(`/api/v1/repository/records/${initial.id}`).set('Authorization', `Bearer ${tokens['pg-other-tech']}`).expect(403);
  await request(app).get('/api/v1/repository/records/not-present').set('Authorization', `Bearer ${tokens['pg-tech']}`).expect(404);
});

it('checks competing reviewer revisions inside the transaction and permits only one claim', async () => {
  await bundle.testCaseStore.saveItem({ ...initial, status: 'READY_FOR_REVIEW' });
  const responses = await Promise.all([workflow('start-review'), workflow('start-review', tokens['pg-other-reviewer'])]);
  expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
  expect((await bundle.testCaseStore.findById(initial.id))!.revision).toBe(1);
  expect(fake.records('audit_events')).toHaveLength(1);
});

it('keeps both undetermined coverage and the native final-approval safety gate closed', async () => {
  const underReview = { ...initial, status: 'UNDER_REVIEW' as const, reviewerId: 'pg-reviewer' };
  await bundle.testCaseStore.saveItem(underReview); await workflow('approve').expect(409);
  expect(fake.records('audit_events')).toEqual([]);
  const programme = native.buildNativeProgramme(instrument, { purpose: 'TYPE_EVALUATION', indication: 'DIGITAL',
    zeroDevices: [], initialZeroSetting: false, eccentricityPossible: true, loadReceptor: 'PLATFORM', supportPoints: 4,
    evidenceReference: 'SYNTHETIC incomplete programme' }, 'pg-tech');
  await bundle.testCaseStore.saveItem({ ...underReview, nativeProgramme: programme });
  await workflow('approve').expect(409);
  expect((await bundle.testCaseStore.findById(initial.id))!.status).toBe('UNDER_REVIEW');
  expect(fake.records('audit_events')).toEqual([]);
});

it('retains the established reportable complete FAIL fixture without claiming native completeness', async () => {
  const core: ObservationType[] = ['WEIGHING', 'ECCENTRICITY', 'REPEATABILITY', 'ZERO_SETTING'];
  const testCase: TestCase = { ...initial, status: 'UNDER_REVIEW', reviewerId: 'pg-reviewer',
    programmeDetermination: { standard: 'OIML R 76-1:2006', determinedBy: 'synthetic-only-plan', determinedAt: now,
      requirements: core.map(testType => ({ testType, minimumObservations: 1 })) } };
  await bundle.testCaseStore.saveItem(testCase);
  // Same synthetic legacy aggregation fixture as P0: not a public programme-creation path or native-compliance claim.
  for (const [index, testType] of core.entries()) {
    const row: ObservationRecord = { ...input, unit: 'g', id: `pg-${testType}`, testType, indication: index ? '5000' : '5010' };
    row.evaluation = evaluation.EvaluationService.evaluateObservation(instrument, { ...row, testType: 'WEIGHING' }, true);
    row.evaluation.inputFingerprint = evaluation.observationFingerprint(instrument, row, true);
    await bundle.observationStore.saveItem(row);
  }
  await workflow('approve').expect(200);
  const report = await reports.ReportService.generateReportData(initial.id, 'Reviewer');
  expect(report.status).toBe('FINAL'); expect(report.complianceSummary.overallVerdict).toBe('FAIL');
});

it('preserves report seal bytes, evidence bytes and insertion order after a fresh adapter reload', async () => {
  const approved = { ...initial, status: 'APPROVED' as const }; await bundle.testCaseStore.saveItem(approved);
  const rows: ObservationRecord[] = ['z-observation', 'a-observation'].map((id, index) => ({ id, testCaseId: initial.id, testType: 'WEIGHING', sequence: index + 1,
    load: '0001.2500', indication: '0001.2500', additionalWeights: '0.00000001', unit: 'g' }));
  for (const row of rows) await bundle.observationStore.saveItem(row);
  await bundle.evidenceStore.saveItem({ id: 'evidence', testCaseId: initial.id, testType: 'GENERAL', uploadedBy: 'pg-tech',
    uploadedAt: now, description: 'Synthetic evidence', fileName: 'synthetic.txt', mimeType: 'text/plain', sizeBytes: 4, fileData: 'dGVzdA==' });
  const fresh = createRepositories({ environment: { PERSISTENCE_ADAPTER: 'postgres' }, postgresPool: fake });
  expect(await fresh.observationStore.findAll()).toEqual(rows);
  expect((await fresh.evidenceStore.findById('evidence'))!.fileData).toBe('dGVzdA==');
  const expected = createHash('sha256').update(JSON.stringify({ testCase: approved, observations: rows, ruleEngineVersion: 'UNKNOWN' })).digest('hex');
  const report = await reports.ReportService.generateReportData(initial.id, 'Reviewer');
  expect(report.meta.cryptographicSeal).toBe(expected); expect(report.observations).toEqual(rows);
  expect(report.status).toBe('PROTOTYPE'); expect(report.complianceSummary.overallVerdict).toBe('INCOMPLETE');
});

it('withholds a report export when its audit fails, without leaking download headers; retry works', async () => {
  await bundle.testCaseStore.saveItem({ ...initial, status: 'APPROVED' });
  const exportPdf = (id = 'pg-tech') => request(app).get(`/api/v1/reports/${initial.id}/pdf`).set('Authorization', `Bearer ${tokens[id]}`);
  await exportPdf('pg-other-tech').expect(403);
  fake.failNext(text => text.startsWith('INSERT INTO w8lab.audit_events'));
  const response = await exportPdf().expect(400);
  expect(response.headers['content-type']).toMatch(/application\/json/); expect(response.headers['content-disposition']).toBeUndefined();
  expect(fake.records('audit_events')).toEqual([]);
  const success = await exportPdf().expect(200);
  expect(success.body.toString('latin1')).toContain('%PDF-'); expect(fake.records('audit_events')).toHaveLength(1);
});

it('rolls back native evidence/revision/audit together and retains the native report seal formula', async () => {
  const define = () => request(app).put(`/api/v1/native/${initial.id}/programme`).set('Authorization', `Bearer ${tokens['pg-tech']}`)
    .send({ expectedRevision: 0, profile: { purpose: 'TYPE_EVALUATION', indication: 'DIGITAL', zeroDevices: ['SEMI_AUTOMATIC'],
      initialZeroSetting: false, eccentricityPossible: true, loadReceptor: 'PLATFORM', supportPoints: 4, evidenceReference: 'SYNTHETIC native manual' } });
  const programme = (await define().expect(200)).body.data;
  const before = (await bundle.testCaseStore.findById(initial.id))!, beforeAudit = fake.records('audit_events');
  const save = () => request(app).put(`/api/v1/native/${initial.id}/tests/ZERO_SEMI_AUTOMATIC/ACCURACY`).set('Authorization', `Bearer ${tokens['pg-tech']}`)
    .send({ expectedRevision: 1, submission: { procedureId: 'ZERO_SEMI_AUTOMATIC', series: 'ACCURACY',
      readings: [{ sequence: 1, load: '0', indication: '0', additionalWeights: '1.25', unit: 'g' }],
      conditions: { stable: true, sufficientAccuracy: true, zeroInitiatedNearChangeover: true }, evidenceReference: 'SYNTHETIC calibration evidence' } });
  fake.failNext(text => text.startsWith('INSERT INTO w8lab.audit_events'));
  await save().expect(503);
  expect(fake.records('native_tests')).toEqual([]); expect(await bundle.testCaseStore.findById(initial.id)).toEqual(before);
  expect(fake.records('audit_events')).toEqual(beforeAudit);
  const saved = (await save().expect(200)).body.data;
  expect(saved.result.status).toBe('PASS'); expect(saved.programmeId).toBe(programme.id);
  expect((await bundle.testCaseStore.findById(initial.id))!.revision).toBe(2);
  // Isolated historical APPROVED fixture only: native final approval is still blocked above.
  const approved = { ...(await bundle.testCaseStore.findById(initial.id))!, status: 'APPROVED' as const };
  await bundle.testCaseStore.saveItem(approved);
  const expected = createHash('sha256').update(JSON.stringify({ testCase: approved, observations: [], nativeTests: [saved], ruleEngineVersion: programme.ruleset })).digest('hex');
  const report = await reports.ReportService.generateReportData(initial.id, 'Reviewer');
  expect(report.meta.cryptographicSeal).toBe(expected); expect(report.nativeTests).toEqual([saved]);
  expect(report.status).toBe('PROTOTYPE'); expect(report.programme.complete).toBe(false);
});

it('keeps uploaded evidence and its audit atomic and preserves the existing route-specific error status', async () => {
  const upload = () => request(app).post('/api/v1/evidence').set('Authorization', `Bearer ${tokens['pg-tech']}`).send({
    testCaseId: initial.id, testType: 'GENERAL', description: 'Synthetic evidence',
    fileName: 'synthetic.txt', mimeType: 'text/plain', sizeBytes: 4, fileData: 'dGVzdA==' });
  fake.failNext(text => text.startsWith('INSERT INTO w8lab.audit_events'));
  await upload().expect(400);
  expect(fake.records('evidence')).toEqual([]); expect(fake.records('audit_events')).toEqual([]);
  expect(await bundle.testCaseStore.findById(initial.id)).toEqual(initial);
  const response = await upload().expect(201);
  expect(response.body.data.fileData).toBe('dGVzdA=='); expect(response.body.data.uploadedBy).toBe(initial.technicianId);
  expect(fake.records('evidence')).toEqual([response.body.data]); expect(fake.records('audit_events')).toHaveLength(1);
  expect((await bundle.testCaseStore.findById(initial.id))!.revision).toBe(1);
});

it('does not deliver HTTP success before the transaction commit completes', async () => {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  fake.beforeCommit = async readOnly => { if (!readOnly) { entered(); await gate; } };
  let received = false;
  const pending = observe().then(response => { received = true; return response; });
  try {
    await started; await new Promise(resolve => setImmediate(resolve));
    expect(received).toBe(false); expect(fake.records('observations')).toEqual([]);
  } finally { release(); }
  expect((await pending).status).toBe(201); expect(fake.records('observations')).toHaveLength(1);
});
