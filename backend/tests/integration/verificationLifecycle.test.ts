import request from "supertest";
import app from "../../src/app";
import jwt from "jsonwebtoken";
import { config } from "../../src/config/env";
import {
  accountStore,
  createAccount,
  Role,
} from "../../src/services/AccountService";
import { applicationStore } from "../../src/services/VerificationService";

const password = "a-unique-test-password-123";
const base = "/api/v1/verification";
const instrument = {
  name: "Retail scale",
  model: "S-1",
  serialNumber: "S123",
  accuracyClass: "III",
  maxCapacity: "50000",
  minCapacity: "100",
  e: "5",
  d: "5",
  hasTare: false,
  isWeighing: true,
  isManual: true,
  isElectronic: true,
  isSingleRange: true,
};
const observations = ["WEIGHING", "ECCENTRICITY"].map((testType) => ({
  testType,
  load: "5000",
  indication: "5000",
  additionalWeights: "2.5",
  zeroError: "0",
}));
const future = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString();
let owner: string,
  stranger: string,
  admin: string,
  officer: string,
  otherOfficer: string,
  officerId: string;
async function account(role: Role, label: string) {
  const u = createAccount(label, `${label}@example.com`, password, role);
  const r = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: u.email, password })
    .expect(200);
  return { id: u.id, token: r.body.data.token as string };
}
async function apply() {
  const r = await request(app)
    .post(`${base}/applications`)
    .auth(owner, { type: "bearer" })
    .send({
      businessName: "Example Shop",
      address: "Private shop address",
      instrument,
    })
    .expect(201);
  return r.body.data.id as string;
}
async function schedule(id: string) {
  return request(app)
    .post(`${base}/applications/${id}/assign`)
    .auth(admin, { type: "bearer" })
    .send({ officerId, scheduledAt: future(1) })
    .expect(200);
}
async function inspect(id: string, rows = observations) {
  return request(app)
    .post(`${base}/applications/${id}/inspect`)
    .auth(officer, { type: "bearer" })
    .send({ notes: "Physical inspection complete", observations: rows });
}
async function certify(id: string) {
  return request(app)
    .post(`${base}/applications/${id}/certify`)
    .auth(officer, { type: "bearer" })
    .send({ validUntil: future(10) });
}
beforeAll(async () => {
  owner = (await account("Business", "owner")).token;
  stranger = (await account("Business", "stranger")).token;
  admin = (await account("Administrator", "admin")).token;
  const o = await account("LMO", "officer");
  officer = o.token;
  officerId = o.id;
  otherOfficer = (await account("GATC", "other-officer")).token;
});
beforeEach(() => applicationStore.clear());

