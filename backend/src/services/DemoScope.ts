import { AsyncLocalStorage } from "async_hooks";

const demoContext = new AsyncLocalStorage<{ demoId: string }>();

export function currentDemoId(): string | undefined {
  return demoContext.getStore()?.demoId;
}

/** Only call with an ID from an active, signed server-side demo session. */
export function runInDemoScope<T>(demoId: string, fn: () => T): T {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(demoId)) {
    throw new Error("Invalid demo namespace");
  }
  return demoContext.run({ demoId }, fn);
}
