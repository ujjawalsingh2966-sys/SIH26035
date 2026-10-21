import fs from 'fs';
import { randomUUID } from 'crypto';
import { JsonStore } from '../src/repositories/JsonStore';
import { JsonRepository } from '../src/repositories/JsonRepository';
import { JsonUnitOfWork } from '../src/repositories/JsonUnitOfWork';

interface SyntheticRecord { id: string; value: string }
const record = (value: string): SyntheticRecord => ({ id: 'staff-fixture', value });
afterEach(() => jest.restoreAllMocks());

describe('P4A prerequisite: strict JSON replacement failures', () => {
  it('does not publish a failed Windows EPERM replacement and permits a verified subsequent retry', () => {
    const filename = `p4a-staff-${randomUUID()}.json`;
    const store = new JsonStore<SyntheticRecord>(filename, true, 'Staff');
    store.saveItem(record('original'));
    const rename = fs.renameSync;
    jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      const error = Object.assign(new Error('Synthetic Windows sharing violation'), {
        code: 'EPERM', syscall: 'rename'
      });
      throw error;
    });
    expect(() => store.saveItem(record('not-committed'))).toThrow('Staff storage is unavailable');
    expect(store.findAll()).toEqual([record('original')]);
    expect(new JsonStore<SyntheticRecord>(filename, true, 'Staff').findAll()).toEqual([record('original')]);
    // Retry only after the injected failure is removed: no permissive fallback or non-atomic overwrite.
    jest.restoreAllMocks();
    expect(fs.renameSync).toBe(rename);
    store.saveItem(record('committed'));
    expect(new JsonStore<SyntheticRecord>(filename, true, 'Staff').findAll()).toEqual([record('committed')]);
  });

  it('stops the unit of work when both replacement and rollback fail; never claims a durable commit', async () => {
    const filename = `p4a-rollback-${randomUUID()}.json`;
    const unit = new JsonUnitOfWork();
    const repository = new JsonRepository<SyntheticRecord>(filename, true, 'Staff', unit);
    await repository.saveItem(record('original'));
    jest.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw Object.assign(new Error('Synthetic Windows EPERM'), { code: 'EPERM', syscall: 'rename' });
    });
    await expect(repository.saveItem(record('uncommitted'))).rejects.toThrow('operator recovery');
    jest.restoreAllMocks();
    await expect(repository.findAll()).rejects.toThrow('operator recovery');
    expect(new JsonStore<SyntheticRecord>(filename, true, 'Staff').findAll()).toEqual([record('original')]);
  });
});
