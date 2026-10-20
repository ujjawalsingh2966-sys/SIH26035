import { FakePg } from './helpers/fakePg';
import { PostgresUnitOfWork, SqlClient } from '../src/repositories/postgres/PostgresUnitOfWork';
import { PostgresRepository } from '../src/repositories/postgres/PostgresRepository';
import { PersistenceError } from '../src/repositories/PersistenceError';

const setup = () => {
  const db = new FakePg(), unit = new PostgresUnitOfWork(() => db);
  return { db, unit, first: new PostgresRepository<{ id: string; value?: string }>('testCaseStore', unit),
    second: new PostgresRepository<{ id: string }>('auditStore', unit) };
};
afterEach(() => jest.useRealTimers());

it('uses one client, bounded local settings, cooperative lock, and one outer commit', async () => {
  const { db, unit, first } = setup();
  await unit.write(async () => {
    await first.saveItem({ id: 'one' });
    await unit.write(() => first.saveItem({ id: 'two' }));
    await unit.read(() => first.findAll());
    expect(db.calls.some(call => /^(INSERT|UPDATE|DELETE)/.test(call.text))).toBe(false);
  });
  expect(db.acquisitions).toBe(1); expect(new Set(db.calls.map(call => call.client)).size).toBe(1);
  expect(db.calls.filter(call => call.text.startsWith('BEGIN'))).toHaveLength(1);
  expect(db.calls.filter(call => call.text === 'COMMIT')).toHaveLength(1);
  expect(db.calls.map(call => call.text)).toEqual(expect.arrayContaining([
    "SET LOCAL lock_timeout = '5000ms'", "SET LOCAL statement_timeout = '10000ms'",
    "SET LOCAL idle_in_transaction_session_timeout = '15000ms'", 'SELECT pg_advisory_xact_lock(26035, 2202)']));
  expect(db.releases).toEqual([{ client: 1, destroyed: false }]);
});

it('uses read-only transactions and shared transaction locks for read contexts', async () => {
  const { db, first } = setup(); await first.findAll();
  expect(db.calls[0].text).toBe('BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY');
  expect(db.calls.some(call => call.text === 'SELECT pg_advisory_xact_lock_shared(26035, 2202)')).toBe(true);
});

it('a caught nested read domain failure does not become a nested write failure', async () => {
  const { db, unit, first } = setup();
  await unit.write(async () => {
    try { await unit.read(async () => { throw new Error('domain-only read failure'); }); } catch { /* no SQL failure */ }
    await first.saveItem({ id: 'survives' });
  });
  expect(db.records('test_cases')).toEqual([{ id: 'survives' }]);
});

it('preserves domain errors and rolls back every staged participant', async () => {
  const { db, unit, first, second } = setup(), error = Object.assign(new Error('Existing domain conflict'), { status: 409 });
  await expect(unit.write(async () => { await first.saveItem({ id: 'case' }); await second.saveItem({ id: 'event' }); throw error; })).rejects.toBe(error);
  expect(db.records('test_cases')).toEqual([]); expect(db.records('audit_events')).toEqual([]);
  expect(db.calls.some(call => call.text === 'ROLLBACK')).toBe(true);
});

it('rolls back earlier SQL writes if a later participant fails during flush', async () => {
  const { db, unit, first, second } = setup();
  db.failNext(text => text.startsWith('INSERT INTO w8lab.audit_events'));
  await expect(unit.write(async () => { await first.saveItem({ id: 'case' }); await second.saveItem({ id: 'event' }); })).rejects.toBeInstanceOf(PersistenceError);
  expect(db.calls.some(call => call.text.startsWith('INSERT INTO w8lab.test_cases'))).toBe(true);
  expect(db.records('test_cases')).toEqual([]); expect(db.records('audit_events')).toEqual([]);
  expect(db.releases[0].destroyed).toBe(true);
  await first.saveItem({ id: 'retry' }); expect(db.records('test_cases')).toEqual([{ id: 'retry' }]);
});

it('does not return or retain raw acquisition errors', async () => {
  const { db, first } = setup(); db.acquireFails = true;
  const error = await first.findAll().catch(value => value);
  expect(error).toBeInstanceOf(PersistenceError); expect(error).not.toHaveProperty('cause');
  expect(error.message).not.toContain('Synthetic private'); expect(db.releases).toEqual([]);
});

it.each(['BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY', "SET LOCAL lock_timeout = '5000ms'",
  'SELECT pg_advisory_xact_lock_shared(26035, 2202)'])('cleans up setup failure: %s', statement => {
  const { db, first } = setup(); db.failNext(statement);
  return expect(first.findAll().finally(() => { expect(db.releases).toEqual([{ client: 1, destroyed: true }]); })).rejects.toThrow('Storage is unavailable');
});

it('sanitizes query errors even when caught inside a read callback', async () => {
  const { db, unit, first } = setup(); db.failNext(text => text.startsWith('SELECT id,'));
  await expect(unit.read(async () => { try { await first.findAll(); } catch { /* SQL transaction is unusable */ } })).rejects.toThrow();
  expect(db.calls.some(call => call.text === 'COMMIT')).toBe(false);
});

