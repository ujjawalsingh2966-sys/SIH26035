import { clearRepository } from './helpers/persistenceFixtures';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../src/app';
import { config } from '../src/config/env';
import { issueSession } from '../src/services/SessionService';
import { testSession } from './helpers/persistedIdentity';
import { accountStore, createBusinessAccount } from '../src/services/AccountService';
import { businessApplicationStore } from '../src/services/BusinessApplicationService';
import { JsonStore } from '../src/repositories/JsonStore';
import { developmentStaffPassword } from './helpers/developmentStaffPassword';

const password = 'Synthetic-business-pass-123';
const validInput = {
  submissionKey: randomUUID(),
  businessName: 'Synthetic Weighing Services',
  address: '12 Test Yard, Example City',
  instrument: {
    name: 'Electronic retail scale',
    model: 'W8-III',
    serialNumber: 'SYNTHETIC-001',
    accuracyClass: 'III',
    maxCapacity: '15000',
    minCapacity: '100',
    e: '5',
    d: '5',
    hasTare: true,
    isWeighing: true,
    isManual: true,
    isElectronic: true,
    isSingleRange: true,
  },
};

async function business(name: string, email: string) {
  const account = (await createBusinessAccount(name, email, password));
  const token = (await issueSession(account));
  return { account, token };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeEach(async () => {
  (await clearRepository(accountStore));
  (await clearRepository(businessApplicationStore));
});

afterEach(() => jest.restoreAllMocks());

it('creates a submitted owned application with server-controlled identity, state and audit history', async () => {
  const owner = (await business('Owner Business', 'owner@example.test'));
  const response = await request(app).post('/api/v1/verification/applications').set((await auth(owner.token))).send(validInput).expect(201);

  expect(response.body.data).toMatchObject({
    submissionKey: validInput.submissionKey,
    ownerId: owner.account.id,
    businessName: validInput.businessName,
    address: validInput.address,
    type: 'INITIAL',
    status: 'SUBMITTED',
    instrument: validInput.instrument,
  });
  expect(response.body.data.id).toEqual(expect.any(String));
  expect(response.body.data.instrument.id).toEqual(expect.any(String));
  expect(response.body.data.instrument.manufacturerId).toBe('');
  expect(response.body.data.history).toEqual([
    { action: 'SUBMITTED', actorId: owner.account.id, at: response.body.data.createdAt },
  ]);

  const persisted = new JsonStore<any>('applications.json', true, 'Application').findAll();
  expect(persisted).toEqual([response.body.data]);
});

it('lists and returns only the authenticated Business owner records', async () => {
  const first = (await business('First Business', 'first@example.test'));
  const second = (await business('Second Business', 'second@example.test'));
  const created = await request(app).post('/api/v1/verification/applications').set((await auth(first.token))).send(validInput).expect(201);
  await request(app).post('/api/v1/verification/applications').set((await auth(second.token))).send({ ...validInput, businessName: 'Second Business', instrument: { ...validInput.instrument, serialNumber: 'SECOND-002' } }).expect(201);

  const list = await request(app).get('/api/v1/verification/applications').set((await auth(first.token))).expect(200);
  expect(list.body.data.applications).toHaveLength(1);
  expect(list.body.data.applications[0].id).toBe(created.body.data.id);
  await request(app).get(`/api/v1/verification/applications/${created.body.data.id}`).set((await auth(first.token))).expect(200);
  await request(app).get(`/api/v1/verification/applications/${created.body.data.id}`).set((await auth(second.token))).expect(404);
  await request(app).put(`/api/v1/verification/applications/${created.body.data.id}`).set((await auth(second.token))).send(validInput).expect(404);
});

it.each([
  [{ ...validInput, businessName: ' ' }, 'businessName'],
  [{ ...validInput, address: ' ' }, 'address'],
  [{ ...validInput, instrument: { ...validInput.instrument, accuracyClass: 'I' } }, 'instrument.accuracyClass'],
  [{ ...validInput, instrument: { ...validInput.instrument, maxCapacity: 'not-a-number' } }, 'instrument.maxCapacity'],
  [{ ...validInput, instrument: { ...validInput.instrument, minCapacity: '15000' } }, 'instrument'],
  [{ ...validInput, instrument: { ...validInput.instrument, isElectronic: false } }, 'instrument.isElectronic'],
  [{ ...validInput, instrument: { ...validInput.instrument, hasTare: 'true' } }, 'instrument.hasTare'],
])('rejects missing or unsupported application input without persistence', async (payload, path) => {
  const owner = (await business('Owner Business', 'owner@example.test'));
  const response = await request(app).post('/api/v1/verification/applications').set((await auth(owner.token))).send(payload).expect(400);
  expect(response.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path })]));
  expect((await businessApplicationStore.findAll())).toHaveLength(0);
});

