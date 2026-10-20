import { PersistenceError } from '../PersistenceError';

/** Copy before waiting. In-flight copies retain undefined; durable JSON uses legacy reload semantics. */
export function detachRecord<T extends { id: string }>(record: T): T {
  try {
    const copy = structuredClone(record);
    encodeRecord(copy);
    return copy;
  } catch { throw new PersistenceError('invalid-record'); }
}

export function encodeRecord(record: { id: string }): string {
  try {
    if (!record || typeof record !== 'object' || Array.isArray(record) || typeof record.id !== 'string') throw new Error();
    const payload = JSON.stringify(record);
    const restored = JSON.parse(payload);
    if (!restored || Array.isArray(restored) || restored.id !== record.id) throw new Error();
    return payload;
  } catch { throw new PersistenceError('invalid-record'); }
}

export function decodeRecord<T extends { id: string }>(payload: unknown, id: string): T {
  try {
    if (typeof payload !== 'string') throw new Error();
    const record = JSON.parse(payload);
    if (!record || typeof record !== 'object' || Array.isArray(record) || record.id !== id) throw new Error();
    return record as T;
  } catch { throw new PersistenceError('invalid-record'); }
}
