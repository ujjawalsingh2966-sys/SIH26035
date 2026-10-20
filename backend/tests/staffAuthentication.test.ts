import { clearRepository } from './helpers/persistenceFixtures';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { randomBytes } from 'crypto';
import app from '../src/app';
import { config } from '../src/config/env';
import { staffStore, hashStaffPassword, verifyStaffPassword, createStaff, StaffAccount } from '../src/services/StaffService';
import { issueSession, sessionStore } from '../src/services/SessionService';
import { accountStore, createBusinessAccount } from '../src/services/AccountService';
import { resetLoginLimiter } from '../src/middlewares/loginLimiter';
import { JsonStore } from '../src/repositories/JsonStore';
import { testCaseStore } from '../src/repositories';

const password = randomBytes(24).toString('base64url');
let hash: string, admin: StaffAccount, tech: StaffAccount, reviewer: StaffAccount, adminToken: string;
const login = (email: string, secret = password, extra = {}) => request(app).post('/api/v1/auth/login').send({ email, password: secret, ...extra });
const me = (token: string) => request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
const provision = (body: object, token = adminToken) => request(app).post('/api/v1/staff').set('Authorization', `Bearer ${token}`).send(body);
const update = (body: object, id = tech.id) => request(app).patch(`/api/v1/staff/${id}`).set('Authorization', `Bearer ${adminToken}`).send(body);
const newInput = () => ({ name: 'New staff', email: 'new@example.test', password, role: 'Technician' });
beforeAll(async () => { hash = await hashStaffPassword(password); });
beforeEach(async () => {
  (await clearRepository(staffStore)); (await clearRepository(accountStore)); (await clearRepository(sessionStore)); (await clearRepository(testCaseStore)); resetLoginLimiter();
  const make = async (id: string, role: StaffAccount['role'], email: string) => (await staffStore.saveItem({ id, role, email,
    name: `Synthetic ${role}`, active: true, credentialVersion: 0, passwordHash: hash,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'test-fixture' }));
  admin = (await make('p1-admin', 'Administrator', 'operator@example.test'));
  tech = (await make('p1-tech', 'Technician', 'admin-reviewer-looking-tech@example.test'));
  reviewer = (await make('p1-reviewer', 'Reviewer', 'reader@example.test'));
  adminToken = (await issueSession(admin));
});
afterEach(() => jest.restoreAllMocks());

