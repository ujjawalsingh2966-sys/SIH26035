import { clearRepository } from './helpers/persistenceFixtures';
import fs from 'fs';
import { createHash } from 'crypto';
import request from 'supertest';
import app from '../src/app';
import { manufacturerStore, instrumentStore, testCaseStore, observationStore, auditStore, nativeTestStore } from '../src/repositories';
import { evidenceStore } from '../src/services/EvidenceService';
import { JsonStore } from '../src/repositories/JsonStore';
import { ReportService } from '../src/services/ReportService';
import type { TestCase, ObservationRecord } from '../src/types/domain';
import { testSession } from './helpers/persistedIdentity';

let technician: string, reviewer: string, anotherReviewer: string;
const maker = { id: 'p2a-maker', name: 'Synthetic manufacturer', address: 'Isolated laboratory', identifier: 'P2A' };
const instrument = { id: 'p2a-instrument', manufacturerId: maker.id, name: 'Synthetic scale', model: 'P2A', serialNumber: 'P2A-ONLY',
  isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true, accuracyClass: 'III' as const,
  maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', n: '3000', weighingUnit: 'g' as const, hasTare: false,
  hasAuxiliaryIndication: false, isGrading: false, softwareControlled: false,
  declaredSpecifications: { unit: 'g' as const, maxCapacity: '15000', minCapacity: '100', e: '5', d: '5' } };
const initial: TestCase = { id: 'p2a-case', instrumentId: instrument.id, technicianId: 'p2a-technician', status: 'TESTING', revision: 0,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  laboratoryConditions: { temperature: '20', humidity: '50', pressure: '1013' },
  masterDataSnapshot: { version: 'W8LAB-MASTER-1', capturedAt: '2026-01-01T00:00:00.000Z', instrument, manufacturer: maker },
  testConfiguration: { weighing: 'NOT STARTED', eccentricity: 'NOT STARTED', repeatability: 'NOT STARTED', tare: 'NOT APPLICABLE', zeroSetting: 'NOT STARTED' } };
const input = { testCaseId: initial.id, testType: 'WEIGHING', sequence: 1, load: '5000', indication: '5000', additionalWeights: '2.5', unit: 'g' };
const observe = () => request(app).post('/api/v1/observations').set('Authorization', `Bearer ${technician}`).send(input);

beforeAll(async () => {
  technician = await testSession('p2a-technician', 'Technician');
  reviewer = await testSession('p2a-reviewer', 'Reviewer');
  anotherReviewer = await testSession('p2a-other-reviewer', 'Reviewer');
});
beforeEach(async () => {
  for (const store of [manufacturerStore, instrumentStore, testCaseStore, observationStore, auditStore, nativeTestStore, evidenceStore]) await clearRepository(store);
  await manufacturerStore.saveItem(maker); await instrumentStore.saveItem(instrument); await testCaseStore.saveItem(initial);
});
afterEach(() => jest.restoreAllMocks());

function failAuditOnce() {
  const rename = fs.renameSync; let failed = false;
  return jest.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    if (String(to).endsWith('audit.json') && !failed) { failed = true; throw new Error('Synthetic audit write failure'); }
    rename(from, to);
  });
}

it('does not acknowledge case creation when the creation audit cannot commit; retry creates once', async () => {
  const spy = failAuditOnce();
  const create = () => request(app).post('/api/v1/test-cases').set('Authorization', `Bearer ${technician}`).send({ instrumentId: instrument.id });
  await create().expect(503);
  expect(await testCaseStore.findAll()).toEqual([initial]); expect(await auditStore.findAll()).toEqual([]);
  expect(new JsonStore<TestCase>('testCases.json', true).findAll()).toEqual([initial]);
  spy.mockRestore();
  await create().expect(201);
  expect(await testCaseStore.findAll()).toHaveLength(2); expect(await auditStore.findAll()).toHaveLength(1);
});

it('rolls back observation, revision and audit together when the last file fails', async () => {
  const spy = failAuditOnce(); await observe().expect(503);
  expect(await observationStore.findAll()).toEqual([]); expect(await auditStore.findAll()).toEqual([]);
  expect(await testCaseStore.findById(initial.id)).toEqual(initial);
  expect(new JsonStore<ObservationRecord>('observations.json', true).findAll()).toEqual([]);
  expect(new JsonStore<TestCase>('testCases.json', true).findById(initial.id)).toEqual(initial);
  spy.mockRestore(); await observe().expect(201);
  expect(await observationStore.findAll()).toHaveLength(1); expect((await testCaseStore.findById(initial.id))!.revision).toBe(1);
  expect(await auditStore.findAll()).toHaveLength(1);
});