it.each([
  { ownerId: 'forged-owner' },
  { status: 'CERTIFIED' },
  { officerId: 'forged-officer' },
  { inspection: { verdict: 'PASS' } },
  { certificate: { status: 'VALID' } },
  { history: [] },
])('rejects client-controlled privileged field %p', async privileged => {
  const owner = (await business('Owner Business', 'owner@example.test'));
  await request(app).post('/api/v1/verification/applications').set((await auth(owner.token))).send({ ...validInput, ...privileged }).expect(400);
  expect((await businessApplicationStore.findAll())).toHaveLength(0);
});

it('rejects privileged instrument identity fields', async () => {
  const owner = (await business('Owner Business', 'owner@example.test'));
  await request(app).post('/api/v1/verification/applications').set((await auth(owner.token))).send({
    ...validInput,
    instrument: { ...validInput.instrument, id: 'forged', manufacturerId: 'forged' },
  }).expect(400);
  expect((await businessApplicationStore.findAll())).toHaveLength(0);
});

it('rejects staff and anonymous requests while retaining laboratory authentication', async () => {
  await request(app).get('/api/v1/verification/applications').expect(401);
  const staff = (await testSession('business-isolation-tech', 'Technician'));
  await request(app).get('/api/v1/verification/applications').set((await auth(staff))).expect(403);
  await request(app).post('/api/v1/verification/applications').set((await auth(staff))).send(validInput).expect(403);
});

it('locks submitted records and rejects repeated submission without changing history', async () => {
  const owner = (await business('Owner Business', 'owner@example.test'));
  const created = await request(app).post('/api/v1/verification/applications').set((await auth(owner.token))).send(validInput).expect(201);
  const id = created.body.data.id;
  await request(app).put(`/api/v1/verification/applications/${id}`).set((await auth(owner.token))).send({ ...validInput, businessName: 'Changed' }).expect(409);
  await request(app).post(`/api/v1/verification/applications/${id}/submit`).set((await auth(owner.token))).expect(409);
  const saved = (await businessApplicationStore.findById(id))!;
  expect(saved.businessName).toBe(validInput.businessName);
  expect(saved.history).toHaveLength(1);
});

it('reuses the owner-scoped submission after a repeated delivery', async () => {
  const owner = (await business('Owner Business', 'owner@example.test'));
  const first = await request(app).post('/api/v1/verification/applications').set((await auth(owner.token))).send(validInput).expect(201);
  const repeated = await request(app).post('/api/v1/verification/applications').set((await auth(owner.token))).send(validInput).expect(200);
  expect(repeated.body.data.id).toBe(first.body.data.id);
  expect((await businessApplicationStore.findAll())).toHaveLength(1);
  expect((await businessApplicationStore.findAll())[0].history).toHaveLength(1);
});

it('rolls back a failed save and permits a safe retry with the same input', async () => {
  const owner = (await business('Owner Business', 'owner@example.test'));
  const rename = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('Synthetic disk failure'); });
  const failed = await request(app).post('/api/v1/verification/applications').set((await auth(owner.token))).send(validInput).expect(503);
  expect(failed.body.error.message).toBe('Application could not be saved. Your form is unchanged; please try again.');
  expect(JSON.stringify(failed.body)).not.toMatch(/Synthetic disk|applications\.json/);
  expect((await businessApplicationStore.findAll())).toHaveLength(0);
  rename.mockRestore();
  await request(app).post('/api/v1/verification/applications').set((await auth(owner.token))).send(validInput).expect(201);
  expect(new JsonStore<any>('applications.json', true, 'Application').findAll()).toHaveLength(1);
});
