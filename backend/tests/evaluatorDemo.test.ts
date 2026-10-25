import request from "supertest";
import app from "../src/app";
import { accountStore } from "../src/services/AccountService";
import { testCaseStore } from "../src/repositories";
import { withinDemoWorkspace } from "../src/services/demoScope";

describe("evaluator demo isolation", () => {
  const previous = process.env.EVALUATOR_DEMO_ENABLED;
  beforeAll(() => { process.env.EVALUATOR_DEMO_ENABLED = "true"; });
  afterAll(() => { if (previous === undefined) delete process.env.EVALUATOR_DEMO_ENABLED; else process.env.EVALUATOR_DEMO_ENABLED = previous; });
  it("generates real role accounts with isolated sample cases", async () => {
    const first = await request(app).post("/api/v1/evaluator-demo/generate").expect(201);
    const second = await request(app).post("/api/v1/evaluator-demo/generate").expect(201);
    expect(first.body.data.credentials).toHaveLength(3);
    const a = first.body.data, b = second.body.data;
    expect(a.workspaceId).not.toEqual(b.workspaceId);
    const tech = a.credentials.find((c: any) => c.role === "Technician");
    const signin = await request(app).post("/api/v1/evaluator-demo/login").send(tech).expect(200);
    const token = signin.body.data.token;
    const own = await request(app).get("/api/v1/test-cases").set("Authorization", `Bearer ${token}`).expect(200);
    expect(own.body.data.length).toBeGreaterThan(0);
    expect(withinDemoWorkspace(a.workspaceId, () => testCaseStore.findAll()).length).toBe(5);
    expect(withinDemoWorkspace(b.workspaceId, () => accountStore.findAll()).length).toBe(3);
    const wrong = await request(app).post("/api/v1/evaluator-demo/login").send({ email: tech.email, password: "wrong" }).expect(401);
    expect(wrong.body.success).toBe(false);
    const secondCase = withinDemoWorkspace(b.workspaceId, () => testCaseStore.findAll()[0].id);
    await request(app).get(`/api/v1/test-cases/${secondCase}`).set("Authorization", `Bearer ${token}`).expect(404);
    const roleAttempt = await request(app).post("/api/v1/test-cases/" + own.body.data[0].id + "/workflow/approve").set("Authorization", `Bearer ${token}`).expect(403);
    expect(roleAttempt.body.success).toBe(false);
  });
});
