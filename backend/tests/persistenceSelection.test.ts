import { readPersistenceAdapter, PersistenceConfigurationError } from '../src/config/persistence';
import { FakePg } from './helpers/fakePg';

afterEach(() => {
  jest.dontMock('../src/database/pool');
  jest.dontMock('../src/repositories/createJsonRepositories');
  jest.dontMock('../src/config/database');
  jest.restoreAllMocks();
});

it.each([undefined, 'json', 'postgres'])('accepts explicit selection/default: %s', value => {
  expect(readPersistenceAdapter(value === undefined ? {} : { PERSISTENCE_ADAPTER: value })).toBe(value ?? 'json');
});
it.each(['', 'JSON', ' postgres ', 'sqlite', 'private-invalid-value'])('rejects invalid selection without echo: %s', value => {
  expect(() => readPersistenceAdapter({ PERSISTENCE_ADAPTER: value })).toThrow(PersistenceConfigurationError);
  try { readPersistenceAdapter({ PERSISTENCE_ADAPTER: value }); } catch (error) { expect((error as Error).message).not.toContain(value || 'EMPTY_PLACEHOLDER'); }
});

it('JSON selection does not import the PostgreSQL pool or require DATABASE_URL', () => {
  jest.isolateModules(() => {
    jest.doMock('../src/database/pool', () => { throw new Error('PostgreSQL pool imported in JSON mode'); });
    const { createRepositories } = require('../src/repositories/createRepositories');
    const bundle = createRepositories({ environment: {} });
    expect(bundle.adapter).toBe('json'); expect(Object.keys(bundle)).toHaveLength(13); expect(Object.isFrozen(bundle)).toBe(true);
  });
});

it('PostgreSQL selection does not load JSON application adapters and contains all 11 stores', () => {
  jest.isolateModules(() => {
    jest.doMock('../src/repositories/createJsonRepositories', () => { throw new Error('JSON adapter imported in PostgreSQL mode'); });
    const { createRepositories } = require('../src/repositories/createRepositories');
    const fake = new FakePg();
    const bundle = createRepositories({ environment: { PERSISTENCE_ADAPTER: 'postgres' }, postgresPool: fake });
    expect(bundle.adapter).toBe('postgres'); expect(Object.keys(bundle)).toHaveLength(13); expect(fake.acquisitions).toBe(0); expect(Object.isFrozen(bundle)).toBe(true);
    expect(Object.values(bundle).filter(value => value && typeof value === 'object' && 'findAll' in value)).toHaveLength(11);
  });
});

it('real PostgreSQL selection wires service exports to one lazy bundle without creating JSON stores', async () => {
  const previous = process.env.PERSISTENCE_ADAPTER, fake = new FakePg();
  let bundle: import('../src/repositories/RepositoryBundle').RepositoryBundle;
  const getPool = jest.fn(() => fake);
  try {
    process.env.PERSISTENCE_ADAPTER = 'postgres';
    jest.isolateModules(() => {
      jest.doMock('../src/config/database', () => ({ readDatabaseConfig: jest.fn(() => ({})) }));
      jest.doMock('../src/database/pool', () => ({ getDatabasePool: getPool }));
      jest.doMock('../src/repositories/createJsonRepositories', () => { throw new Error('JSON application adapter must not load'); });
      bundle = require('../src/repositories/createRepositories').getRepositories();
      const stores = require('../src/repositories');
      expect(bundle.adapter).toBe('postgres'); expect(getPool).not.toHaveBeenCalled();
      expect(require('../src/repositories/persistence').unitOfWork).toBe(bundle.unitOfWork);
      for (const [file, name] of [['AccountService', 'accountStore'], ['StaffService', 'staffStore'], ['SessionService', 'sessionStore'],
        ['EvidenceService', 'evidenceStore'], ['BusinessApplicationService', 'businessApplicationStore']]) {
        expect(require(`../src/services/${file}`)[name]).toBe(stores[name]);
      }
    });
    await bundle!.testCaseStore.findAll(); expect(getPool).toHaveBeenCalledTimes(1); expect(fake.acquisitions).toBe(1);
  } finally {
    if (previous === undefined) delete process.env.PERSISTENCE_ADAPTER; else process.env.PERSISTENCE_ADAPTER = previous;
  }
});

it('all existing service imports and the unit of work share the selected singleton', () => {
  const stores = require('../src/repositories');
  const { getRepositories } = require('../src/repositories/createRepositories');
  expect(getRepositories()).toBe(getRepositories());
  expect(require('../src/repositories/persistence').unitOfWork).toBe(getRepositories().unitOfWork);
  for (const [file, name] of [['AccountService', 'accountStore'], ['StaffService', 'staffStore'], ['SessionService', 'sessionStore'],
    ['EvidenceService', 'evidenceStore'], ['BusinessApplicationService', 'businessApplicationStore']]) {
    expect(require(`../src/services/${file}`)[name]).toBe(stores[name]);
  }
});

it('PostgreSQL operation failure never creates or switches to JSON', async () => {
  const { createRepositories } = require('../src/repositories/createRepositories');
  const fake = new FakePg(); fake.acquireFails = true;
  const bundle = createRepositories({ environment: { PERSISTENCE_ADAPTER: 'postgres' }, postgresPool: fake });
  await expect(bundle.testCaseStore.findAll()).rejects.toThrow('Storage is unavailable');
  expect(bundle.adapter).toBe('postgres'); expect(fake.calls).toEqual([]);
});

it('explicit PostgreSQL selection with missing configuration fails before pool construction', () => {
  jest.isolateModules(() => {
    const { createRepositories } = require('../src/repositories/createRepositories');
    expect(() => createRepositories({ environment: { PERSISTENCE_ADAPTER: 'postgres' } })).toThrow('DATABASE_URL is required');
  });
});

it('does not change the selected singleton when environment selection changes later', () => {
  const previous = process.env.PERSISTENCE_ADAPTER;
  try {
    process.env.PERSISTENCE_ADAPTER = 'json';
    jest.isolateModules(() => {
      const { getRepositories } = require('../src/repositories/createRepositories');
      const first = getRepositories();
      process.env.PERSISTENCE_ADAPTER = 'postgres';
      expect(getRepositories()).toBe(first); expect(first.adapter).toBe('json');
    });
  } finally {
    if (previous === undefined) delete process.env.PERSISTENCE_ADAPTER; else process.env.PERSISTENCE_ADAPTER = previous;
  }
});

it('rejects browser use with a sanitized server-only configuration error', () => {
  const target = globalThis as typeof globalThis & { window?: unknown };
  const descriptor = Object.getOwnPropertyDescriptor(target, 'window');
  try {
    Object.defineProperty(target, 'window', { value: {}, configurable: true });
    expect(() => readPersistenceAdapter({})).toThrow(PersistenceConfigurationError);
    expect(() => readPersistenceAdapter()).toThrow(PersistenceConfigurationError);
    const ts = require('typescript');
    const source = require('fs').readFileSync(require.resolve('../src/config/persistence'), 'utf8');
    const exports: Record<string, any> = {};
    require('vm').runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
      { exports, window: {}, process: undefined });
    expect(() => exports.readPersistenceAdapter()).toThrow('Invalid server persistence configuration');
  } finally {
    if (descriptor) Object.defineProperty(target, 'window', descriptor); else Reflect.deleteProperty(target, 'window');
  }
});
