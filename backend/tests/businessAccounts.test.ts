import { clearRepository } from './helpers/persistenceFixtures';
import fs from 'fs';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { config } from '../src/config/env';
import { accountStore, checkPassword, createBusinessAccount } from '../src/services/AccountService';
import { JsonStore } from '../src/repositories/JsonStore';
import { logger } from '../src/utils/logger';
import { auditStore, testCaseStore } from '../src/repositories';
import { evidenceStore } from '../src/services/EvidenceService';
import { developmentStaffId } from '../src/services/DevelopmentStaffIdentity';
import { developmentStaffPassword, provisionLegacyTestStaff } from './helpers/developmentStaffPassword';
import { issueSession } from '../src/services/SessionService';

const password = 'Synthetic-account-pass-123';
const demoPassword = developmentStaffPassword();
const input = { name: 'Synthetic Business', email: 'business-account@example.test', password };
const register = (body: Record<string, unknown> = input) => request(app).post('/api/v1/auth/register').send(body);
const login = (body: Record<string, unknown> = { email: input.email, password }) => request(app).post('/api/v1/auth/login').send(body);

beforeEach(async () => { (await clearRepository(accountStore)); await provisionLegacyTestStaff(); });
afterEach(() => jest.restoreAllMocks());

it('registers only Business, normalizes identity, persists salted hashes and omits private fields', async () => {
  const response = await register({ ...input, name: ' Synthetic Business ', email: ' BUSINESS-ACCOUNT@EXAMPLE.TEST ', id: 'forged', active: false, passwordHash: 'forged' }).expect(201);
  expect(response.body.data).toMatchObject({ name: input.name, email: input.email, role: 'Business', active: true });
  expect(response.body.data.id).not.toBe('forged');
  expect(response.body.data).not.toHaveProperty('passwordHash');
  const saved = new JsonStore('accounts.json', true).findAll() as Awaited<ReturnType<typeof accountStore.findAll>>;
  expect(saved).toHaveLength(1);
  expect(saved[0].passwordHash).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/);
  expect(saved[0].passwordHash).not.toContain(password);
  expect(checkPassword(password, saved[0].passwordHash)).toBe(true);
  expect((await createBusinessAccount('Other business', 'other@example.test', password)).passwordHash).not.toEqual(saved[0].passwordHash);
});

it.each(['Technician', 'Reviewer', 'Administrator', 'LMO', 'GATC', '', null, ['Business']])('rejects a registration role payload %p', async role => {
  await register({ ...input, role }).expect(403);
  expect((await accountStore.findAll())).toHaveLength(0);
});

it('accepts an explicit Business role and rejects case-insensitive duplicate registration', async () => {
  await register({ ...input, role: 'Business' }).expect(201);
  await register({ ...input, email: input.email.toUpperCase() }).expect(409);
  expect((await accountStore.findAll())).toHaveLength(1);
});

it.each([
  { ...input, name: ' ' }, { ...input, name: 'x'.repeat(121) },
  { ...input, email: 'invalid' }, { ...input, email: ['business@example.test'] },
  { ...input, password: 'short' }, { ...input, password: 'x'.repeat(129) },
  { email: input.email }, { ...input, password: { nested: password } }
])('returns safe validation errors and does not log credential values', async body => {
  const warning = jest.spyOn(logger, 'warn');
  const response = await register(body).expect(400);
  expect(response.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path: expect.any(String), msg: expect.any(String) })]));
  expect(JSON.stringify(response.body)).not.toContain(password);
  expect(JSON.stringify(warning.mock.calls)).not.toContain(password);
  expect(response.body.errors.every((error: object) => !('value' in error))).toBe(true);
  expect((await accountStore.findAll())).toHaveLength(0);
});

