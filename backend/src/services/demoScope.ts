import { AsyncLocalStorage } from "async_hooks";
import fs from "fs";
import path from "path";

// A demo workspace can only be selected from server-verified authentication.
const scope = new AsyncLocalStorage<string>();
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const demoRoot = path.join(
  process.env.DATA_DIR || path.resolve(__dirname, "../../../data"),
  "evaluator-demo",
);

export interface DemoWorkspaceMetadata {
  id: string;
  createdAt: string;
  expiresAt: string;
}

export class DemoExpiredError extends Error {
  readonly code = "DEMO_EXPIRED";
  constructor() {
    super("Your 24-hour evaluator demo has expired. Generate a new workspace.");
    this.name = "DemoExpiredError";
  }
}

export function demoWorkspaceFolder(id: string): string {
  if (!idPattern.test(id)) throw new DemoExpiredError();
  return path.join(demoRoot, id);
}

// The persisted timestamp is the server's source of truth, including after a restart.
// This reader deliberately does NOT make missing directories.
export function readDemoMetadata(id: string): DemoWorkspaceMetadata | null {
  if (!idPattern.test(id)) return null;
  try {
    const entry = JSON.parse(fs.readFileSync(path.join(demoWorkspaceFolder(id), "workspace.json"), "utf8"));
    const created = Date.parse(entry.createdAt);
    const expires = Date.parse(entry.expiresAt);
    if (entry.id !== id || !Number.isFinite(created) || !Number.isFinite(expires) ||
        expires <= created || expires - created > 24 * 60 * 60 * 1000) return null;
    return { id, createdAt: entry.createdAt, expiresAt: entry.expiresAt };
  } catch { return null; }
}

export function assertDemoWorkspaceActive(id: string): DemoWorkspaceMetadata {
  const metadata = readDemoMetadata(id);
  if (!metadata || Date.now() >= Date.parse(metadata.expiresAt)) throw new DemoExpiredError();
  return metadata;
}

export function withinDemoWorkspace<T>(workspaceId: string, fn: () => T): T {
  assertDemoWorkspaceActive(workspaceId);
  return scope.run(workspaceId, fn);
}

export function currentDemoWorkspace(): string | undefined {
  return scope.getStore();
}
