import fs from "fs";
import path from "path";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { config } from "../src/config/env";
import { demoWorkspaceFolder, readDemoMetadata, withinDemoWorkspace, DemoExpiredError } from "../src/services/demoScope";
import { cleanupExpiredEvaluatorWorkspaces } from "../src/services/EvaluatorDemoService";
import { accountStore } from "../src/services/AccountService";

describe("24-hour evaluator expiration", () => {
  let enabled: string | undefined;
  beforeAll(() => { enabled = process.env.EVALUATOR_DEMO_ENABLED; process.env.EVALUATOR_DEMO_ENABLED = "true"; });
  afterAll(() => {
    if (enabled === undefined) delete process.env.EVALUATOR_DEMO_ENABLED;
    else process.env.EVALUATOR_DEMO_ENABLED = enabled;
  });

  it("enforces one immutable 24-hour window for all three roles, even with existing JWTs", async () => {
    const provision = await request(app).post("/api/v1/evaluator-demo/generate").expect(201);
    const { workspaceId, expiresAt, credentials } = provision.body.data;
    expect(credentials).toHaveLength(3);
    const metadata = readDemoMetadata(workspaceId)!;
    expect(Date.parse(expiresAt) - Date.parse(metadata.createdAt)).toBe(86400000);
    const tokens: string[] = [];
    for (const credential of credentials) {
      const r = await request(app).post("/api/v1/evaluator-demo/login").send(credential).expect(200);
      expect(r.body.data.expiresAt).toBe(expiresAt);
      const parsed: any = jwt.decode(r.body.data.token);
      expect(parsed.exp * 1000).toBeLessThanOrEqual(Date.parse(expiresAt) + 1000);
      tokens.push(r.body.data.token);
      await request(app).get("/api/v1/auth/me").auth(r.body.data.token, { type: "bearer" }).expect(200);
    }

    const realDateNow = Date.now;
    try {
      Date.now = () => Date.parse(expiresAt) - 1000;
      expect(withinDemoWorkspace(workspaceId, () => accountStore.findAll())).toHaveLength(3);
      Date.now = () => Date.parse(expiresAt);
      for (const token of tokens) {
        const r = await request(app).get("/api/v1/auth/me").auth(token, { type: "bearer" }).expect(401);
        expect(r.body.code).toBe("DEMO_EXPIRED");
      }
      for (const credential of credentials) {
        const r = await request(app).post("/api/v1/evaluator-demo/login").send(credential).expect(401);
        expect(r.body.code).toBe("DEMO_EXPIRED");
      }
      expect(() => withinDemoWorkspace(workspaceId, () => accountStore.findAll())).toThrow(DemoExpiredError);
      expect(cleanupExpiredEvaluatorWorkspaces()).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(demoWorkspaceFolder(workspaceId))).toBe(false);
      expect(fs.existsSync(path.join(process.env.DATA_DIR!, "accounts.json"))).toBe(true);
      expect(() => withinDemoWorkspace(workspaceId, () => accountStore.findAll())).toThrow(DemoExpiredError);
    } finally {
      Date.now = realDateNow;
    }
  });
});
