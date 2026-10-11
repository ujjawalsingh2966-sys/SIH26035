import fs from 'fs';
import { JsonStore } from '../src/repositories/JsonStore';

describe('Observation deletion persistence', () => {
  it('restores the in-memory record when the atomic file replacement fails', () => {
    const store = new JsonStore<{ id: string; value: string }>('delete-rollback.json');
    const record = { id: 'observation-1', value: '12.30' };
    store.saveItem(record);
    const rename = jest.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('Simulated storage failure');
    });
    try {
      expect(() => store.deleteItem(record.id)).toThrow('Cannot persist data store');
      expect(store.findById(record.id)).toEqual(record);
      expect(new JsonStore('delete-rollback.json').findById(record.id)).toEqual(record);
    } finally {
      rename.mockRestore();
    }
    expect(store.deleteItem(record.id)).toBe(true);
    expect(new JsonStore('delete-rollback.json').findById(record.id)).toBeUndefined();
  });
});
