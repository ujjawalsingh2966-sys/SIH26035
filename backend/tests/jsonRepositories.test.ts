import fs from 'fs';
import { randomUUID, createHash } from 'crypto';
import { JsonRepository } from '../src/repositories/JsonRepository';
import { JsonUnitOfWork } from '../src/repositories/JsonUnitOfWork';
import { JsonStore } from '../src/repositories/JsonStore';

interface Record { id: string; value: string; nested: { values: string[] }; optional?: string }
const record = (id = 'first', value = '0.00000001'): Record => ({ id, value, nested: { values: ['original'] } });
function fixture() {
  const unit = new JsonUnitOfWork();
  const filename = `phase2a-${randomUUID()}.json`;
  return { unit, filename, repository: new JsonRepository<Record>(filename, true, 'Synthetic', unit),
    disk: () => new JsonStore<Record>(filename, true).findAll() };
}
afterEach(() => jest.restoreAllMocks());

it('detaches save inputs before asynchronous queueing and detaches returned values', async () => {
  const { repository, disk } = fixture(), input = record();
  const pending = repository.saveItem(input);
  input.nested.values[0] = 'caller mutation';
  const saved = await pending;
  saved.nested.values.push('returned mutation');
  expect(await repository.findById(input.id)).toEqual(record());
  expect(disk()).toEqual([record()]);
});

it('detaches nested findAll and findById results and returned arrays', async () => {
  const { repository, disk } = fixture();
  await repository.saveItem(record());
  const rows = await repository.findAll(), found = (await repository.findById('first'))!;
  rows[0].nested.values[0] = 'changed'; rows.push(record('extra')); found.value = 'changed';
  expect(await repository.findAll()).toEqual([record()]);
  expect(disk()).toEqual([record()]);
});

it('also isolates the retained low-level JSON adapter', () => {
  const store = new JsonStore<Record>(`raw-${randomUUID()}.json`, true);
  const input = record(), saved = store.saveItem(input);
  input.nested.values.push('input'); saved.nested.values.push('output');
  store.findById(input.id)!.nested.values.push('read'); store.findAll()[0].value = 'changed';
  expect(store.findAll()).toEqual([record()]);
});

it('stages writes, supports read-your-writes and publishes only after commit', async () => {
  const { unit, repository, disk } = fixture();
  await unit.write(async () => {
    await repository.saveItem(record());
    expect(await repository.findById('first')).toEqual(record());
    expect(disk()).toEqual([]);
  });
  expect(disk()).toEqual([record()]);
});

it('discards nested staged writes when validation fails before commit', async () => {
  const { unit, repository, disk } = fixture();
  await repository.saveItem(record());
  await expect(unit.write(async () => {
    await repository.deleteItem('first');
    await unit.write(async () => { await repository.saveItem(record('new')); });
    throw new Error('Synthetic validation rejection');
  })).rejects.toThrow('Synthetic validation rejection');
  expect(await repository.findAll()).toEqual([record()]); expect(disk()).toEqual([record()]);
});

it.each(['save', 'delete', 'clear'] as const)('rolls back a failed %s and supports retry', async operation => {
  const { repository, disk } = fixture();
  await repository.saveItem(record());
  const attempt = () => operation === 'save' ? repository.saveItem(record('first', '2'))
    : operation === 'delete' ? repository.deleteItem('first') : repository.clear();
  jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('Synthetic write failure'); });
  await expect(attempt()).rejects.toThrow('Synthetic storage is unavailable');
  expect(await repository.findAll()).toEqual([record()]); expect(disk()).toEqual([record()]);
  await attempt();
  expect(disk()).toEqual(operation === 'save' ? [record('first', '2')] : []);
});

