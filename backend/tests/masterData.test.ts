import { clearRepository } from './helpers/persistenceFixtures';
import request from 'supertest';
import fs from 'fs';
import app from '../src/app';
import { manufacturerStore, instrumentStore, testCaseStore, observationStore, auditStore } from '../src/repositories';
import { testSession } from './helpers/persistedIdentity';
import { validateInstrument, saveInstrument, saveManufacturer } from '../src/services/MasterDataService';
import { JsonStore } from '../src/repositories/JsonStore';
import { ReportService } from '../src/services/ReportService';
import { accountStore, createBusinessAccount } from '../src/services/AccountService';
import { issueSession } from '../src/services/SessionService';
let tech: string;
let other: string;
let reviewer: string;
let admin: string;
beforeAll(async () => {
tech = (await testSession('p2-tech', 'Technician'));
other = (await testSession('p2-other', 'Technician'));
reviewer = (await testSession('p2-reviewer', 'Reviewer'));
admin = (await testSession('p2-admin', 'Administrator'));
});
const actor = { id: 'p2-tech', role: 'Technician' };
const input = { manufacturerId: 'p2-maker', name: 'P2 Scale', model: 'P2', serialNumber: 'P2-001',
  accuracyClass: 'III', maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', hasTare: false,
  isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true,
  weighingUnit: 'g', hasAuxiliaryIndication: false, isGrading: false, softwareControlled: false };
