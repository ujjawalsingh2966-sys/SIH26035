import { FakePg } from './helpers/fakePg';
import { createRepositories } from '../src/repositories/createRepositories';
import { PostgresRepository } from '../src/repositories/postgres/PostgresRepository';
import { PostgresUnitOfWork } from '../src/repositories/postgres/PostgresUnitOfWork';
import { MAPPINGS, mappingFor, projections, StoreName } from '../src/repositories/postgres/mappings';
import { PersistenceError } from '../src/repositories/PersistenceError';

it.each(Object.keys(MAPPINGS) as StoreName[])('maps %s to its explicit table on the same unit of work', async name => {
  const db = new FakePg(), bundle = createRepositories({ environment: { PERSISTENCE_ADAPTER: 'postgres' }, postgresPool: db });
  await bundle[name].findAll();
  expect(db.calls.some(call => call.text === `SELECT id, payload_json, storage_order, row_version FROM w8lab.${MAPPINGS[name].table} ORDER BY storage_order ASC`)).toBe(true);
});

it.each(Object.keys(MAPPINGS) as StoreName[])('supports detached CRUD and reload for %s', async name => {
  const db = new FakePg(), make = () => createRepositories({ environment: { PERSISTENCE_ADAPTER: 'postgres' }, postgresPool: db });
  // Exercise the common repository port with intentionally schema-neutral synthetic records.
  const repository = make()[name] as unknown as import('../src/repositories/Repository').Repository<{ id: string; email: string; nested: { value: string } }>;
  const original = { id: `synthetic-${name}`, email: `${name.toLowerCase()}@example.test`, nested: { value: 'first' } };
  const saved = await repository.saveItem(original); saved.nested.value = 'leak'; original.nested.value = 'leak';
  const current = (await repository.findById(original.id))!; expect(current.nested.value).toBe('first');
  current.nested.value = 'updated'; await repository.saveItem(current);
  expect(await make()[name].findById(original.id)).toEqual(current);
  await repository.deleteItem(original.id); expect(await make()[name].findAll()).toEqual([]);
  if (MAPPINGS[name].identityKind) expect(db.tables.get('identity_keys')!.size).toBe(0);
});

it('concurrent initial reads share one collection snapshot per context', async () => {
  const db = new FakePg(), unit = new PostgresUnitOfWork(() => db), repository = new PostgresRepository('testCaseStore', unit);
  await unit.read(() => Promise.all([repository.findAll(), repository.findAll(), repository.findById('missing')]));
  expect(db.calls.filter(call => call.text.startsWith('SELECT id,'))).toHaveLength(1);
});

it('keeps payloads parameterized, including hostile IDs and string contents', async () => {
  const db = new FakePg(), repository = new PostgresRepository<{ id: string; value: string }>('testCaseStore', new PostgresUnitOfWork(() => db));
  const record = { id: "synthetic'; DROP TABLE w8lab.test_cases; --", value: "private ' <input>" };
  await repository.saveItem(record);
  expect(db.calls.every(call => !call.text.includes(record.id) && !call.text.includes(record.value))).toBe(true);
  expect(await repository.findById(record.id)).toEqual(record);
});

it('rejects table identifiers outside the mapping allowlist', () => {
  expect(() => mappingFor('unknown;DROP' as StoreName)).toThrow(PersistenceError);
  expect(Object.isFrozen(MAPPINGS)).toBe(true);
  expect(Object.values(MAPPINGS).every(mapping => Object.isFrozen(mapping) && Object.isFrozen(mapping.columns) && Object.isFrozen(mapping.fields))).toBe(true);
});

