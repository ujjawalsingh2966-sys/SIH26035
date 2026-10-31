import request from "supertest";
import { randomUUID } from "crypto";
import app from "../../src/app";
import { accountStore, createAccount } from "../../src/services/AccountService";
import { demoSessionStore } from "../../src/services/DemoService";

const base = "/api/v1";
const start = () => request(app).post(base + "/auth/demo/start");

describe("24-hour evaluator demo and sandbox isolation", () => {
  it("issues one reusable browser demo ID and does not reset its expiry", async () => {
    const initial = await start().expect(200);
    const first = initial.body.data;
    expect(first.user.demo).toBe(true);
    expect(first.demo.role).toBe("Technician");
    expect(first.demo.availableRoles).toEqual(["Technician", "Reviewer", "Administrator"]);
    expect(Date.parse(first.demo.expiresAt) - Date.parse(first.demo.createdAt)).toBe(86400000);
    expect(first.demo.id).toMatch(/^W8-DEMO-[A-F0-9]{12}$/);

    const second = await start()
      .set("X-W8LAB-Demo-Token", first.token)
      .expect(200);
    expect(second.body.data.demo.id).toBe(first.demo.id);
    expect(second.body.data.demo.expiresAt).toBe(first.demo.expiresAt);

    const cookieHeader = initial.headers["set-cookie"];
    expect(cookieHeader).toBeDefined();
    const cookie = (Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader).split(";")[0];
    const third = await start().set("Cookie", cookie).expect(200);
    expect(third.body.data.demo.id).toBe(first.demo.id);
  });

  it("uses three role identities, enforces permissions and never leaks real records", async () => {
    const initial = (await start().expect(200)).body.data;
    const token = initial.token as string;
    const techMe = await request(app).get(base + "/auth/me").auth(token, { type: "bearer" }).expect(200);
    expect(techMe.body.data.demo).toBe(true);
    expect(techMe.body.data.demoId).toBe(initial.demo.id);

    const sample = await request(app).get(base + "/instruments")
      .auth(token, { type: "bearer" }).expect(200);
    expect(sample.body.data.some((i: any) => i.name === "Demo Electronic Scale")).toBe(true);
    const exampleId = sample.body.data.find((i: any) => i.name === "Demo Electronic Scale").id;

    const reviewer = (await request(app).post(base + "/auth/demo/switch")
      .auth(token, { type: "bearer" }).send({ role: "Reviewer" }).expect(200)).body.data;
    expect(reviewer.demo.id).toBe(initial.demo.id);
    expect(reviewer.demo.expiresAt).toBe(initial.demo.expiresAt);
    expect(reviewer.user.role).toBe("Reviewer");
    expect(reviewer.user.id).not.toBe(initial.user.id);

    await request(app).post(base + "/auth/staff")
      .auth(reviewer.token, { type: "bearer" })
      .send({ name: "Not allowed", email: "no@demo.invalid", password: "long-secret-123456", role: "Administrator" })
      .expect(403);

    const admin = (await request(app).post(base + "/auth/demo/switch")
      .auth(reviewer.token, { type: "bearer" }).send({ role: "Administrator" }).expect(200)).body.data;
    expect(admin.user.role).toBe("Administrator");
    const demoStaff = await request(app).get(base + "/auth/staff")
      .auth(admin.token, { type: "bearer" }).expect(200);
    expect(demoStaff.body.data).toHaveLength(3);
    expect(demoStaff.body.data.some((a: any) => a.email === "t1@example.com")).toBe(false);

    const demo2 = (await start().expect(200)).body.data;
    expect(demo2.demo.id).not.toBe(initial.demo.id);
    const secondSamples = await request(app).get(base + "/instruments")
      .auth(demo2.token, { type: "bearer" }).expect(200);
    expect(secondSamples.body.data.some((i: any) => i.id === exampleId)).toBe(false);

    const realTech = createAccount("Real tech", `real-${randomUUID()}@example.com`, "strong-real-password-123", "Technician");
    const normalLogin = await request(app).post(base + "/auth/login")
      .send({ email: realTech.email, password: "strong-real-password-123" }).expect(200);
    const normalList = await request(app).get(base + "/instruments")
      .auth(normalLogin.body.data.token, { type: "bearer" }).expect(200);
    expect(normalList.body.data.some((i: any) => i.id === exampleId)).toBe(false);

    const normalStaff = await request(app).post(base + "/auth/demo/switch")
      .auth(normalLogin.body.data.token, { type: "bearer" })
      .send({ role: "Administrator" }).expect(403);
    expect(accountStore.findById(initial.user.id)).toBeUndefined();
  });

  it("keeps demo disabled in production-style configuration, including existing tokens", async () => {
    const initial = (await start().expect(200)).body.data;
    const savedFlag = process.env.DEMO_ACCESS_ENABLED;
    process.env.DEMO_ACCESS_ENABLED = "false";
    try {
      await start().expect(404);
      await request(app).get(base + "/auth/me")
        .auth(initial.token, { type: "bearer" }).expect(401);
    } finally {
      if (savedFlag === undefined) delete process.env.DEMO_ACCESS_ENABLED;
      else process.env.DEMO_ACCESS_ENABLED = savedFlag;
    }
  });

  it("rejects unsupported role switching, expired sessions and replayed tokens", async () => {
    const first = (await start().expect(200)).body.data;
    await request(app).post(base + "/auth/demo/switch")
      .auth(first.token, { type: "bearer" }).send({ role: "Business" }).expect(400);

    // Simulate server-side expiry while the JWT itself still has time remaining.
    const registry = demoSessionStore.findAll().find(s => first.demo.id.endsWith(s.id.replace(/-/g, "").slice(0, 12).toUpperCase()));
    expect(registry).toBeDefined();
    demoSessionStore.saveItem({ ...registry!, expiresAt: new Date(Date.now() - 1000).toISOString() });
    await request(app).get(base + "/auth/me").auth(first.token, { type: "bearer" }).expect(401);
    await request(app).post(base + "/auth/demo/switch")
      .auth(first.token, { type: "bearer" }).send({ role: "Administrator" }).expect(401);
    const renewed = (await start().set("X-W8LAB-Demo-Token", first.token).expect(200)).body.data;
    expect(renewed.demo.id).not.toBe(first.demo.id);
    expect(demoSessionStore.findById(registry!.id)).toBeUndefined();
    const active = demoSessionStore.findAll().find(s => renewed.demo.id.endsWith(s.id.replace(/-/g, "").slice(0, 12).toUpperCase()));
    expect(active).toBeDefined();
  });
});
