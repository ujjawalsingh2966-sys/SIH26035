import { AsyncLocalStorage } from "async_hooks";

// Only trusted server code may establish this scope. Never accept a workspace ID
// from an unverified request header, URL parameter, or unsigned JWT.
const scope = new AsyncLocalStorage<string>();

export function withinDemoWorkspace<T>(workspaceId: string, fn: () => T): T {
  return scope.run(workspaceId, fn);
}

export function currentDemoWorkspace(): string | undefined {
  return scope.getStore();
}
