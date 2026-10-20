import { randomUUID } from 'crypto';
import { JsonRepository } from '../src/repositories/JsonRepository';
import { JsonUnitOfWork } from '../src/repositories/JsonUnitOfWork';
import { PostgresRepository } from '../src/repositories/postgres/PostgresRepository';
import { PostgresUnitOfWork } from '../src/repositories/postgres/PostgresUnitOfWork';
import type { Repository, UnitOfWork } from '../src/repositories/Repository';
import { FakePg } from './helpers/fakePg';

interface Item { id: string; value: string; nested: { list: string[] }; optional?: string }
const item = (id = 'z', value = '0001.2500'): Item => ({ id, value, nested: { list: ['original'] } });

describe.each(['json', 'postgres'])('%s repository compatibility contract', adapter => {
  let repository: Repository<Item>, unit: UnitOfWork;
  beforeEach(() => {
    if (adapter === 'json') {
      unit = new JsonUnitOfWork(); repository = new JsonRepository<Item>(`contract-${randomUUID()}.json`, true, 'Synthetic', unit as JsonUnitOfWork);
    } else {
      const fake = new FakePg(); unit = new PostgresUnitOfWork(() => fake);
      repository = new PostgresRepository<Item>('testCaseStore', unit as PostgresUnitOfWork);
    }
  });
  it('returns undefined and empty collections; deleting missing IDs is a no-op', async () => {
    expect(await repository.findById('missing')).toBeUndefined(); expect(await repository.findAll()).toEqual([]);
    await repository.deleteItem('missing'); expect(await repository.findAll()).toEqual([]);
  });
  it('copies inputs before waiting and detaches every returned value', async () => {
    const input = item(), pending = repository.saveItem(input); input.nested.list.push('changed');
    const saved = await pending; saved.nested.list.push('changed');
    const found = (await repository.findById('z'))!; found.nested.list.push('changed');
    const all = await repository.findAll(); all[0].nested.list.push('changed'); all.push(item('other'));
    expect(await repository.findAll()).toEqual([item()]);
  });
  it('preserves insertion order on update and moves delete/reinsert to the end', async () => {
    await repository.saveItem(item('z')); await repository.saveItem(item('a'));
    await repository.saveItem(item('z', '9007199254740993'), true);
    expect((await repository.findAll()).map(row => row.id)).toEqual(['z', 'a']);
    await unit.write(async () => { await repository.deleteItem('z'); await repository.saveItem(item('z')); });
    expect((await repository.findAll()).map(row => row.id)).toEqual(['a', 'z']);
  });
  it('supports staged read-your-writes and atomic callback rollback', async () => {
    await expect(unit.write(async () => {
      await repository.saveItem(item()); expect(await repository.findById('z')).toEqual(item());
      await unit.read(async () => expect(await repository.findAll()).toEqual([item()]));
      throw new Error('Synthetic domain rejection');
    })).rejects.toThrow('Synthetic domain rejection');
    expect(await repository.findAll()).toEqual([]);
  });
  it('marks rejected nested writes rollback-only even when caught', async () => {
    await expect(unit.write(async () => {
      try { await unit.write(async () => { await repository.saveItem(item()); throw new Error('domain'); }); } catch { /* must still roll back */ }
      await repository.saveItem(item('a'));
    })).rejects.toThrow();
    expect(await repository.findAll()).toEqual([]);
  });
  it('rejects writes inside reads and reuses no closed context', async () => {
    await expect(unit.read(() => repository.saveItem(item()))).rejects.toThrow();
    let release!: () => void, escaped!: Promise<unknown>;
    await unit.read(async () => { const gate = new Promise<void>(resolve => { release = resolve; }); escaped = gate.then(() => repository.findAll()); });
    release(); await expect(escaped).rejects.toThrow();
    expect(await repository.findAll()).toEqual([]);
  });
  it('serializes concurrent increments without losing updates', async () => {
    await repository.saveItem(item('counter', '0'));
    await Promise.all(Array.from({ length: 15 }, () => unit.write(async () => {
      const current = (await repository.findById('counter'))!;
      await Promise.resolve(); await repository.saveItem({ ...current, value: String(Number(current.value) + 1) });
    })));
    expect((await repository.findById('counter'))!.value).toBe('15');
  });
  it('preserves JSON representation of optional fields and exact decimal strings', async () => {
    const input = { ...item(), optional: undefined };
    await unit.write(async () => {
      await repository.saveItem(input);
      expect(Object.hasOwn((await repository.findById('z'))!, 'optional')).toBe(true);
    });
    expect(JSON.stringify(await repository.findById('z'))).toBe(JSON.stringify(input));
  });
});
