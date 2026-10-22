import fs from 'fs';
import { randomUUID } from 'crypto';
import { JsonStore } from '../src/repositories/JsonStore';

describe('Atomic JSON deletion compatibility', () => {
  afterEach(() => jest.restoreAllMocks());

  it('retains persisted and in-memory data when rename fails, then permits a retry', () => {
    const filename = `atomic-deletion-${randomUUID()}.json`;
    const store = new JsonStore<{ id: string; value: string }>(filename);
    const record = { id: 'test-observation', value: '12.30' };
    store.saveItem(record);
    jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw Object.assign(new Error('Synthetic Windows locked file'), { code: 'EPERM' });
    });
    expect(() => store.deleteItem(record.id)).toThrow('Cannot persist data store');
    expect(store.findById(record.id)).toEqual(record);
    expect(new JsonStore(filename).findById(record.id)).toEqual(record);
    jest.restoreAllMocks();
    expect(store.deleteItem(record.id)).toBe(true);
    expect(store.deleteItem(record.id)).toBe(false);
    expect(new JsonStore(filename).findById(record.id)).toBeUndefined();
  });
});
