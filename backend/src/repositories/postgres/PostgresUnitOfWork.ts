import { AsyncLocalStorage } from 'async_hooks';
import type { UnitOfWork } from '../Repository';
import { PersistenceError } from '../PersistenceError';

export interface SqlResult { rows: Record<string, unknown>[]; rowCount: number | null }
export interface SqlClient {
  query(text: string, values?: unknown[]): Promise<SqlResult>;
  release(destroy?: boolean): void;
}
export interface SqlPool { connect(): Promise<SqlClient> }
export interface PostgresParticipant {
  readonly key: string;
  readonly rank: number;
  load(query: SqlQuery): Promise<unknown>;
  remove(state: unknown, query: SqlQuery): Promise<void>;
  save(state: unknown, query: SqlQuery): Promise<void>;
}
export type SqlQuery = (text: string, values?: unknown[]) => Promise<SqlResult>;
interface Context {
  active: boolean; accepting: boolean; writable: boolean; rollbackOnly: boolean;
  client: SqlClient; broken: boolean;
  deadline: number;
  states: Map<PostgresParticipant, Promise<unknown>>;
  dirty: Set<PostgresParticipant>;
}

function bounded<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new PersistenceError()), milliseconds);
    work.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

/** Conservative cooperative locking; no retries, independent nested commits or global HTTP FIFO claim. */
export class PostgresUnitOfWork implements UnitOfWork {
  private readonly context = new AsyncLocalStorage<Context>();
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly pool: () => SqlPool, private readonly transactionTimeoutMs = 30000) {
    if (!Number.isInteger(transactionTimeoutMs) || transactionTimeoutMs < 1 || transactionTimeoutMs > 30000) throw new PersistenceError('context');
  }

  private current(): Context | undefined {
    const current = this.context.getStore();
    if (current && (!current.active || !current.accepting)) throw new PersistenceError('context');
    return current;
  }

  async state<T>(participant: PostgresParticipant): Promise<T> {
    const current = this.current();
    if (!current) throw new PersistenceError('context');
    if (!current.states.has(participant)) {
      current.states.set(participant, participant.load((text, values) => this.query(current, text, values)));
    }
    const state = await current.states.get(participant);
    this.current(); // A read which outlives its callback may not leak a completed context.
    return state as T;
  }

  changed(participant: PostgresParticipant): void {
    const current = this.current();
    if (!current?.writable) throw new PersistenceError('context');
    current.dirty.add(participant);
  }

  private async query(current: Context, text: string, values?: unknown[]): Promise<SqlResult> {
    if (!current.active) throw new PersistenceError('context');
    try {
      const remaining = current.deadline - Date.now();
      if (remaining <= 0) throw new PersistenceError();
      return await bounded(current.client.query(text, values), Math.min(10000, remaining));
    }
    catch {
      current.broken = true;
      current.rollbackOnly = true;
      throw new PersistenceError();
    }
  }

  read<T>(operation: () => Promise<T>): Promise<T> { return this.run(false, operation); }
  write<T>(operation: () => Promise<T>): Promise<T> { return this.run(true, operation); }

  private async run<T>(writable: boolean, operation: () => Promise<T>): Promise<T> {
    const nested = this.current();
    if (nested) {
      if (writable && !nested.writable) throw new PersistenceError('context');
      try { return await operation(); }
      catch (error) { if (writable) nested.rollbackOnly = true; throw error; }
    }
    const predecessor = this.queue;
    let releaseQueue!: () => void;
    this.queue = new Promise<void>(resolve => { releaseQueue = resolve; });
    try { await bounded(predecessor, 5000); }
    catch (error) {
      // Preserve queue order even when this waiting request expires.
      void predecessor.then(releaseQueue);
      throw error;
    }
    try { return await this.outer(writable, operation); }
    finally { releaseQueue(); }
  }

  private async outer<T>(writable: boolean, operation: () => Promise<T>): Promise<T> {
    let client: SqlClient;
    try {
      // The production pg pool has its own 5s acquisition timeout. Dispose a late
      // injected acquisition too; it must not create an abandoned pooled client.
      let expired = false;
      let acquired: SqlClient | undefined, disposed = false;
      const disposeLate = () => {
        if (acquired && !disposed) {
          disposed = true;
          try { acquired.release(true); } catch { /* sanitized */ }
        }
      };
      const acquiring = Promise.resolve().then(() => this.pool().connect());
      acquiring.then(value => { acquired = value; if (expired) disposeLate(); }, () => undefined);
      try { client = await bounded(acquiring, 5000); }
      catch { expired = true; disposeLate(); throw new PersistenceError(); }
    } catch { throw new PersistenceError(); }
    const current: Context = { active: true, accepting: true, writable, rollbackOnly: false, client,
      broken: false, deadline: Date.now() + this.transactionTimeoutMs, states: new Map(), dirty: new Set() };
    let committing = false, committed = false, failed = false, failure: unknown, result!: T;
    try {
      await this.query(current, `BEGIN ISOLATION LEVEL READ COMMITTED ${writable ? 'READ WRITE' : 'READ ONLY'}`);
      await this.query(current, "SET LOCAL lock_timeout = '5000ms'");
      await this.query(current, "SET LOCAL statement_timeout = '10000ms'");
      await this.query(current, "SET LOCAL idle_in_transaction_session_timeout = '15000ms'");
      await this.query(current, `SELECT pg_advisory_xact_lock${writable ? '' : '_shared'}(26035, 2202)`);
      const remaining = current.deadline - Date.now();
      if (remaining <= 0) throw new PersistenceError();
      result = await this.context.run(current, () => bounded(Promise.resolve().then(operation), remaining));
      current.accepting = false;
      if (current.rollbackOnly) throw new PersistenceError('context');
      const dirty = [...current.dirty].sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key));
      const query: SqlQuery = (text, values) => this.query(current, text, values);
      for (const participant of [...dirty].reverse()) await participant.remove(await current.states.get(participant), query);
      for (const participant of dirty) await participant.save(await current.states.get(participant), query);
      committing = true;
      await this.query(current, 'COMMIT');
      committed = true;
    } catch (error) {
      failed = true;
      current.accepting = false;
      failure = committing ? new PersistenceError('commit-unknown') : error;
      try { await bounded(client.query('ROLLBACK'), 5000); }
      catch { current.broken = true; if (!committing) failure = new PersistenceError('cleanup'); }
    } finally {
      current.active = false;
      current.accepting = false;
      try { client.release(current.broken || committing && !committed); }
      catch { failed = true; failure = new PersistenceError(committed ? 'commit-unknown' : 'cleanup'); }
    }
    if (failed) throw failure;
    return result;
  }
}
