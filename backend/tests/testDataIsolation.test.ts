import fs from 'fs';
import os from 'os';
import path from 'path';

it('keeps Jest writes isolated even when NODE_ENV and DATA_DIR name an existing dataset', () => {
  // This sentinel is synthetic data, never a project record.
  const sentinelDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'nawi-isolation-sentinel-'));
  const sentinelFile = path.join(sentinelDirectory, 'testCases.json');
  const sentinel = JSON.stringify([{ id: 'do-not-change' }]);
  fs.writeFileSync(sentinelFile, sentinel);
  const previous = { nodeEnv: process.env.NODE_ENV, dataDir: process.env.DATA_DIR };
  try {
    process.env.NODE_ENV = 'development';
    process.env.DATA_DIR = sentinelDirectory;
    expect(process.env.JEST_WORKER_ID).toBeDefined();
    jest.isolateModules(() => {
      const { JsonStore } = require('../src/repositories/JsonStore');
      const store = new JsonStore('testCases.json');
      expect(store.findAll()).toEqual([]);
      store.saveItem({ id: 'isolated-write' });
      store.clear();
    });
    expect(fs.readFileSync(sentinelFile, 'utf8')).toBe(sentinel);
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.dataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous.dataDir;
  }
});