it.each(['Technician', 'Reviewer', 'Administrator'])('authenticates persisted %s without email role inference or secret disclosure', async role => {
  const account = (await staffStore.findAll()).find(item => item.role === role)!;
  const response = await login(account.email.toUpperCase()).expect(200);
  expect(response.body.data.user).toMatchObject({ id: account.id, role });
  expect(JSON.stringify(response.body.data.user)).not.toMatch(/passwordHash|credentialVersion|securityHistory/);
  const token = response.body.data.token;
  expect((await me(token).expect(200)).body.data).toEqual(response.body.data.user);
  expect(response.headers['cache-control']).toBe('no-store');
  const saved = new JsonStore<{ id: string }>('sessions.json', true).findAll();
  expect(JSON.stringify(saved)).not.toContain(token); expect(saved.length).toBeGreaterThan(0);
});
it('uses salted scrypt hashes at the intended work factor', async () => {
  expect(hash).toMatch(/^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  expect(await verifyStaffPassword(password, hash)).toBe(true);
  expect(await hashStaffPassword(password)).not.toBe(hash);
  expect(await verifyStaffPassword(password, 'corrupt')).toBe(false);
});
it.each(['wrong-password', 'dev-demo-password'])('rejects incorrect and removed demo credential %s', async secret => {
  await login(tech.email, secret).expect(401);
});
it('unknown admin-like email never creates an account or role', async () => {
  await login('unknown-admin@example.test').expect(401); expect((await staffStore.findAll())).toHaveLength(3);
});
it('inactive account has the same failure message and cannot access an existing session', async () => {
  const token = (await issueSession(tech)); (await staffStore.saveItem({ ...tech, active: false }));
  const response = await login(tech.email).expect(401); expect(response.body.error).toBe('Invalid email or password');
  await me(token).expect(401);
});
it.each([{ role: 'Administrator' }, { id: 'p1-admin' }, { active: true }])('rejects login role/identity payload %p', async extra => {
  await login(tech.email, password, extra).expect(400);
});
it.each(['Technician', 'Reviewer'])('denies %s staff provisioning/list/update/revocation', async role => {
  const token = (await issueSession((await staffStore.findAll()).find(item => item.role === role)!));
  await provision(newInput(), token).expect(403);
  await request(app).get('/api/v1/staff').set('Authorization', `Bearer ${token}`).expect(403);
  await request(app).patch(`/api/v1/staff/${tech.id}`).set('Authorization', `Bearer ${token}`).send({ role: 'Administrator' }).expect(403);
  await request(app).post(`/api/v1/staff/${tech.id}/revoke-sessions`).set('Authorization', `Bearer ${token}`).expect(403);
});
it('denies Business staff access without changing Business login or its password hash', async () => {
  const account = (await createBusinessAccount('Business owner', 'owner@example.test', password));
  const before = account.passwordHash;
  const token = (await login(account.email).expect(200)).body.data.token;
  await provision(newInput(), token).expect(403); await me(token).expect(200);
  expect((await accountStore.findById(account.id))!.passwordHash).toBe(before);
});
it('administrator creates an explicit role, normalized email and persistent unique ID', async () => {
  const response = await provision({ ...newInput(), email: ' NEW@EXAMPLE.TEST ', role: 'Reviewer' }).expect(201);
  expect(response.body.data).toMatchObject({ email: 'new@example.test', role: 'Reviewer', active: true, createdBy: admin.id });
  expect(response.body.data.id).not.toBe(admin.id);
  const stored = new JsonStore<StaffAccount>('staffAccounts.json', true).findById(response.body.data.id)!;
  expect(await verifyStaffPassword(password, stored.passwordHash)).toBe(true);
  expect(stored.securityHistory![0].action).toBe('PROVISIONED');
  await login('new@example.test').expect(200);
});
it.each(['Business', 'Applicant', '', 'administrator'])('rejects unsupported provisioned role %p', async role => {
  await provision({ ...newInput(), role }).expect(400);
});
it.each([{ id: 'p1-admin' }, { passwordHash: 'forged' }, { active: false }, { credentialVersion: -1 }])('rejects privileged provisioning fields %p', async extra => {
  await provision({ ...newInput(), ...extra }).expect(400);
});
it.each([{ password: 'short' }, { password: 'x'.repeat(129) }, { email: 'bad' }, { name: '' }])('validates staff provisioning %p', async extra => {
  await provision({ ...newInput(), ...extra }).expect(400);
});
it('enforces unique identities across staff, concurrent provisioning and Business registration', async () => {
  const responses = await Promise.all([provision(newInput()), provision(newInput())]);
  expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
  await request(app).post('/api/v1/auth/register').send({ ...newInput(), role: 'Business' }).expect(409);
  (await createBusinessAccount('Existing business', 'taken@example.test', password));
  await provision({ ...newInput(), email: 'taken@example.test' }).expect(409);
});
it('preserves legacy owner IDs only through explicit administrator adoption; no record edits', async () => {
  const now = new Date().toISOString();
  (await testCaseStore.saveItem({ id: 'legacy-case', instrumentId: 'legacy', technicianId: 'dev-user-01', status: 'DRAFT', createdAt: now, updatedAt: now, testConfiguration: {} as any }));
  const before = JSON.stringify((await testCaseStore.findAll()));
  const response = await provision({ ...newInput(), email: 'technician@example.com', adoptLegacyIdentity: true }).expect(201);
  expect(response.body.data.id).toBe('dev-user-01'); expect(JSON.stringify((await testCaseStore.findAll()))).toBe(before);
  await provision({ ...newInput(), email: 'no-legacy@example.test', adoptLegacyIdentity: true }).expect(400);
});
it.each([{ role: 'Administrator' }, { id: 'p1-admin' }, { email: 'changed@example.test' }, { credentialVersion: 0 }])('rejects immutable identity/role updates %p', async payload => {
  await update(payload).expect(400); expect((await staffStore.findById(tech.id))!.role).toBe('Technician');
});
it('deactivation and reactivation invalidate old credentials without erasing account history', async () => {
  const token = (await issueSession(tech));
  await update({ active: false }).expect(200); await me(token).expect(401);
  await update({ active: true }).expect(200); await me(token).expect(401); await login(tech.email).expect(200);
  expect((await staffStore.findById(tech.id))!.securityHistory!.map(item => item.action)).toEqual(['DEACTIVATED', 'ACTIVATED']);
});
it('prevents administrator self-deactivation and last-admin lockout', async () => {
  await update({ active: false }, admin.id).expect(409); expect((await staffStore.findById(admin.id))!.active).toBe(true);
});
it('password reset invalidates all prior sessions and permits only the new password', async () => {
  const tokens = [(await issueSession(tech)), (await issueSession(tech))]; const changed = randomBytes(24).toString('base64url');
  await update({ password: changed }).expect(200);
  for (const token of tokens) await me(token).expect(401);
  await login(tech.email).expect(401); await login(tech.email, changed).expect(200);
});
it('logout revokes just that session durably, and old-token replay is rejected', async () => {
  const one = (await issueSession(tech)), two = (await issueSession(tech));
  await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${one}`).expect(200);
  await me(one).expect(401); await me(two).expect(200);
  expect(new JsonStore<{ revokedAt?: string } & { id: string }>('sessions.json', true).findAll().some(item => item.revokedAt)).toBe(true);
});
it('administrator revoke-all rejects all sessions, but permits fresh login', async () => {
  const token = (await issueSession(tech));
  await request(app).post(`/api/v1/staff/${tech.id}/revoke-sessions`).set('Authorization', `Bearer ${adminToken}`).expect(200);
  await me(token).expect(401); await login(tech.email).expect(200);
});
it.each(['expired', 'invalid-signature', 'forged-role', 'missing-session', 'old-demo'])('rejects %s credentials', async type => {
  const token = (await issueSession(tech)); const claims = jwt.decode(token) as jwt.JwtPayload;
  if (type === 'expired') claims.exp = Math.floor(Date.now() / 1000) - 1;
  if (type === 'forged-role') claims.role = 'Administrator';
  if (type === 'missing-session') (await clearRepository(sessionStore));
  if (type === 'old-demo') delete claims.sid;
  const modified = jwt.sign(claims, type === 'invalid-signature' ? randomBytes(32).toString('hex') : config.jwtSecret, { algorithm: 'HS256' });
  await me(modified).expect(401);
});
it('rejects missing/deleted account sessions even with valid signatures', async () => {
  const token = (await issueSession(tech)); (await staffStore.deleteItem(tech.id)); await me(token).expect(401);
});
it('rolls back failed staff persistence and does not disclose credentials', async () => {
  const spy = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('disk-secret'); });
  const response = await provision(newInput()).expect(503); spy.mockRestore();
  expect(JSON.stringify(response.body)).not.toContain(password); expect(response.text).not.toContain('disk-secret');
  expect((await staffStore.findAll())).toHaveLength(3); await provision(newInput()).expect(201);
});
it('does not return a usable token when session persistence fails', async () => {
  jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('disk-secret'); });
  const before = (await sessionStore.findAll()).length;
  const response = await login(tech.email).expect(503);
  expect(response.body).not.toHaveProperty('data'); expect((await sessionStore.findAll())).toHaveLength(before);
});
it('logout persistence failure reports failure and allows a real retry', async () => {
  const token = (await issueSession(tech));
  const spy = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('disk-secret'); });
  await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`).expect(503); spy.mockRestore();
  await me(token).expect(200);
  await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`).expect(200); await me(token).expect(401);
});
it('rate-limits credential attempts with no credential echo', async () => {
  for (let index = 0; index < 20; index++) await request(app).post('/api/v1/auth/login').send({ email: tech.email }).expect(400);
  const response = await login(tech.email).expect(429); expect(response.headers['retry-after']).toBeDefined();
  expect(response.text).not.toContain(password);
});
it('bootstrap is offline-only, first-account-only and cannot override existing identities', async () => {
  await request(app).post('/api/v1/auth/bootstrap').send(newInput()).expect(404);
  await expect(createStaff({ ...newInput(), role: 'Administrator' }, 'offline', true)).rejects.toThrow('Bootstrap');
  (await clearRepository(staffStore));
  const created = await createStaff({ ...newInput(), role: 'Administrator' }, 'offline', true);
  expect(created.role).toBe('Administrator'); await login(created.email).expect(200);
});

it.each([undefined, 'short', 'dev-safe-secret-do-not-use-in-prod', '<replace-with-a-local-random-secret>'])('production refuses missing/unsafe signing configuration %p', value => {
  const previous = { mode: process.env.NODE_ENV, secret: process.env.JWT_SECRET };
  try {
    process.env.NODE_ENV = 'production';
    if (value === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = value;
    jest.isolateModules(() => { expect(() => require('../src/config/env')).toThrow('JWT_SECRET'); });
  } finally {
    process.env.NODE_ENV = previous.mode;
    if (previous.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.secret;
  }
});