const makerInput = { name: 'Second maker', address: '2 Synthetic Street', identifier: 'P2-SECOND' };
const call = (method: string, endpoint: string, body?: object, token = tech) => (request(app) as any)[method](`/api/v1${endpoint}`).set('Authorization', `Bearer ${token}`).send(body);
beforeEach(async () => {
  (await clearRepository(manufacturerStore)); (await clearRepository(instrumentStore)); (await clearRepository(testCaseStore)); (await clearRepository(observationStore)); (await clearRepository(auditStore)); (await clearRepository(accountStore));
  (await manufacturerStore.saveItem({ id: input.manufacturerId, name: 'P2 manufacturer', address: '1 Test Street', identifier: 'P2-M', revision: 0, createdBy: actor.id, active: true }));
});
afterEach(() => jest.restoreAllMocks());
it('creates, reads, searches, updates and archives an unreferenced manufacturer without deleting it', async () => {
  const created = await call('post', '/manufacturers', makerInput).expect(201), id = created.body.data.id;
  await call('get', `/manufacturers/${id}`).expect(200);
  expect((await call('get', '/manufacturers?q=SECOND').expect(200)).body.data.map((row: any) => row.id)).toContain(id);
  const edited = await call('put', `/manufacturers/${id}`, { ...makerInput, name: 'Updated maker', expectedRevision: 0 }).expect(200);
  expect(edited.body.data.history[1].previous.name).toBe(makerInput.name);
  await call('delete', `/manufacturers/${id}`, { expectedRevision: 1 }).expect(200);
  expect((await call('get', '/manufacturers').expect(200)).body.data.some((row: any) => row.id === id)).toBe(false);
  expect((await call('get', '/manufacturers?includeArchived=true').expect(200)).body.data.some((row: any) => row.id === id)).toBe(true);
  expect(new JsonStore<any>('manufacturers.json', true).findById(id).active).toBe(false);
});
it.each([{ name: '' }, { address: [] }, { identifier: ' ' }, { id: 'forged' }])('rejects malformed/privileged manufacturer fields %p', async extra => {
  await call('post', '/manufacturers', { ...makerInput, ...extra }).expect(400);
  expect((await manufacturerStore.findAll())).toHaveLength(1);
});
it('rejects normalized duplicates and stale manufacturer revisions', async () => {
  await call('post', '/manufacturers', { ...makerInput, identifier: ' p2-m ' }).expect(409);
  await call('post', '/manufacturers', { name: 'P2 manufacturer', address: '1 Test Street', identifier: 'different' }).expect(409);
  await call('put', `/manufacturers/${input.manufacturerId}`, { ...makerInput, expectedRevision: 2 }).expect(409);
});
it.each([['manufacturer', '/manufacturers'], ['instrument', '/instruments']])('denies Reviewer %s mutations', async (_label, endpoint) => {
  await call('post', endpoint, endpoint === '/manufacturers' ? makerInput : input, reviewer).expect(403);
});
it('restricts manufacturer and unlinked instrument editing to creator/Administrator', async () => {
  const instrument = (await saveInstrument(input, actor));
  await call('put', `/manufacturers/${input.manufacturerId}`, { ...makerInput, expectedRevision: 0 }, other).expect(403);
  await call('put', `/instruments/${instrument.id}`, { ...input, name: 'Changed', expectedRevision: 0 }, other).expect(403);
  await call('put', `/instruments/${instrument.id}`, { ...input, name: 'Changed', expectedRevision: 0 }, admin).expect(200);
  await call('put', `/instruments/${instrument.id}`, { ...input, expectedRevision: 0 }).expect(409);
});
it('denies Business and anonymous master-data access', async () => {
  const account = (await createBusinessAccount('Synthetic Business', 'p2-business@example.test', 'private-test-only-password'));
  const token = (await issueSession(account));
  for (const endpoint of ['/manufacturers', '/instruments', '/instruments/unknown/history']) await call('get', endpoint, undefined, token).expect(403);
  await request(app).get('/api/v1/manufacturers').expect(401);
});
it.each([
  { manufacturerId: 'missing' }, { manufacturerId: '' }, { accuracyClass: 'V' }, { serialNumber: ' ' },
  { maxCapacity: '' }, { minCapacity: '0' }, { e: '0' }, { d: '-1' }, { maxCapacity: 'NaN' }, { d: 'Infinity' },
  { maxCapacity: '0x123' }, { maxCapacity: '1e5' }, { maxCapacity: 15000 }, { maxCapacity: '99' }, { d: '10' },
  { e: '3', d: '3' }, { n: '2999' }, { n: 3000 }, { n: '3000.1' }, { weighingUnit: 'lb' }, { weighingUnit: null },
  { hasTare: undefined }, { hasAuxiliaryIndication: undefined }, { isGrading: undefined }, { softwareControlled: undefined },
  { isManual: 'false' }, { minCapacity: '95' }, { maxCapacity: '15001' }, { softwareControlled: true }, { createdBy: 'p2-admin' },
  { hasAuxiliaryIndication: true }, { d: '1' }, { accuracyClass: 'IIII', maxCapacity: '15000' },
])('rejects malformed/inconsistent registration %p without changing stores', async extra => {
  await call('post', '/instruments', { ...input, ...extra }).expect(400);
  expect((await instrumentStore.findAll())).toHaveLength(0);
});
it.each(['isWeighing', 'isManual', 'isElectronic', 'isSingleRange'])('explicitly defers unsupported %s=false profiles', async flag => {
  await call('post', '/instruments', { ...input, [flag]: false }).expect(422);
});
it.each([
  ['II', '0.001', '0.1', '0.02'], ['II', '0.05', '5000', '1'], ['II', '0.1', '500', '5'],
  ['III', '0.1', '10', '2'], ['III', '2', '20000', '40'], ['III', '5', '2500', '100'],
  ['IIII', '5', '500', '50'], ['IIII', '5', '5000', '50'], ['I', '0.001', '50', '0.1'],
])('accepts exact Table 3 supported-profile boundaries class %s/e=%s', async (accuracyClass, e, maxCapacity, minCapacity) => {
  const validated = (await validateInstrument({ ...input, accuracyClass, e, d: e, maxCapacity, minCapacity })); expect(validated.n).toBeTruthy();
});
it.each(['mg', 'g', 'kg', 't'])('normalizes declared %s specifications to the same saved grams and n', async unit => {
  const factors: Record<string, string[]> = { mg: ['15000000', '100000', '5000'], g: ['15000', '100', '5'], kg: ['15', '0.1', '0.005'], t: ['0.015', '0.0001', '0.000005'] };
  const [maxCapacity, minCapacity, e] = factors[unit];
  const validated = (await validateInstrument({ ...input, weighingUnit: unit, maxCapacity, minCapacity, e, d: e }));
  expect(validated).toMatchObject({ maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', n: '3000', weighingUnit: 'g' });
});
it('rejects duplicate manufacturer/serial identities but permits independent maker namespaces', async () => {
  await call('post', '/instruments', input).expect(201);
  await call('post', '/instruments', { ...input, serialNumber: ' p2-001 ' }).expect(409);
  const manufacturer = (await saveManufacturer(makerInput, actor));
  await call('post', '/instruments', { ...input, manufacturerId: manufacturer.id }).expect(201);
});
it('archives preserve references; linked identities and technical records cannot be removed or edited', async () => {
  const instrument = (await saveInstrument(input, actor));
  await call('delete', `/manufacturers/${input.manufacturerId}`, { expectedRevision: 0 }).expect(409);
  await call('post', '/test-cases', { instrumentId: instrument.id }).expect(201);
  await call('put', `/instruments/${instrument.id}`, { ...input, e: '10', d: '10', expectedRevision: 0 }, admin).expect(409);
  await call('put', `/manufacturers/${input.manufacturerId}`, { ...makerInput, expectedRevision: 0 }, admin).expect(409);
});
it('freezes new case metadata; manufacturer edits cannot change old workspace/report data or saved calculations', async () => {
  const instrument = (await saveInstrument(input, actor));
  const created = await call('post', '/test-cases', { instrumentId: instrument.id, masterDataSnapshot: { instrument: { e: '999' } } }).expect(201);
  const tc = created.body.data;
  expect(tc.masterDataSnapshot.instrument.e).toBe('5');
  await call('put', `/test-cases/${tc.id}/status`, { status: 'TESTING', expectedRevision: 0 }).expect(200);
  const obs = await call('post', '/observations', { testCaseId: tc.id, testType: 'WEIGHING', sequence: 1, load: '5', indication: '5.005', additionalWeights: '0.0025', unit: 'kg' }).expect(201);
  expect(obs.body.data.evaluation.calculation.Ec.value).toBe('5');
  const before = JSON.stringify((await observationStore.findAll()));
  (await saveManufacturer({ name: 'Renamed current maker', address: 'New current address', identifier: 'P2-M', expectedRevision: 0 }, actor, input.manufacturerId));
  const detail = await call('get', `/repository/records/${tc.id}`).expect(200);
  expect(detail.body.data.manufacturer.name).toBe('P2 manufacturer'); expect(detail.body.data.metadataSource).toBe('SNAPSHOT');
  (await testCaseStore.saveItem({ ...(await testCaseStore.findById(tc.id))!, status: 'APPROVED' })); // Explicit legacy-state fixture only, not a native approval bypass.
  const report = (await ReportService.generateReportData(tc.id, 'Technician'));
  expect(report.manufacturerDetails!.name).toBe('P2 manufacturer'); expect(report.instrumentDetails.n).toBe('3000');
  expect(report.complianceSummary.overallVerdict).toBe('INCOMPLETE');
  expect((await ReportService.generateHtmlReport(tc.id, 'Technician'))).toContain('P2 manufacturer');
  expect((await ReportService.generatePdfReport(tc.id, 'Technician')).toString('latin1')).toContain('Max: 15000 g');
  expect(JSON.stringify((await observationStore.findAll()))).toBe(before);
});
it('blocks legacy manufacturer editing instead of silently migrating old cases', async () => {
  const instrument = (await saveInstrument(input, actor)), now = new Date().toISOString();
  const legacy = { id: 'legacy', instrumentId: instrument.id, technicianId: actor.id, status: 'APPROVED' as const, createdAt: now, updatedAt: now, testConfiguration: {} as any };
  (await testCaseStore.saveItem(legacy));
  await call('put', `/manufacturers/${input.manufacturerId}`, { name: 'Changed', address: 'Elsewhere', identifier: 'P2-M', expectedRevision: 0 }, admin).expect(409);
  expect((await testCaseStore.findById('legacy'))).toEqual(legacy);
});
it('filters instrument testing history by record policy with no leaked foreign IDs', async () => {
  const instrument = (await saveInstrument(input, actor));
  const own = (await call('post', '/test-cases', { instrumentId: instrument.id }).expect(201)).body.data;
  const foreign = (await call('post', '/test-cases', { instrumentId: instrument.id }, other).expect(201)).body.data;
  const list = await call('get', `/instruments/${instrument.id}/history`).expect(200);
  expect(list.body.data.map((row: any) => row.id)).toEqual([own.id]); expect(list.text).not.toContain(foreign.id);
  expect((await call('get', `/instruments/${instrument.id}/history`, undefined, reviewer).expect(200)).body.data).toEqual([]);
});
it.each([
  { accuracyClass: 'I', e: '1', d: '1', maxCapacity: '50000', minCapacity: '100' },
  { accuracyClass: 'II', e: '0.1', d: '0.01', maxCapacity: '500', minCapacity: '0.5', hasAuxiliaryIndication: true },
  { isGrading: true, minCapacity: '25' },
])('registers but never starts unsupported evaluator profiles %p', async extra => {
  const instrument = (await call('post', '/instruments', { ...input, ...extra }).expect(201)).body.data;
  const detail = await call('get', `/instruments/${instrument.id}`).expect(200); expect(detail.body.data.evaluationSupport.supported).toBe(false);
  await call('post', '/test-cases', { instrumentId: instrument.id }).expect(409);
});
it('strict persistence failure rolls back master data and permits safe retry', async () => {
  const spy = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('synthetic'); });
  await call('post', '/manufacturers', makerInput).expect(503); expect((await manufacturerStore.findAll())).toHaveLength(1); spy.mockRestore();
  await call('post', '/manufacturers', makerInput).expect(201);
});