it('authenticates the persisted account and resolves /me without exposing its hash', async () => {
  const created = await register().expect(201);
  const response = await login({ email: input.email.toUpperCase(), password }).expect(200);
  expect(response.body.data.user).toEqual(created.body.data);
  const decoded = jwt.verify(response.body.data.token, config.jwtSecret) as jwt.JwtPayload;
  expect(decoded).toMatchObject({ id: created.body.data.id, role: 'Business' });
  expect(decoded.exp! - decoded.iat!).toBe(8 * 60 * 60);
  const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${response.body.data.token}`).expect(200);
  expect(me.body.data).toEqual(created.body.data);
  expect(JSON.stringify(me.body)).not.toContain('passwordHash');
  await request(app).get('/api/v1/auth/me').expect(401);
});

it('does not fall back to staff demo authentication for a registered Business email', async () => {
  (await createBusinessAccount(input.name, 'admin-reviewer-business@example.test', password));
  const response = await login({ email: 'admin-reviewer-business@example.test', password }).expect(200);
  expect(response.body.data.user.role).toBe('Business');
  // Read the existing local development default without copying it into this test.
  await login({ email: 'admin-reviewer-business@example.test', password: demoPassword }).expect(401);
});

it('rejects wrong passwords, inactive/missing Business identities and malformed hashes', async () => {
  const account = (await createBusinessAccount(input.name, input.email, password));
  await login({ email: input.email, password: 'wrong-password' }).expect(401);
  (await accountStore.saveItem({ ...account, active: false }));
  await login().expect(401);
  const token = (await issueSession(account));
  await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  (await clearRepository(accountStore));
  await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  expect(checkPassword(password, 'bad-hash')).toBe(false);
});

it('surfaces a failed account save, rolls back memory and permits a safe retry', async () => {
  const rename = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('Synthetic disk failure'); });
  const response = await register().expect(503);
  expect(response.body.error).toBe('Account could not be saved. Please try again.');
  expect(JSON.stringify(response.body)).not.toMatch(/Synthetic disk|passwordHash|accounts\.json/);
  expect((await accountStore.findAll())).toHaveLength(0);
  expect(new JsonStore('accounts.json', true).findAll()).toHaveLength(0);
  rename.mockRestore();
  await register().expect(201);
  await login().expect(200);
  expect(new JsonStore('accounts.json', true).findAll()).toHaveLength(1);
});

it.each([
  ['get', '/manufacturers'], ['get', '/instruments'], ['post', '/instruments'],
  ['get', '/test-cases'], ['post', '/test-cases'], ['get', '/test-cases/unknown/workspace'],
  ['post', '/test-cases/unknown/workflow/approve'], ['post', '/observations'],
  ['delete', '/observations/unknown'], ['post', '/evidence'],
  ['get', '/reports/unknown/data'], ['get', '/reports/unknown/html'], ['get', '/reports/unknown/pdf'],
  ['get', '/repository/search'], ['get', '/repository/dashboard']
])('denies Business access to staff operation %s %s', async (method, endpoint) => {
  const account = (await createBusinessAccount(input.name, input.email, password));
  const token = (await issueSession(account));
  const response = await (request(app) as any)[method](`/api/v1${endpoint}`).set('Authorization', `Bearer ${token}`).expect(403);
  expect(response.body).toEqual({ success: false, error: 'Forbidden: Insufficient permissions' });
});

it('keeps explicitly provisioned legacy roles, stable identities and /me behavior intact', async () => {
  const guide = fs.readFileSync(require('path').resolve(__dirname, '../../docs/LABORATORY_REVIEW_WORKFLOW.md'), 'utf8');
  const accounts = [...guide.matchAll(/\| (Technician|Reviewer|Administrator) \| `([^`]+)`/g)];
  expect(accounts).toHaveLength(3);
  for (const [, role, email] of accounts) {
    const response = await login({ email, password: demoPassword }).expect(200);
    expect(response.body.data.user.role).toBe(role);
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${response.body.data.token}`).expect(200);
    expect(me.body.data).toEqual(response.body.data.user);
    if (role === 'Technician') expect(me.body.data.id).toBe('dev-user-01');
  }
});

it.each(['technician@example.com', 'technician2@example.com', 'reviewer@example.com', 'admin@example.com'])('reserves documented staff identity %s', async email => {
  await register({ ...input, email: email.toUpperCase() }).expect(409);
  expect((await accountStore.findAll())).toHaveLength(0);
});

it.each(['technician', 'reviewer', 'audit', 'evidence'])('reserves a staff identity referenced by %s records', async reference => {
  const email = `existing-${reference}@example.test`;
  const id = developmentStaffId(email);
  if (reference === 'technician' || reference === 'reviewer') {
    (await testCaseStore.saveItem({ id: `staff-${reference}`, instrumentId: 'synthetic', technicianId: reference === 'technician' ? id : 'other', reviewerId: reference === 'reviewer' ? id : undefined, status: 'DRAFT', createdAt: '', updatedAt: '', testConfiguration: {} as any }));
  } else if (reference === 'audit') {
    (await auditStore.saveItem({ id: 'staff-audit', testCaseId: 'synthetic', actorId: id, actorRole: 'Reviewer', action: 'SYNTHETIC', timestamp: '' }));
  } else {
    (await evidenceStore.saveItem({ id: 'staff-evidence', testCaseId: 'synthetic', uploadedBy: id } as any));
  }
  await register({ ...input, email }).expect(409);
  expect((await accountStore.findAll())).toHaveLength(0);
});

it('persists one account for overlapping duplicate registration requests', async () => {
  const responses = await Promise.all([register(), register()]);
  expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
  expect(new JsonStore('accounts.json', true).findAll()).toHaveLength(1);
});
