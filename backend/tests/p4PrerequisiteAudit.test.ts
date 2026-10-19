// P4 Step 0 prerequisite checks. These expectations deliberately fail while
// P3 accepts malformed profile enums; do not change them to accept that behavior.
// All accounts and records use Jest's isolated temporary JSON storage.
import request from 'supertest';
import { randomBytes } from 'crypto';
import app from '../src/app';
import { createStaff } from '../src/services/StaffService';

let token: string, instrumentId: string;
const profile = {
  purpose: 'TYPE_EVALUATION', indication: 'DIGITAL', zeroDevices: ['SEMI_AUTOMATIC'],
  initialZeroSetting: false, eccentricityPossible: true, loadReceptor: 'PLATFORM',
  supportPoints: 4, evidenceReference: 'SYNTHETIC P4 prerequisite audit only',
};
beforeAll(async () => {
  const password = randomBytes(24).toString('base64url');
  const administrator = await createStaff({ name: 'Synthetic audit administrator', email: 'p4-admin@example.test', password, role: 'Administrator' }, 'offline-bootstrap', true);
  const adminLogin = await request(app).post('/api/v1/auth/login').send({ email: administrator.email, password }).expect(200);
  await request(app).post('/api/v1/staff').set('Authorization', `Bearer ${adminLogin.body.data.token}`)
    .send({ name: 'Synthetic audit technician', email: 'p4-tech@example.test', password, role: 'Technician' }).expect(201);
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'p4-tech@example.test', password }).expect(200);
  token = login.body.data.token;
  const maker = await request(app).post('/api/v1/manufacturers').set('Authorization', `Bearer ${token}`)
    .send({ name: 'Synthetic prerequisite manufacturer', identifier: 'P4-AUDIT', address: 'Isolated test laboratory' }).expect(201);
  const instrument = await request(app).post('/api/v1/instruments').set('Authorization', `Bearer ${token}`).send({
    manufacturerId: maker.body.data.id, name: 'Synthetic audit scale', model: 'P4-AUDIT', serialNumber: 'P4-AUDIT-1',
    accuracyClass: 'III', maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', weighingUnit: 'g',
    hasTare: false, isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true,
    hasAuxiliaryIndication: false, isGrading: false, softwareControlled: false,
  }).expect(201);
  instrumentId = instrument.body.data.id;
}, 20000);

async function declare(patch: Record<string, unknown> = {}) {
  const created = await request(app).post('/api/v1/test-cases').set('Authorization', `Bearer ${token}`).send({ instrumentId }).expect(201);
  return request(app).put(`/api/v1/native/${created.body.data.id}/programme`).set('Authorization', `Bearer ${token}`)
    .send({ expectedRevision: 0, profile: { ...profile, ...patch } });
}

it('valid type-evaluation profile retains two ten-reading series for Max below 1000 kg', async () => {
  const response = await declare(); expect(response.status).toBe(200);
  expect(response.body.data.decisions.find((row: any) => row.id === 'REPEATABILITY').samples).toEqual([
    { series: 'HALF_MAX', loadG: '7500', count: 10, minimumOnly: false },
    { series: 'MAX', loadG: '15000', count: 10, minimumOnly: false },
  ]);
});

it.each([
  ['purpose', ['TYPE_EVALUATION']],
  ['indication', ['DIGITAL']],
  ['loadReceptor', ['PLATFORM']],
])('rejects array-valued %s instead of storing an invalid enum and choosing the wrong programme', async (field, value) => {
  const response = await declare({ [field as string]: value });
  const repeat = response.body.data?.decisions.find((row: any) => row.id === 'REPEATABILITY');
  // Keep failure output limited to non-sensitive diagnostic fields.
  expect({ status: response.status, storedValue: response.body.data?.profile?.[field as string], samples: repeat?.samples })
    .toEqual({ status: 400, storedValue: undefined, samples: undefined });
});

it('rejects a malformed service-inspection purpose before it can enable unsupported zero accuracy', async () => {
  const created = await request(app).post('/api/v1/test-cases').set('Authorization', `Bearer ${token}`).send({ instrumentId }).expect(201);
  const id = created.body.data.id;
  const declaration = await request(app).put(`/api/v1/native/${id}/programme`).set('Authorization', `Bearer ${token}`)
    .send({ expectedRevision: 0, profile: { ...profile, purpose: ['IN_SERVICE_INSPECTION'] } });
  let saved;
  if (declaration.status === 200) {
    await request(app).put(`/api/v1/test-cases/${id}/status`).set('Authorization', `Bearer ${token}`)
      .send({ status: 'TESTING', expectedRevision: 1 }).expect(200);
    saved = await request(app).put(`/api/v1/native/${id}/tests/ZERO_SEMI_AUTOMATIC/ACCURACY`).set('Authorization', `Bearer ${token}`).send({
      expectedRevision: 2, submission: {
        procedureId: 'ZERO_SEMI_AUTOMATIC', series: 'ACCURACY',
        readings: [{ sequence: 1, load: '0', indication: '0', additionalWeights: '1.25', unit: 'g' }],
        conditions: { stable: true, sufficientAccuracy: true, zeroInitiatedNearChangeover: true },
        evidenceReference: 'SYNTHETIC unsupported-purpose probe, not actual laboratory observations',
      },
    });
  }
  expect({ declarationStatus: declaration.status,
    zeroApplicability: declaration.body.data?.decisions.find((row: any) => row.id === 'ZERO_SEMI_AUTOMATIC')?.applicability,
    saveStatus: saved?.status, verdict: saved?.body.data?.result.status,
  }).toEqual({ declarationStatus: 400, zeroApplicability: undefined, saveStatus: undefined, verdict: undefined });
});
