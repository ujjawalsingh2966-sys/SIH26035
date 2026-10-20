import { AsyncLocalStorage } from 'async_hooks';
import type { UnitOfWork } from './Repository';

export interface JsonParticipant {
  snapshot(): unknown;
  persist(snapshot: unknown): void;
  publish(snapshot: unknown): void;
}
interface Context {
  writable: boolean;
  active: boolean;
  rollbackOnly: boolean;
  snapshots: Map<JsonParticipant, unknown>;
  dirty: Set<JsonParticipant>;
}

/** Single-process isolation, NOT a durable multi-file transaction or journal. */
export class JsonUnitOfWork implements UnitOfWork {
  private context = new AsyncLocalStorage<Context>();
  private queue: Promise<void> = Promise.resolve();
  private unavailable = false;

  current(): Context | undefined {
    const current = this.context.getStore();
    if (current && !current.active) throw new Error('Persistence context has closed');
    return current;
  }

  state<T>(participant: JsonParticipant): T {
    const current = this.current();
    if (!current) throw new Error('A persistence context is required');
    if (!current.snapshots.has(participant)) current.snapshots.set(participant, participant.snapshot());
    return current.snapshots.get(participant) as T;
  }

  changed(participant: JsonParticipant): void {
    const current = this.current();
    if (!current?.writable) throw new Error('Writes are not allowed in a read context');
    current.dirty.add(participant);
  }

  read<T>(operation: () => Promise<T>): Promise<T> { return this.run(false, operation); }
  write<T>(operation: () => Promise<T>): Promise<T> { return this.run(true, operation); }

  private async run<T>(writable: boolean, operation: () => Promise<T>): Promise<T> {
    const nested = this.current();
    if (nested) {
      if (writable && !nested.writable) throw new Error('Cannot upgrade a read context to a write context');
      try { return await operation(); }
      catch (error) {
        // Nested writes share the outer transaction, not an independent savepoint.
        if (writable) nested.rollbackOnly = true;
        throw error;
      }
    }
    const predecessor = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>(resolve => { release = resolve; });
    await predecessor;
    const current: Context = { writable, active: true, rollbackOnly: false, snapshots: new Map(), dirty: new Set() };
    try {
      if (this.unavailable) throw new Error('Persistence is unavailable; operator recovery is required');
      return await this.context.run(current, async () => {
        const result = await operation();
        if (current.rollbackOnly) throw new Error('Persistence operation was rolled back after a nested write failure');
        const before = new Map<JsonParticipant, unknown>();
        const attempted: JsonParticipant[] = [];
        try {
          for (const participant of current.dirty) {
            before.set(participant, participant.snapshot());
            attempted.push(participant);
            participant.persist(current.snapshots.get(participant));
          }
        } catch (error) {
          // Best-effort compensation only. A process crash between file replacements
          // can leave mixed files. Phase 2B recovery is deliberately not implemented.
          for (const participant of attempted.reverse()) {
            try { participant.persist(before.get(participant)); }
            catch { this.unavailable = true; }
          }
          if (this.unavailable) throw new Error('Persistence is unavailable; operator recovery is required');
          throw error;
        }
        for (const participant of current.dirty) participant.publish(current.snapshots.get(participant));
        return result;
      });
    } finally {
      current.active = false;
      release();
    }
  }
}

export const jsonUnitOfWork = new JsonUnitOfWork();
