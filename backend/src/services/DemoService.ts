import { randomBytes, randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { JsonStore } from "../repositories/JsonStore";
import { manufacturerStore, instrumentStore, testCaseStore } from "../repositories";
import { accountStore, createAccount, publicAccount } from "./AccountService";
import { runInDemoScope } from "./DemoScope";

export const demoRoles = ["Technician", "Reviewer", "Administrator"] as const;
export type DemoRole = (typeof demoRoles)[number];
export const DEMO_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const DEMO_COOKIE = "w8lab_evaluator";

export interface DemoSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  accounts: Record<DemoRole, string>;
  active: boolean;
}
/** This registry is deliberately unscoped: it controls access to namespaces. */
export const demoSessionStore = new JsonStore<DemoSession>("demoSessions.json");

type DemoJwt = jwt.JwtPayload & {
  demo?: boolean; demoId?: string; id?: string; role?: string; email?: string;
};

export function isDemoAccessEnabled() {
  return process.env.DEMO_ACCESS_ENABLED === "true" ||
    (config.nodeEnv !== "production" && process.env.DEMO_ACCESS_ENABLED !== "false");
}

export function activeDemoSession(id: string): DemoSession | null {
  const session = demoSessionStore.findById(id);
  return session && session.active && Date.parse(session.expiresAt) > Date.now()
    ? session : null;
}

export function verifyDemoToken(token: string): { session: DemoSession; role: DemoRole } | null {
  try {
    const claims = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"], audience: "w8lab-demo",
    }) as DemoJwt;
    if (claims.demo !== true || typeof claims.demoId !== "string" ||
      !demoRoles.includes(claims.role as DemoRole)) return null;
    const session = activeDemoSession(claims.demoId);
    if (!session || session.accounts[claims.role as DemoRole] !== claims.id) return null;
    return { session, role: claims.role as DemoRole };
  } catch {
    return null;
  }
}

function accessFor(session: DemoSession, role: DemoRole) {
  if (!activeDemoSession(session.id)) throw new Error("Demo session expired");
  return runInDemoScope(session.id, () => {
    const user = accountStore.findById(session.accounts[role]);
    if (!user || !user.active || user.role !== role) throw new Error("Demo account unavailable");
    // JWT expires at the original session deadline, including after a role switch.
    const seconds = Math.max(1, Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000));
    const token = jwt.sign({
      demo: true, demoId: session.id, id: user.id, role, email: user.email,
    }, config.jwtSecret, { algorithm: "HS256", audience: "w8lab-demo", expiresIn: seconds });
    return {
      token,
      user: { ...publicAccount(user), demo: true, demoId: demoReference(session.id),
        demoExpiresAt: session.expiresAt },
      demo: {
        id: demoReference(session.id),
        role,
        availableRoles: [...demoRoles],
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      },
    };
  });
}

function demoReference(id: string) {
  return "W8-DEMO-" + id.replace(/-/g, "").slice(0, 12).toUpperCase();
}

/**
 * Generate a single sandbox shared across three genuine role identities.
 * Passwords remain random and unavailable: roles can only be chosen through
 * authenticated server-side session switching, not the real login endpoint.
 */
export function createDemoSession() {
  const now = Date.now();
  const id = randomUUID();
  const accounts = runInDemoScope(id, () => {
    const password = randomBytes(36).toString("base64url");
    const suffix = id.replace(/-/g, "");
    const technician = createAccount("Demo Lab Technician",
      `tech-${suffix}@demo.w8lab.invalid`, password, "Technician");
    const reviewer = createAccount("Demo Reviewing Officer",
      `review-${suffix}@demo.w8lab.invalid`, password, "Reviewer");
    const admin = createAccount("Demo System Administrator",
      `admin-${suffix}@demo.w8lab.invalid`, password, "Administrator");
    // Demo-only sample data is labelled and never added to the production store.
    const manufacturerId = randomUUID();
    const instrumentId = randomUUID();
    manufacturerStore.saveItem({
      id: manufacturerId, name: "W8LAB Demo Manufacturer",
      address: "Demonstration data — not a real address", identifier: "DEMO-MFR",
    });
    instrumentStore.saveItem({
      id: instrumentId, manufacturerId, name: "Demo Electronic Scale",
      model: "DEMO-III", serialNumber: "DEMO-0001",
      isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true,
      accuracyClass: "III", maxCapacity: "50000", minCapacity: "100",
      e: "5", d: "5", hasTare: false,
    });
    testCaseStore.saveItem({
      id: randomUUID(), instrumentId, technicianId: technician.id,
      status: "DRAFT", createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      testConfiguration: {
        weighing: "NOT STARTED", eccentricity: "NOT STARTED",
        repeatability: "NOT STARTED", tare: "NOT APPLICABLE", zeroSetting: "NOT STARTED",
      },
    });
    return {
      Technician: technician.id, Reviewer: reviewer.id, Administrator: admin.id,
    };
  });
  const session = demoSessionStore.saveItem({
    id, active: true, accounts, createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DEMO_LIFETIME_MS).toISOString(),
  });
  return accessFor(session, "Technician");
}

export function resumeDemoSession(previousToken?: string) {
  const existing = previousToken && verifyDemoToken(previousToken);
  return existing ? accessFor(existing.session, existing.role) : createDemoSession();
}

export function switchDemoRole(token: string, role: DemoRole) {
  const verified = verifyDemoToken(token);
  if (!verified) throw new Error("Demo session expired or invalid");
  if (!demoRoles.includes(role)) throw new Error("Unsupported evaluator role");
  return accessFor(verified.session, role);
}

export function demoCookie(token: string, expiresAt: string) {
  const seconds = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
  return `${DEMO_COOKIE}=${encodeURIComponent(token)}; Path=/api/v1/auth/demo; Max-Age=${seconds}; HttpOnly; SameSite=${config.nodeEnv === "production" ? "None; Secure" : "Lax"}`;
}