it.each([false, true])('commit failure is ambiguous and never retried (serverCommitted=%s)', async after => {
  const { db, first } = setup(); db.failNext('COMMIT', after);
  const error = await first.saveItem({ id: 'possibly-saved' }).catch(value => value);
  expect(error).toBeInstanceOf(PersistenceError); expect(error.kind).toBe('commit-unknown');
  expect(db.calls.filter(call => call.text.startsWith('INSERT INTO w8lab.test_cases'))).toHaveLength(1);
  expect(db.records('test_cases')).toHaveLength(after ? 1 : 0);
  expect(db.releases[0].destroyed).toBe(true);
});

it('rollback failure destroys the client and reports sanitized cleanup failure', async () => {
  const { db, unit } = setup(); db.failNext('ROLLBACK');
  const error = await unit.write(async () => { throw new Error('domain'); }).catch(value => value);
  expect(error.kind).toBe('cleanup'); expect(db.releases[0].destroyed).toBe(true);
});

it('a release failure after commit never claims the committed data was rolled back', async () => {
  const { db, first } = setup(); db.releaseFails = true;
  const error = await first.saveItem({ id: 'committed' }).catch(value => value);
  expect(error.kind).toBe('commit-unknown'); expect(db.records('test_cases')).toEqual([{ id: 'committed' }]);
});

it('coordinates separate unit-of-work instances through the database lock protocol', async () => {
  const db = new FakePg(); db.seed('test_cases', [{ id: 'counter', value: '0' }]);
  const workers = [new PostgresUnitOfWork(() => db), new PostgresUnitOfWork(() => db)];
  await Promise.all(Array.from({ length: 12 }, (_, index) => {
    const unit = workers[index % 2], repository = new PostgresRepository<{ id: string; value: string }>('testCaseStore', unit);
    return unit.write(async () => { const current = (await repository.findById('counter'))!; await Promise.resolve(); await repository.saveItem({ ...current, value: String(Number(current.value) + 1) }); });
  }));
  expect(db.records<{ value: string }>('test_cases')[0].value).toBe('12');
});

it('readers never see a different worker\'s uncommitted values', async () => {
  const { db, unit, first } = setup(); const reader = new PostgresRepository('testCaseStore', new PostgresUnitOfWork(() => db));
  let release!: () => void, entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  const writing = unit.write(async () => { await first.saveItem({ id: 'committed' }); entered(); await gate; });
  await started; let finished = false;
  const reading = reader.findAll().then(value => { finished = true; return value; });
  await Promise.resolve(); expect(finished).toBe(false);
  release(); await writing; expect(await reading).toEqual([{ id: 'committed' }]);
});

it('bounds an abandoned callback and rejects its later escaped work', async () => {
  const db = new FakePg(), unit = new PostgresUnitOfWork(() => db, 10), repository = new PostgresRepository('testCaseStore', unit);
  let release!: () => void, escaped!: Promise<unknown>;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const operation = unit.write(async () => { escaped = gate.then(() => repository.findAll()); await escaped; });
  await expect(operation).rejects.toThrow('Storage is unavailable');
  release(); await expect(escaped).rejects.toThrow('Persistence context');
  expect(db.releases).toHaveLength(1);
});

it('bounds acquisition and destroys a client delivered after timeout', async () => {
  jest.useFakeTimers();
  let deliver!: (client: SqlClient) => void;
  const release = jest.fn(), unit = new PostgresUnitOfWork(() => ({ connect: () => new Promise(resolve => { deliver = resolve; }) }));
  const rejected = expect(unit.read(async () => undefined)).rejects.toThrow('Storage is unavailable');
  await jest.advanceTimersByTimeAsync(5001); await rejected;
  deliver({ query: jest.fn(), release }); await jest.advanceTimersByTimeAsync(0);
  expect(release).toHaveBeenCalledWith(true);
});

it('preserves even an undefined domain rejection rather than returning a false success', async () => {
  const { db, unit, first } = setup();
  await expect(unit.write(async () => { await first.saveItem({ id: 'rolled-back' }); throw undefined; })).rejects.toBeUndefined();
  expect(db.records('test_cases')).toEqual([]);
  expect(db.calls.some(call => call.text === 'COMMIT')).toBe(false);
});

it.each([0, -1, 30001, 1.5])('rejects unbounded/invalid callback timeout %s', timeout => {
  expect(() => new PostgresUnitOfWork(() => new FakePg(), timeout)).toThrow(PersistenceError);
});

it('applies the transaction deadline to flush statements too, not just the callback', async () => {
  const { db, unit, first } = setup();
  const clock = jest.spyOn(Date, 'now');
  try {
    await expect(unit.write(async () => {
      await first.saveItem({ id: 'must-not-flush' });
      clock.mockReturnValue(Date.now() + 60000);
    })).rejects.toThrow('Storage is unavailable');
    expect(db.records('test_cases')).toEqual([]);
    expect(db.calls.some(call => call.text.startsWith('INSERT INTO'))).toBe(false);
  } finally { clock.mockRestore(); }
});