it('retains the previous observation/evaluation and history when correction commit fails', async () => {
  const created = (await observe().expect(201)).body.data;
  const beforeCase = await testCaseStore.findById(initial.id), beforeAudit = await auditStore.findAll();
  const spy = failAuditOnce();
  await request(app).put(`/api/v1/observations/${created.id}`).set('Authorization', `Bearer ${technician}`)
    .send({ ...input, indication: '5010' }).expect(503);
  expect(await observationStore.findById(created.id)).toEqual(created);
  expect(await testCaseStore.findById(initial.id)).toEqual(beforeCase); expect(await auditStore.findAll()).toEqual(beforeAudit);
  spy.mockRestore();
  await request(app).put(`/api/v1/observations/${created.id}`).set('Authorization', `Bearer ${technician}`)
    .send({ ...input, indication: '5010' }).expect(200);
  const event = (await auditStore.findAll()).find(row => row.action === 'OBSERVATION_UPDATED')!;
  expect(event.metadata!.previous).toEqual(created);
  const leaked = event.metadata!.previous; leaked.load = 'changed';
  expect((await auditStore.findById(event.id))!.metadata!.previous).toEqual(created);
});

it('serializes competing reviewer claims and checks the revision inside the write boundary', async () => {
  await testCaseStore.saveItem({ ...initial, status: 'READY_FOR_REVIEW' });
  const claim = (token: string) => request(app).post(`/api/v1/test-cases/${initial.id}/workflow/start-review`)
    .set('Authorization', `Bearer ${token}`).send({ expectedRevision: 0 });
  const responses = await Promise.all([claim(reviewer), claim(anotherReviewer)]);
  expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
  expect((await testCaseStore.findById(initial.id))!.revision).toBe(1);
  expect((await auditStore.findAll()).filter(row => row.action === 'START_REVIEW')).toHaveLength(1);
});

it('rolls back evidence, revision and audit together and preserves evidence on retry/reload', async () => {
  const upload = () => request(app).post('/api/v1/evidence').set('Authorization', `Bearer ${technician}`).send({
    testCaseId: initial.id, testType: 'GENERAL', description: 'Synthetic setup evidence',
    fileName: 'synthetic.txt', mimeType: 'text/plain', sizeBytes: 4, fileData: 'dGVzdA==',
  });
  const spy = failAuditOnce(); await upload().expect(400);
  expect(await evidenceStore.findAll()).toEqual([]); expect(await auditStore.findAll()).toEqual([]);
  expect(await testCaseStore.findById(initial.id)).toEqual(initial);
  spy.mockRestore();
  const saved = (await upload().expect(201)).body.data;
  expect(saved.fileData).toBe('dGVzdA=='); expect(saved.uploadedBy).toBe(initial.technicianId);
  expect(new JsonStore('evidence.json', true).findAll()).toEqual([saved]);
  expect((await testCaseStore.findById(initial.id))!.revision).toBe(1); expect(await auditStore.findAll()).toHaveLength(1);
});

it('preserves report seal serialization and observation insertion order without recalculating', async () => {
  const approved = { ...initial, status: 'APPROVED' as const };
  await testCaseStore.saveItem(approved);
  const rows: ObservationRecord[] = ['z-observation', 'a-observation'].map((id, index) => ({
    id, testCaseId: initial.id, testType: 'WEIGHING', sequence: index + 1,
    load: '0001.2500', indication: '0001.2500', additionalWeights: '0.00000001', unit: 'g',
  }));
  for (const row of rows) await observationStore.saveItem(row);
  const expected = createHash('sha256').update(JSON.stringify({ testCase: approved, observations: rows, ruleEngineVersion: 'UNKNOWN' })).digest('hex');
  const report = await ReportService.generateReportData(initial.id, 'Reviewer');
  expect(report.meta.cryptographicSeal).toBe(expected); expect(report.observations).toEqual(rows);
  expect(report.status).toBe('PROTOTYPE'); expect(report.complianceSummary.overallVerdict).toBe('INCOMPLETE');
  expect(new JsonStore<ObservationRecord>('observations.json', true).findAll()).toEqual(rows);
});

it('does not deliver an export or audit success when its export audit cannot commit', async () => {
  await testCaseStore.saveItem({ ...initial, status: 'APPROVED' });
  const spy = failAuditOnce();
  const response = await request(app).get(`/api/v1/reports/${initial.id}/pdf`).set('Authorization', `Bearer ${technician}`).expect(400);
  expect(response.headers['content-type']).toMatch(/application\/json/);
  expect(response.headers['content-disposition']).toBeUndefined(); expect(await auditStore.findAll()).toEqual([]);
  spy.mockRestore();
  await request(app).get(`/api/v1/reports/${initial.id}/pdf`).set('Authorization', `Bearer ${technician}`).expect(200);
  expect(await auditStore.findAll()).toHaveLength(1);
});