it('compensates earlier file replacements when a later collection write fails', async () => {
  const { unit, repository, disk } = fixture(), filename = `second-${randomUUID()}.json`;
  const second = new JsonRepository<Record>(filename, true, 'Second synthetic', unit);
  await repository.saveItem(record()); await second.saveItem(record('second'));
  const rename = fs.renameSync; let failed = false;
  jest.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    if (String(to).endsWith(filename) && !failed) { failed = true; throw new Error('Synthetic second-file failure'); }
    rename(from, to);
  });
  await expect(unit.write(async () => {
    await repository.saveItem(record('first', 'changed'));
    await second.saveItem(record('second', 'changed'));
  })).rejects.toThrow('Second synthetic storage is unavailable');
  expect(await repository.findAll()).toEqual([record()]); expect(disk()).toEqual([record()]);
  expect(await second.findAll()).toEqual([record('second')]);
  expect(new JsonStore<Record>(filename, true).findAll()).toEqual([record('second')]);
});

it('fails closed when compensation fails; it does not claim crash recovery', async () => {
  const { unit, repository } = fixture();
  await repository.saveItem(record());
  jest.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('Synthetic permanent failure'); });
  await expect(repository.saveItem(record('first', 'changed'))).rejects.toThrow('operator recovery');
  jest.restoreAllMocks();
  await expect(repository.findAll()).rejects.toThrow('operator recovery');
  await expect(repository.saveItem(record('another'))).rejects.toThrow('operator recovery');
});

it('serializes overlapping read-modify-write operations without lost updates', async () => {
  const { unit, repository } = fixture();
  await repository.saveItem(record('counter', '0'));
  await Promise.all(Array.from({ length: 30 }, () => unit.write(async () => {
    const current = (await repository.findById('counter'))!;
    await Promise.resolve();
    await repository.saveItem({ ...current, value: String(Number(current.value) + 1) });
  })));
  expect((await repository.findById('counter'))!.value).toBe('30');
});

it('does not expose uncommitted values to concurrent readers', async () => {
  const { unit, repository } = fixture();
  await repository.saveItem(record());
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const writing = unit.write(async () => {
    await repository.saveItem(record('first', 'committed'));
    entered(); await gate;
  });
  await started;
  let observed = false;
  const reading = repository.findById('first').then(row => { observed = true; return row; });
  await Promise.resolve(); expect(observed).toBe(false);
  release(); await writing;
  expect((await reading)!.value).toBe('committed');
});

it('rejects writes inside a read-only context without changing disk', async () => {
  const { unit, repository, disk } = fixture();
  await expect(unit.read(async () => repository.saveItem(record()))).rejects.toThrow('read context');
  expect(disk()).toEqual([]); expect(await repository.findAll()).toEqual([]);
});

it('cannot commit a caught nested write failure as a partially successful transaction', async () => {
  const { unit, repository, disk } = fixture();
  await expect(unit.write(async () => {
    try {
      await unit.write(async () => {
        await repository.saveItem(record());
        throw new Error('Synthetic nested failure');
      });
    } catch { /* catching the exception must not authorize committing its changes */ }
    await repository.saveItem(record('second'));
  })).rejects.toThrow('nested write failure');
  expect(await repository.findAll()).toEqual([]); expect(disk()).toEqual([]);
});

it('rejects a repository operation escaping a closed context', async () => {
  const { unit, repository } = fixture();
  let run!: () => void, escaped!: Promise<unknown>;
  await unit.read(async () => {
    const gate = new Promise<void>(resolve => { run = resolve; });
    escaped = gate.then(() => repository.findAll());
  });
  run(); await expect(escaped).rejects.toThrow('context has closed');
});

it('preserves legacy JSON shapes, decimal strings, key order and collection order across reload', async () => {
  const { filename, unit } = fixture(), legacy = new JsonStore<Record>(filename, true);
  const rows = [record('z', '0001.2500'), record('a', '9007199254740993')];
  rows.forEach(row => legacy.saveItem(row));
  const repository = new JsonRepository<Record>(filename, true, 'Synthetic', unit);
  expect(JSON.stringify(await repository.findAll())).toBe(JSON.stringify(rows));
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  expect(hash(await repository.findAll())).toBe(hash(rows));
  await repository.saveItem({ ...rows[0], optional: undefined });
  expect(legacy.findAll()).toEqual(rows); // existing instances are detached, not live caches
  const reopened = new JsonRepository<Record>(filename, true, 'Synthetic', new JsonUnitOfWork());
  expect(JSON.stringify(await reopened.findAll())).toBe(JSON.stringify(rows));
});
