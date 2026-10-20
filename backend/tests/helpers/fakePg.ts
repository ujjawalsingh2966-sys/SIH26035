import type { SqlClient, SqlPool, SqlResult } from '../../src/repositories/postgres/PostgresUnitOfWork';

type Row = Record<string, unknown>;
type Tables = Map<string, Map<string, Row>>;
const TABLES = ['manufacturers', 'instruments', 'test_cases', 'observations', 'audit_events', 'native_tests',
  'evidence', 'business_accounts', 'staff_accounts', 'sessions', 'business_applications', 'identity_keys'];
const rawError = () => Object.assign(new Error('Synthetic private driver diagnostic; must never escape'), { code: 'XX000', detail: 'Synthetic private detail' });

/** Strict SQL protocol fake, NOT PostgreSQL/RLS/constraint integration verification. */
export class FakePg implements SqlPool {
  tables: Tables = new Map(TABLES.map(name => [name, new Map()]));
  readonly calls: { client: number; text: string; values?: unknown[] }[] = [];
  readonly releases: { client: number; destroyed: boolean }[] = [];
  acquisitions = 0;
  acquireFails = false;
  releaseFails = false;
  beforeCommit?: (readOnly: boolean) => Promise<void>;
  private failures: { match: (text: string) => boolean; after: boolean }[] = [];
  private lock: Promise<void> = Promise.resolve();

  failNext(match: string | ((text: string) => boolean), after = false): void {
    this.failures.push({ match: typeof match === 'string' ? text => text === match : match, after });
  }

  seed<T extends { id: string }>(table: string, records: T[]): void {
    const target = this.tables.get(table);
    if (!target) throw new Error('Unknown synthetic table');
    records.forEach((record, index) => target.set(record.id, { id: record.id,
      payload_json: JSON.stringify(record), storage_order: String(index + 1), row_version: '1' }));
  }

  records<T = { id: string }>(table: string): T[] {
    const target = this.tables.get(table);
    if (!target) throw new Error('Unknown synthetic table');
    return [...target.values()].sort((a, b) => BigInt(a.storage_order as string) < BigInt(b.storage_order as string) ? -1 : 1)
      .map(row => JSON.parse(row.payload_json as string));
  }

  async connect(): Promise<SqlClient> {
    if (this.acquireFails) throw rawError();
    const id = ++this.acquisitions;
    let transaction: Tables | undefined, unlock: (() => void) | undefined, closed = false, readOnly = false;
    const table = (name: string) => {
      if (!transaction?.has(name)) throw new Error('Fake query outside transaction or unknown table');
      return transaction.get(name)!;
    };
    const releaseLock = () => { unlock?.(); unlock = undefined; };
    return {
      query: async (text, values): Promise<SqlResult> => {
        if (closed) throw rawError();
        this.calls.push({ client: id, text, values: values && structuredClone(values) });
        const index = this.failures.findIndex(item => item.match(text));
        const failure = index < 0 ? undefined : this.failures.splice(index, 1)[0];
        if (failure && !failure.after) throw rawError();
        let result: SqlResult = { rows: [], rowCount: null };
        if (/^BEGIN ISOLATION LEVEL READ COMMITTED READ (WRITE|ONLY)$/.test(text)) {
          readOnly = text.endsWith('READ ONLY');
        } else if (/^SET LOCAL (lock_timeout = '5000ms'|statement_timeout = '10000ms'|idle_in_transaction_session_timeout = '15000ms')$/.test(text)) {
          // Explicit fixed local settings only.
        } else if (/^SELECT pg_advisory_xact_lock(_shared)?\(26035, 2202\)$/.test(text)) {
          const predecessor = this.lock;
          this.lock = new Promise<void>(resolve => { unlock = resolve; });
          await predecessor;
          transaction = structuredClone(this.tables);
        } else if (text === 'COMMIT') {
          await this.beforeCommit?.(readOnly);
          if (!transaction) throw rawError();
          if (!readOnly) this.tables = transaction;
          transaction = undefined; releaseLock();
        } else if (text === 'ROLLBACK') {
          transaction = undefined; releaseLock();
        } else {
          const select = text.match(/^SELECT id, payload_json, storage_order, row_version FROM w8lab\.([a-z_]+) ORDER BY storage_order ASC$/);
          const remove = text.match(/^DELETE FROM w8lab\.([a-z_]+) WHERE id = \$1 AND row_version = \$2$/);
          const insert = text.match(/^INSERT INTO w8lab\.([a-z_]+) \(([a-z_, ]+)\) VALUES \((\$\d+(?:, \$\d+)*)\)$/);
          const update = text.match(/^UPDATE w8lab\.([a-z_]+) SET (.+), row_version = row_version \+ 1 WHERE id = \$(\d+) AND row_version = \$(\d+)$/);
          if (select) {
            result = { rows: structuredClone([...table(select[1]).values()].sort((a, b) => BigInt(a.storage_order as string) < BigInt(b.storage_order as string) ? -1 : 1)), rowCount: table(select[1]).size };
          } else {
            if (readOnly || !values) throw rawError();
            if (text === 'INSERT INTO w8lab.identity_keys (kind, account_id, email_normalized) VALUES ($1, $2, $3) ON CONFLICT (kind, account_id) DO UPDATE SET email_normalized = EXCLUDED.email_normalized') {
              const target = table('identity_keys'), key = `${values[0]}:${values[1]}`;
              if ([...target].some(([other, row]) => other !== key && row.email_normalized === values[2])) throw rawError();
              target.set(key, { kind: values[0], account_id: values[1], email_normalized: values[2] });
              result.rowCount = 1;
            } else if (text === 'DELETE FROM w8lab.identity_keys WHERE kind = $1 AND account_id = $2') {
              result.rowCount = table('identity_keys').delete(`${values[0]}:${values[1]}`) ? 1 : 0;
            } else if (remove) {
              const target = table(remove[1]), row = target.get(values[0] as string);
              result.rowCount = row?.row_version === values[1] && target.delete(values[0] as string) ? 1 : 0;
            } else if (insert) {
              const target = table(insert[1]), columns = insert[2].split(', ');
              if (columns.length !== values.length || target.has(values[0] as string)) throw rawError();
              const row = Object.fromEntries(columns.map((column, position) => [column, values[position]]));
              row.row_version = '1'; target.set(row.id as string, row); result.rowCount = 1;
            } else if (update) {
              const target = table(update[1]), row = target.get(values[Number(update[3]) - 1] as string);
              if (row && row.row_version === values[Number(update[4]) - 1]) {
                for (const assignment of update[2].split(', ')) {
                  const match = assignment.match(/^([a-z_]+) = \$(\d+)$/);
                  if (!match) throw rawError();
                  row[match[1]] = values[Number(match[2]) - 1];
                }
                row.row_version = (BigInt(row.row_version as string) + 1n).toString(); result.rowCount = 1;
              } else result.rowCount = 0;
            } else throw new Error('Unsupported SQL in strict fake');
          }
        }
        if (failure?.after) throw rawError();
        return result;
      },
      release: destroy => {
        if (closed) throw new Error('Fake client released twice');
        closed = true; transaction = undefined; releaseLock();
        this.releases.push({ client: id, destroyed: destroy === true });
        if (this.releaseFails) throw rawError();
      },
    };
  }
}
