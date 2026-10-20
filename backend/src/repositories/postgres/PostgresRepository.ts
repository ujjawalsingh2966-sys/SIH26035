import type { Repository } from '../Repository';
import { PersistenceError } from '../PersistenceError';
import { PostgresUnitOfWork, PostgresParticipant, SqlQuery } from './PostgresUnitOfWork';
import { mappingFor, projections, StoreName } from './mappings';
import { decodeRecord, detachRecord, encodeRecord } from './serialization';

interface Original { payload: string; order: bigint; version: bigint }
interface State<T> { records: Map<string, T>; orders: Map<string, bigint>; original: Map<string, Original>; nextOrder: bigint }

/** JSON-payload compatibility adapter, not a migration runner or authorization bypass. */
export class PostgresRepository<T extends { id: string }> implements Repository<T> {
  private readonly participant: PostgresParticipant;
  private readonly mapping;
  constructor(name: StoreName, private readonly unit: PostgresUnitOfWork) {
    this.mapping = mappingFor(name);
    this.participant = { key: this.mapping.table, rank: this.mapping.rank,
      load: query => this.load(query),
      remove: (state, query) => this.remove(state as State<T>, query),
      save: (state, query) => this.flush(state as State<T>, query) };
  }

  async findAll(): Promise<T[]> {
    return this.unit.read(async () => structuredClone([...(await this.state()).records.values()]));
  }
  async findById(id: string): Promise<T | undefined> {
    return this.unit.read(async () => structuredClone((await this.state()).records.get(id)));
  }
  async saveItem(item: T, _requireDurable = false): Promise<T> {
    const detached = detachRecord(item);
    return this.unit.write(async () => {
      const state = await this.state();
      this.unit.changed(this.participant);
      if (!state.records.has(detached.id)) state.orders.set(detached.id, ++state.nextOrder);
      state.records.set(detached.id, detached);
      return structuredClone(detached);
    });
  }
  async deleteItem(id: string): Promise<void> {
    return this.unit.write(async () => {
      const state = await this.state();
      this.unit.changed(this.participant);
      state.records.delete(id); state.orders.delete(id);
    });
  }

  private state(): Promise<State<T>> { return this.unit.state<State<T>>(this.participant); }
  private async load(query: SqlQuery): Promise<State<T>> {
    const result = await query(`SELECT id, payload_json, storage_order, row_version FROM w8lab.${this.mapping.table} ORDER BY storage_order ASC`);
    const state: State<T> = { records: new Map(), orders: new Map(), original: new Map(), nextOrder: 0n };
    try {
      for (const row of result.rows) {
        if (typeof row.id !== 'string' || typeof row.storage_order !== 'string' || !/^\d+$/.test(row.storage_order)
          || typeof row.row_version !== 'string' || !/^\d+$/.test(row.row_version) || state.records.has(row.id)) throw new PersistenceError('invalid-record');
        const record = decodeRecord<T>(row.payload_json, row.id), order = BigInt(row.storage_order), version = BigInt(row.row_version);
        if (order <= state.nextOrder || version < 1n) throw new PersistenceError('invalid-record');
        state.records.set(row.id, record); state.orders.set(row.id, order);
        state.original.set(row.id, { payload: row.payload_json as string, order, version }); state.nextOrder = order;
      }
      return state;
    } catch { throw new PersistenceError('invalid-record'); }
  }

  private async remove(state: State<T>, query: SqlQuery): Promise<void> {
    for (const [id, previous] of state.original) {
      if (state.records.has(id)) continue;
      const result = await query(`DELETE FROM w8lab.${this.mapping.table} WHERE id = $1 AND row_version = $2`, [id, previous.version.toString()]);
      if (result.rowCount !== 1) throw new PersistenceError('conflict');
      if (this.mapping.identityKind) await query('DELETE FROM w8lab.identity_keys WHERE kind = $1 AND account_id = $2', [this.mapping.identityKind, id]);
    }
  }

  private async flush(state: State<T>, query: SqlQuery): Promise<void> {
    const { table, columns, identityKind } = this.mapping;
    for (const [id, record] of state.records) {
      const payload = encodeRecord(record), previous = state.original.get(id), order = state.orders.get(id)!;
      if (previous && previous.payload === payload && previous.order === order) continue;
      const projected = projections(this.mapping, record);
      if (identityKind) {
        const reserved = await query('INSERT INTO w8lab.identity_keys (kind, account_id, email_normalized) VALUES ($1, $2, $3) ON CONFLICT (kind, account_id) DO UPDATE SET email_normalized = EXCLUDED.email_normalized', [identityKind, id, projected[0]]);
        if (reserved.rowCount !== 1) throw new PersistenceError('conflict');
      }
      if (previous) {
        const assignments = ['payload_json', 'storage_order', ...columns].map((column, index) => `${column} = $${index + 1}`).join(', ');
        const values = [payload, order.toString(), ...projected, id, previous.version.toString()];
        const result = await query(`UPDATE w8lab.${table} SET ${assignments}, row_version = row_version + 1 WHERE id = $${values.length - 1} AND row_version = $${values.length}`, values);
        if (result.rowCount !== 1) throw new PersistenceError('conflict');
      } else {
        const names = ['id', 'payload_json', 'storage_order', ...columns];
        const values = [id, payload, order.toString(), ...projected];
        const inserted = await query(`INSERT INTO w8lab.${table} (${names.join(', ')}) VALUES (${values.map((_, index) => `$${index + 1}`).join(', ')})`, values);
        if (inserted.rowCount !== 1) throw new PersistenceError('conflict');
      }
    }
  }
}