it.each(['identity_keys', 'business_accounts'])('never acknowledges a silently skipped insert into %s', async table => {
  const db = new FakePg(), connect = db.connect.bind(db);
  db.connect = async () => {
    const client = await connect(), query = client.query.bind(client);
    client.query = (text, values) => text.startsWith(`INSERT INTO w8lab.${table} `) ? Promise.resolve({ rows: [], rowCount: 0 }) : query(text, values);
    return client;
  };
  const repository = new PostgresRepository('accountStore', new PostgresUnitOfWork(() => db));
  await expect(repository.saveItem({ id: 'synthetic-account', email: 'synthetic@example.test' } as { id: string })).rejects.toThrow('stored record has changed');
  expect(db.records('business_accounts')).toEqual([]); expect(db.tables.get('identity_keys')!.size).toBe(0);
  expect(db.calls.some(call => call.text === 'COMMIT')).toBe(false);
});

it('updates projected fields without normalizing the payload', () => {
  const record = { id: 'one', identifier: '  ID  ONE ', name: ' Mixed  Name ', address: ' A  ROAD ' };
  expect(projections(MAPPINGS.manufacturerStore, record)).toEqual(['id one', 'mixed name', 'a road']);
  expect(record.name).toBe(' Mixed  Name ');
  expect(projections(MAPPINGS.nativeTestStore, { id: 'n', testCaseId: 'c', programmeId: 'p', submission: { procedureId: 'WEIGHING', series: 'ONE' } } as { id: string })).toEqual(['c', 'p', 'WEIGHING', 'ONE']);
});

it('stages identity registry changes in the same transaction as the account', async () => {
  const db = new FakePg(), repository = new PostgresRepository('accountStore', new PostgresUnitOfWork(() => db));
  db.failNext(text => text.startsWith('INSERT INTO w8lab.business_accounts'));
  await expect(repository.saveItem({ id: 'business', email: 'synthetic@example.invalid' } as { id: string })).rejects.toThrow();
  expect(db.tables.get('identity_keys')!.size).toBe(0); expect(db.records('business_accounts')).toEqual([]);
});

it.each(['mismatched-id', 'invalid-json', 'duplicate-order', 'bad-version'])('rejects corrupt stored envelope: %s', async kind => {
  const db = new FakePg(); db.seed('test_cases', [{ id: 'one' }, { id: 'two' }]);
  const row = db.tables.get('test_cases')!.get('two')!;
  if (kind === 'mismatched-id') row.payload_json = JSON.stringify({ id: 'other' });
  if (kind === 'invalid-json') row.payload_json = '{';
  if (kind === 'duplicate-order') row.storage_order = '1';
  if (kind === 'bad-version') row.row_version = '0';
  const repository = new PostgresRepository('testCaseStore', new PostgresUnitOfWork(() => db));
  await expect(repository.findAll()).rejects.toThrow('represented safely');
});

it('rejects a stale internal row version instead of overwriting a non-cooperating writer', async () => {
  const db = new FakePg(); db.seed('test_cases', [{ id: 'one' }]);
  const original = db.connect.bind(db);
  db.connect = async () => {
    const client = await original(), query = client.query.bind(client);
    client.query = async (text, values) => text.startsWith('UPDATE w8lab.test_cases') ? { rows: [], rowCount: 0 } : query(text, values);
    return client;
  };
  const repository = new PostgresRepository('testCaseStore', new PostgresUnitOfWork(() => db));
  await expect(repository.saveItem({ id: 'one', value: 'new' } as { id: string })).rejects.toThrow('stored record has changed');
  expect(db.records('test_cases')).toEqual([{ id: 'one' }]);
});

it('does not impose a new uniqueness constraint on generic observation sequences', async () => {
  const db = new FakePg(), repository = new PostgresRepository('observationStore', new PostgresUnitOfWork(() => db));
  await repository.saveItem({ id: 'one', testCaseId: 'case', testType: 'WEIGHING', sequence: 1 } as { id: string });
  await repository.saveItem({ id: 'two', testCaseId: 'case', testType: 'WEIGHING', sequence: 1 } as { id: string });
  expect(await repository.findAll()).toHaveLength(2);
});
