import request from 'supertest';
import app from '../../src/app';
import { createAccount } from '../../src/services/AccountService';
import { instrumentStore, auditStore } from '../../src/repositories';

it('uses real account identities with the merged workspace and deletion endpoints', async () => {
  const password = 'integration-password-123';
  const technician = createAccount('Lab Technician', 'integration-tech@example.com', password, 'Technician');
  const other = createAccount('Other Technician', 'integration-other@example.com', password, 'Technician');
  async function login(email: string) {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
    return res.body.data.token as string;
  }
  const token = await login(technician.email);
  const otherToken = await login(other.email);
  instrumentStore.saveItem({
    id: 'integration-scale', manufacturerId: 'integration-maker', name: 'Scale', model: 'S1', serialNumber: 'S1',
    isWeighing: true, isElectronic: true, isManual: true, isSingleRange: true,
    accuracyClass: 'III', maxCapacity: '50000', minCapacity: '100', e: '5', d: '5', hasTare: false,
  });
  const created = await request(app).post('/api/v1/test-cases').auth(token, { type: 'bearer' })
    .send({ instrumentId: 'integration-scale' }).expect(201);
  const id = created.body.data.id;
  expect(created.body.data.technicianId).toBe(technician.id);
  await request(app).get(`/api/v1/test-cases/${id}`).auth(otherToken, { type: 'bearer' }).expect(403);
  await request(app).put(`/api/v1/test-cases/${id}/status`).auth(token, { type: 'bearer' })
    .send({ status: 'TESTING' }).expect(200);
  const loaded = await request(app).get(`/api/v1/test-cases/${id}`).auth(token, { type: 'bearer' }).expect(200);
  expect(loaded.body.data.status).toBe('TESTING');
  const observation = await request(app).post('/api/v1/observations').auth(token, { type: 'bearer' })
    .send({ testCaseId: id, testType: 'WEIGHING', sequence: 1, load: '5000', indication: '5000', additionalWeights: '2.5', zeroError: '0' }).expect(201);
  await request(app).delete(`/api/v1/observations/${observation.body.data.id}`).auth(otherToken, { type: 'bearer' }).expect(403);
  await request(app).delete(`/api/v1/observations/${observation.body.data.id}`).auth(token, { type: 'bearer' }).expect(200);
  expect(auditStore.findAll().some(event => event.action === 'OBSERVATION_DELETED' && event.actorId === technician.id)).toBe(true);
});
