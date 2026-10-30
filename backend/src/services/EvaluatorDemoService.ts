import fs from "fs";
import path from "path";
import { randomBytes, randomUUID } from "crypto";
import { createAccount, Role } from "./AccountService";
import { withinDemoWorkspace, demoRoot, demoWorkspaceFolder, readDemoMetadata } from "./demoScope";
import { JsonStore } from "../repositories/JsonStore";
import { instrumentStore, manufacturerStore, observationStore, testCaseStore } from "../repositories";
import { Instrument, TestCase } from "../types/domain";
import { EvaluationService } from "./EvaluationService";
import { WorkflowService } from "./WorkflowService";

const root = demoRoot;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const lifetimeMs = 24 * 60 * 60 * 1000;
const maximumActiveWorkspaces = 100;

interface WorkspaceMetadata {
  id: string;
  createdAt: string;
  expiresAt: string;
}

export interface DemoCredential {
  role: "Technician" | "Reviewer" | "Administrator";
  email: string;
  password: string;
}

export function evaluatorDemoEnabled(): boolean {
  // An explicit operator opt-in is required; no default or frontend flag enables it.
  return process.env.EVALUATOR_DEMO_ENABLED === "true";
}

function metadataPath(id: string) {
  return path.join(demoWorkspaceFolder(id), "workspace.json");
}
export function workspaceMetadata(id: string): WorkspaceMetadata | null {
  const m = readDemoMetadata(id);
  return m && Date.now() < Date.parse(m.expiresAt) ? m : null;
}

export function workspaceFromDemoEmail(email: string): string | null {
  const match = /^(tech|review|admin)-([0-9a-f-]{36})@demo\.w8lab\.test$/i.exec(email.trim().toLowerCase());
  return match && uuidPattern.test(match[2]) ? match[2] : null;
}

export function cleanupExpiredEvaluatorWorkspaces(): number {
  if (!fs.existsSync(root)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !uuidPattern.test(entry.name)) continue;
    if (!workspaceMetadata(entry.name)) {
      try {
        fs.rmSync(demoWorkspaceFolder(entry.name), { recursive: true, force: true });
        JsonStore.evictDemoWorkspace(entry.name);
        removed++;
      } catch (error) {
        console.error("Failed to delete expired demo workspace", entry.name, error);
      }
    }
  }
  return removed;
}

function seedWorkspace(technicianId: string, reviewerId: string) {
  const now = new Date().toISOString();
  const manufacturerId = randomUUID();
  const instrumentId = randomUUID();

  manufacturerStore.saveItem({
    id: manufacturerId,
    name: "W8LAB Demo Weighing Systems",
    address: "Sample laboratory data — not a real manufacturer address",
    identifier: "DEMO-NAWI-001",
  });
  const instrument: Instrument = instrumentStore.saveItem({
    id: instrumentId,
    manufacturerId,
    name: "Demo Electronic Platform Scale",
    model: "SIH-R76-DEMO",
    serialNumber: "SAMPLE-0001",
    isWeighing: true,
    isManual: true,
    isElectronic: true,
    isSingleRange: true,
    accuracyClass: "III",
    maxCapacity: "30000",
    minCapacity: "200",
    e: "10",
    d: "10",
    hasTare: false,
  });

  function newCase(status: "DRAFT" | "TESTING", label: string): TestCase {
    return testCaseStore.saveItem({
      id: randomUUID(),
      instrumentId,
      technicianId,
      status,
      createdAt: now,
      updatedAt: now,
      reviewNotes: label,
      testConfiguration: {
        weighing: "NOT STARTED",
        eccentricity: "NOT STARTED",
        repeatability: "NOT STARTED",
        tare: "NOT APPLICABLE",
        zeroSetting: "NOT STARTED",
      },
      laboratoryConditions: { temperature: "22", humidity: "48", pressure: "1013" },
    });
  }

  newCase("DRAFT", "Sample: start testing, then enter observations");
  newCase("TESTING", "Sample: add test observations");

  for (const scenario of ["READY", "CORRECTION", "APPROVED"] as const) {
    const testCase = newCase("TESTING", `Sample: ${scenario.toLowerCase()}`);
    // Seed using the actual evaluation and workflow engine, not a forged PASS verdict.
    const evaluation = EvaluationService.evaluateObservation(
      instrument,
      {
        testType: "WEIGHING",
        load: "1000",
        indication: "1000",
        additionalWeights: "0",
        zeroError: "0",
        unit: "g",
      },
      true,
    );
    observationStore.saveItem({
      id: randomUUID(),
      testCaseId: testCase.id,
      testType: "WEIGHING",
      sequence: 1,
      load: "1000",
      indication: "1000",
      additionalWeights: "0",
      zeroError: "0",
      unit: "g",
      evaluation,
    });
    WorkflowService.submitForReview(testCase.id, technicianId, "Technician");
    if (scenario !== "READY") {
      WorkflowService.startReview(testCase.id, reviewerId, "Reviewer");
      if (scenario === "CORRECTION") {
        WorkflowService.returnForCorrection(testCase.id, reviewerId, "Reviewer", "Demo feedback: verify the recorded observation.");
      } else {
        WorkflowService.approve(testCase.id, reviewerId, "Reviewer");
      }
    }
  }
}

export function provisionEvaluatorWorkspace(): {
  workspaceId: string;
  expiresAt: string;
  credentials: DemoCredential[];
} {
  if (!evaluatorDemoEnabled()) throw new Error("Evaluator demo is not enabled");
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  cleanupExpiredEvaluatorWorkspaces();
  const active = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && uuidPattern.test(entry.name) && !!workspaceMetadata(entry.name))
    .length;
  if (active >= maximumActiveWorkspaces) {
    throw new Error("Demo capacity reached. Contact the W8LAB team.");
  }

  const id = randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + lifetimeMs).toISOString();
  const directory = path.join(root, id);
  fs.mkdirSync(directory, { recursive: false, mode: 0o700 });
  fs.writeFileSync(metadataPath(id), JSON.stringify({
    id, createdAt: createdAt.toISOString(), expiresAt,
  } satisfies WorkspaceMetadata), { flag: "wx", mode: 0o600 });

  try {
    const credentials = withinDemoWorkspace(id, () => {
      const definitions: { role: DemoCredential["role"]; prefix: string; name: string }[] = [
        { role: "Technician", prefix: "tech", name: "SIH Demo Lab Technician" },
        { role: "Reviewer", prefix: "review", name: "SIH Demo Reviewing Officer" },
        { role: "Administrator", prefix: "admin", name: "SIH Demo System Administrator" },
      ];
      const created = definitions.map(({ role, prefix, name }) => {
        const email = `${prefix}-${id}@demo.w8lab.test`;
        const password = randomBytes(24).toString("base64url");
        const account = createAccount(name, email, password, role as Role);
        return { role, email, password, accountId: account.id };
      });
      seedWorkspace(created[0].accountId, created[1].accountId);
      return created.map(({ role, email, password }) => ({ role, email, password }));
    });
    return { workspaceId: id, expiresAt, credentials };
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    JsonStore.evictDemoWorkspace(id);
    throw error;
  }
}