describe("Real accounts and access boundaries", () => {
  it("registers a business, hashes its password and normalizes its unique email", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "New Business", email: "New@Example.com", password })
      .expect(201);
    expect(response.body.data).not.toHaveProperty("passwordHash");
    const user = accountStore.findById(response.body.data.id)!;
    expect(user.email).toBe("new@example.com");
    expect(user.passwordHash).not.toContain(password);
    await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Duplicate", email: "new@example.com", password })
      .expect(409);
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "new@example.com", password: "wrong-password" })
      .expect(401);
  });
  it("rejects public privilege escalation, missing accounts and the old demo login", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Intruder",
        email: "intruder@example.com",
        password,
        role: "Administrator",
      })
      .expect(403);
    await request(app)
      .post("/api/v1/auth/staff")
      .auth(owner, { type: "bearer" })
      .send({
        name: "Intruder",
        email: "intruder@example.com",
        password,
        role: "Administrator",
      })
      .expect(403);
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.com", password: "dev-demo-password" })
      .expect(401);
    const forged = jwt.sign(
      { id: "dev-user-01", role: "Administrator", email: "old@example.com" },
      config.jwtSecret,
    );
    await request(app)
      .get(`${base}/applications`)
      .auth(forged, { type: "bearer" })
      .expect(401);
    await request(app)
      .get("/api/v1/instruments")
      .auth(owner, { type: "bearer" })
      .expect(403);
  });
  it("lets only administrators create staff with distinct identities", async () => {
    const r = await request(app)
      .post("/api/v1/auth/staff")
      .auth(admin, { type: "bearer" })
      .send({
        name: "New officer",
        email: "new-officer@example.com",
        password,
        role: "GATC",
      })
      .expect(201);
    expect(r.body.data.id).not.toBe(officerId);
    expect(r.body.data.role).toBe("GATC");
  });
});
describe("Application to certificate", () => {
  it("completes the workflow, returns a QR, protects private fields and permits one renewal", async () => {
    const id = await apply();
    await schedule(id);
    await inspect(id).then((r) => expect(r.status).toBe(200));
    const issued = await certify(id);
    expect(issued.status).toBe(200);
    const token = issued.body.data.certificate.publicToken;
    const pub = await request(app)
      .get(`${base}/public/certificates/${token}`)
      .expect(200);
    expect(pub.body.data.status).toBe("VALID");
    expect(JSON.stringify(pub.body)).not.toContain("Private shop address");
    expect(pub.body.data).not.toHaveProperty("ownerId");
    expect(pub.body.data.disclaimer).toContain("PROTOTYPE");
    const certificate = await request(app)
      .get(`${base}/applications/${id}/certificate`)
      .auth(owner, { type: "bearer" })
      .expect(200);
    expect(certificate.body.data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(certificate.body.data.verificationUrl).toContain(token);
    await certify(id).then((r) => expect(r.status).toBe(409));
    await inspect(id).then((r) => expect(r.status).toBe(409));
    const payload = {
      businessName: "Example Shop",
      address: "Private shop address",
      instrument,
      previousApplicationId: id,
    };
    const renewed = await request(app)
      .post(`${base}/applications`)
      .auth(owner, { type: "bearer" })
      .send(payload)
      .expect(201);
    expect(renewed.body.data.type).toBe("REVERIFICATION");
    expect(renewed.body.data.instrument.id).toBe(
      issued.body.data.instrument.id,
    );
    await request(app)
      .post(`${base}/applications`)
      .auth(owner, { type: "bearer" })
      .send(payload)
      .expect(409);
    const alerts = await request(app)
      .get(`${base}/applications`)
      .auth(owner, { type: "bearer" })
      .expect(200);
    expect(alerts.body.data.alerts).toHaveLength(1);
  });
  it("enforces ownership, assignment and transition order", async () => {
    const id = await apply();
    await request(app)
      .get(`${base}/applications/${id}`)
      .auth(stranger, { type: "bearer" })
      .expect(404);
    const list = await request(app)
      .get(`${base}/applications`)
      .auth(stranger, { type: "bearer" })
      .expect(200);
    expect(list.body.data.applications).toHaveLength(0);
    await request(app)
      .post(`${base}/applications/${id}/assign`)
      .auth(owner, { type: "bearer" })
      .send({ officerId, scheduledAt: future(1) })
      .expect(403);
    await schedule(id);
    await certify(id).then((r) => expect(r.status).toBe(409));
    await request(app)
      .post(`${base}/applications/${id}/inspect`)
      .auth(otherOfficer, { type: "bearer" })
      .send({ notes: "Unauthorized", observations })
      .expect(404);
    await request(app)
      .get(`${base}/applications/${id}/certificate`)
      .auth(stranger, { type: "bearer" })
      .expect(404);
  });
  it("blocks missing test coverage and failing observations from certification", async () => {
    const id = await apply();
    await schedule(id);
    await inspect(id, observations.slice(0, 1)).then((r) =>
      expect(r.status).toBe(400),
    );
    await inspect(
      id,
      observations.map((o) => ({ ...o, indication: "5100" })),
    ).then((r) => expect(r.status).toBe(200));
    await certify(id).then((r) => expect(r.status).toBe(409));
    await request(app)
      .post(`${base}/applications/${id}/reject`)
      .auth(officer, { type: "bearer" })
      .send({ reason: "Failed inspection" })
      .expect(200);
    expect(applicationStore.findById(id)!.status).toBe("REJECTED");
  });
  it("rejects unsupported instruments, invalid parameters and dates", async () => {
    for (const change of [
      { accuracyClass: "I" },
      { isManual: false },
      { e: "0" },
      { minCapacity: "60000" },
      { d: "NaN" },
    ]) {
      await request(app)
        .post(`${base}/applications`)
        .auth(owner, { type: "bearer" })
        .send({
          businessName: "Shop",
          address: "Address",
          instrument: { ...instrument, ...change },
        })
        .expect(400);
    }
    const id = await apply();
    await request(app)
      .post(`${base}/applications/${id}/assign`)
      .auth(admin, { type: "bearer" })
      .send({ officerId, scheduledAt: future(-1) })
      .expect(400);
  });
  it("reports expiry dynamically and keeps public lookup narrow", async () => {
    const id = await apply();
    await schedule(id);
    await inspect(id);
    await certify(id);
    const stored = applicationStore.findById(id)!;
    stored.certificate!.validUntil = future(-1);
    applicationStore.saveItem(stored);
    const r = await request(app)
      .get(`${base}/public/certificates/${stored.certificate!.publicToken}`)
      .expect(200);
    expect(r.body.data.status).toBe("EXPIRED");
    await request(app)
      .get(`${base}/public/certificates/not-a-certificate`)
      .expect(404);
  });
});
