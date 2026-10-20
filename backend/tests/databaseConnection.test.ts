import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import { rootCertificates } from 'tls';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { readDatabaseConfig } from '../src/config/database';
import { getDatabasePool, closeDatabasePool, checkDatabaseConnection, DatabaseConnectionError } from '../src/database/pool';
import { runDatabaseHealth } from '../src/cli/databaseHealth';

jest.mock('pg', () => ({ Pool: jest.fn() }));

const Constructor = Pool as unknown as jest.Mock;
const address = new URL('postgresql://synthetic.invalid:6543/postgres');
address.username = 'synthetic-account';
address.password = randomBytes(24).toString('hex');
const syntheticUrl = address.toString();
let environment: NodeJS.ProcessEnv;
let fake: EventEmitter & { query: jest.Mock; end: jest.Mock; connect: jest.Mock };
let output: jest.SpyInstance, errors: jest.SpyInstance, warnings: jest.SpyInstance;
let loadEnvironment: jest.SpyInstance;

beforeEach(() => {
  environment = process.env;
  process.env = { NODE_ENV: 'test', DATABASE_URL: syntheticUrl };
  fake = Object.assign(new EventEmitter(), {
    query: jest.fn().mockResolvedValue({ rows: [{ ok: 1 }] }),
    end: jest.fn().mockResolvedValue(undefined), connect: jest.fn(),
  });
  Constructor.mockReset().mockImplementation(() => fake);
  // Never read a real .env, even when exercising the explicit CLI success path.
  loadEnvironment = jest.spyOn(dotenv, 'config').mockReturnValue({ parsed: {} });
  output = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  errors = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  warnings = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(async () => {
  try { await closeDatabasePool(); }
  finally { process.env = environment; jest.restoreAllMocks(); }
});

it('uses a small bounded pool, finite timeouts and verified TLS by default', () => {
  const config = readDatabaseConfig();
  expect(config).toMatchObject({ max: 2, min: 0, connectionTimeoutMillis: 5000,
    query_timeout: 10000, idleTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: true, minVersion: 'TLSv1.2' } });
  expect(config.connectionString).toBe(syntheticUrl);
  expect(Constructor).not.toHaveBeenCalled(); expect(loadEnvironment).not.toHaveBeenCalled();
});

it.each(['missing', 'empty', 'whitespace'])('rejects %s DATABASE_URL without returning its contents', kind => {
  const value = kind === 'missing' ? undefined : kind === 'empty' ? '' : '  ';
  expect(() => readDatabaseConfig({ DATABASE_URL: value })).toThrow('DATABASE_URL is required');
});

it.each(['malformed', 'protocol', 'host', 'account', 'password', 'database', 'fragment'])('rejects invalid connection URL: %s', kind => {
  const url = new URL(syntheticUrl);
  if (kind === 'account') url.username = '';
  if (kind === 'password') url.password = '';
  if (kind === 'database') url.pathname = '/';
  if (kind === 'fragment') url.hash = 'unsupported';
  const raw = kind === 'malformed' ? 'not-a-postgresql-url' : kind === 'host' ? 'postgresql:///'
    : kind === 'protocol' ? url.toString().replace(/^postgresql:/, 'https:') : url.toString();
  expect(() => readDatabaseConfig({ DATABASE_URL: raw })).toThrow(/DATABASE_URL/);
  try { readDatabaseConfig({ DATABASE_URL: raw }); }
  catch (error) { expect(String(error)).not.toContain(raw); expect(String(error)).not.toContain(address.password); }
});

it.each(['postgres:', 'postgresql:'])('supports the %s URL scheme', protocol => {
  const url = new URL(syntheticUrl); url.protocol = protocol;
  expect(readDatabaseConfig({ DATABASE_URL: url.toString() }).ssl).toMatchObject({ rejectUnauthorized: true });
});

it.each(['require', 'verify-full'])('normalizes sslmode=%s without letting pg override verified TLS', mode => {
  const url = new URL(syntheticUrl); url.searchParams.set('sslmode', mode);
  const config = readDatabaseConfig({ DATABASE_URL: url.toString() });
  expect(new URL(config.connectionString!).search).toBe('');
  expect(config.ssl).toMatchObject({ rejectUnauthorized: true });
});

it('preserves percent-encoded credential characters while normalizing TLS options', () => {
  const url = new URL(syntheticUrl);
  url.password = `${address.password}@:/?#% &`;
  url.searchParams.set('sslmode', 'require');
  const normalized = new URL(readDatabaseConfig({ DATABASE_URL: url.toString() }).connectionString!);
  expect(normalized.username).toBe(url.username); expect(normalized.password).toBe(url.password);
  expect(normalized.host).toBe(url.host); expect(normalized.pathname).toBe(url.pathname);
});

it.each(['sslmode=disable', 'sslmode=prefer', 'sslmode=no-verify', 'sslmode=verify-ca',
  'ssl=false', 'ssl=true', 'sslrootcert=some-file', 'sslcert=some-file', 'sslkey=some-file',
  'uselibpqcompat=true', 'query_timeout=0', 'options=unsupported', 'host=other.invalid',
  'sslmode=require&sslmode=disable'])('rejects unsupported TLS/driver URL options: %s', query => {
  const url = new URL(syntheticUrl); url.search = query;
  expect(() => readDatabaseConfig({ DATABASE_URL: url.toString() })).toThrow('unsupported or insecure');
});

it.each(['1', '2', '3', '4', '5'])('allows bounded DATABASE_POOL_MAX=%s', maximum => {
  expect(readDatabaseConfig({ DATABASE_URL: syntheticUrl, DATABASE_POOL_MAX: maximum }).max).toBe(Number(maximum));
});

it.each(['0', '6', '-1', '2.5', 'NaN', '', ' 2 ', '100000'])('rejects invalid pool maximum %p', maximum => {
  expect(() => readDatabaseConfig({ DATABASE_URL: syntheticUrl, DATABASE_POOL_MAX: maximum })).toThrow('from 1 to 5');
});

it.each([false, true])('accepts a trusted CA PEM without weakening verification (escaped=%s)', escaped => {
  const ca = rootCertificates[0];
  const supplied = escaped ? ca.replace(/\n/g, '\\n') : ca;
  const config = readDatabaseConfig({ DATABASE_URL: syntheticUrl, DATABASE_SSL_CA: supplied });
  expect(config.ssl).toMatchObject({ ca: ca.trim(), rejectUnauthorized: true });
});

it.each(['empty', 'malformed', 'extra-content'])('rejects invalid CA configuration: %s', kind => {
  const ca = kind === 'empty' ? '' : kind === 'extra-content' ? `${rootCertificates[0]}unexpected-content`
    : '-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----';
  expect(() => readDatabaseConfig({ DATABASE_URL: syntheticUrl, DATABASE_SSL_CA: ca })).toThrow('valid PEM CA');
});

it('rejects browser use before reading connection configuration', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
  try { expect(() => readDatabaseConfig()).toThrow('server-only'); }
  finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

it('imports configuration, pool and CLI without creating a pool, reading .env or querying', () => {
  jest.isolateModules(() => {
    const driver = require('pg');
    const localDotenv = require('dotenv');
    const loading = jest.spyOn(localDotenv, 'config').mockReturnValue({ parsed: {} });
    require('../src/config/database'); require('../src/database/pool'); require('../src/cli/databaseHealth');
    expect(driver.Pool).not.toHaveBeenCalled(); expect(loading).not.toHaveBeenCalled();
  });
  expect(fake.query).not.toHaveBeenCalled();
});

it('reuses one lazily constructed pool and does not connect just to obtain it', () => {
  expect(getDatabasePool()).toBe(getDatabasePool()); expect(Constructor).toHaveBeenCalledTimes(1);
  expect(fake.connect).not.toHaveBeenCalled(); expect(fake.query).not.toHaveBeenCalled();
  expect(fake.listenerCount('error')).toBe(1);
});

it('executes only the constant, unnamed read-only health query', async () => {
  await expect(checkDatabaseConnection()).resolves.toBeUndefined();
  expect(fake.query.mock.calls).toEqual([['SELECT 1 AS ok']]);
  expect(fake.end).not.toHaveBeenCalled();
});

it('sanitizes constructor failures without retaining the driver error as a cause', () => {
  Constructor.mockImplementationOnce(() => { throw new Error(syntheticUrl); });
  expect(() => getDatabasePool()).toThrow(DatabaseConnectionError);
  expect(output).not.toHaveBeenCalled(); expect(errors).not.toHaveBeenCalled(); expect(warnings).not.toHaveBeenCalled();
});

it('sanitizes query failures and does not echo credentials or raw error details', async () => {
  fake.query.mockRejectedValueOnce(new Error(syntheticUrl));
  await expect(checkDatabaseConnection()).rejects.toThrow('PostgreSQL operation could not be completed.');
  expect(output).not.toHaveBeenCalled(); expect(errors).not.toHaveBeenCalled(); expect(warnings).not.toHaveBeenCalled();
});

it.each([{ rows: [] }, { rows: [{ ok: 0 }] }, { rows: [{ ok: 1 }, { ok: 1 }] }])('does not report unexpected health responses as success: %#', async ({ rows }) => {
  fake.query.mockResolvedValueOnce({ rows });
  await expect(checkDatabaseConnection()).rejects.toThrow(DatabaseConnectionError);
});

it('handles background pool errors with a fixed message, never the raw driver error', () => {
  getDatabasePool();
  expect(() => fake.emit('error', new Error(syntheticUrl))).not.toThrow();
  expect(warnings.mock.calls).toEqual([['PostgreSQL idle connection became unavailable.']]);
});

it('closes once for concurrent cleanup and permits a fresh pool after successful cleanup', async () => {
  getDatabasePool();
  const first = closeDatabasePool(), second = closeDatabasePool();
  expect(first).toBe(second); await first; expect(fake.end).toHaveBeenCalledTimes(1);
  process.env.DATABASE_POOL_MAX = '3'; getDatabasePool();
  expect(Constructor).toHaveBeenCalledTimes(2); expect(Constructor.mock.calls[1][0].max).toBe(3);
});

it('does not create a connection pool just to clean up an unused module', async () => {
  await closeDatabasePool();
  expect(Constructor).not.toHaveBeenCalled(); expect(fake.end).not.toHaveBeenCalled();
});

it('rejects acquisition while shutdown is in progress', async () => {
  let release!: () => void;
  fake.end.mockReturnValueOnce(new Promise<void>(resolve => { release = resolve; }));
  getDatabasePool(); const pending = closeDatabasePool();
  expect(() => getDatabasePool()).toThrow(DatabaseConnectionError);
  release(); await pending;
});

it('does not allocate another pool after a failed shutdown', async () => {
  await jest.isolateModulesAsync(async () => {
    const driver = require('pg'); const local = require('../src/database/pool');
    driver.Pool.mockImplementation(() => fake); fake.end.mockRejectedValueOnce(new Error(syntheticUrl));
    local.getDatabasePool(); await expect(local.closeDatabasePool()).rejects.toThrow('could not be completed');
    expect(() => local.getDatabasePool()).toThrow('could not be completed');
    expect(driver.Pool).toHaveBeenCalledTimes(1);
  });
});

it.each([{ args: [] }, { args: ['--other'] }, { args: ['--connect', 'extra'] }])('requires an explicit CLI connection opt-in: %#', async ({ args }) => {
  expect(await runDatabaseHealth(args)).toBe(2);
  expect(loadEnvironment).not.toHaveBeenCalled(); expect(Constructor).not.toHaveBeenCalled();
  expect(fake.query).not.toHaveBeenCalled(); expect(output).not.toHaveBeenCalled();
});

it('performs an approved CLI check using mocks and closes before reporting success', async () => {
  expect(await runDatabaseHealth(['--connect'])).toBe(0);
  expect(loadEnvironment).toHaveBeenCalledWith({ path: expect.stringMatching(/backend[\\/]\.env$/), override: false, debug: false });
  expect(fake.query.mock.calls).toEqual([['SELECT 1 AS ok']]); expect(fake.end).toHaveBeenCalledTimes(1);
  expect(output).toHaveBeenCalledWith('PostgreSQL connection check OK. No application data was read or changed.\n');
  expect(errors).not.toHaveBeenCalled();
});

it('allows injected environment configuration when no local environment file exists', async () => {
  loadEnvironment.mockReturnValueOnce({ error: Object.assign(new Error(), { code: 'ENOENT' }) });
  expect(await runDatabaseHealth(['--connect'])).toBe(0); expect(fake.query).toHaveBeenCalledTimes(1);
});

it('fails safely before connecting when an environment file is unreadable', async () => {
  loadEnvironment.mockReturnValueOnce({ error: Object.assign(new Error(syntheticUrl), { code: 'EACCES' }) });
  expect(await runDatabaseHealth(['--connect'])).toBe(1); expect(Constructor).not.toHaveBeenCalled();
  expect(JSON.stringify(errors.mock.calls)).not.toContain(syntheticUrl); expect(output).not.toHaveBeenCalled();
});

it('rejects missing private configuration without constructing a pool', async () => {
  delete process.env.DATABASE_URL;
  expect(await runDatabaseHealth(['--connect'])).toBe(1); expect(Constructor).not.toHaveBeenCalled();
  expect(output).not.toHaveBeenCalled();
});

it('reports a failed CLI check safely and still closes the pool', async () => {
  fake.query.mockRejectedValueOnce(new Error(syntheticUrl));
  expect(await runDatabaseHealth(['--connect'])).toBe(1); expect(fake.end).toHaveBeenCalledTimes(1);
  expect(output).not.toHaveBeenCalled(); expect(JSON.stringify(errors.mock.calls)).not.toContain(syntheticUrl);
  expect(JSON.stringify(errors.mock.calls)).not.toContain(address.password);
});

it('does not print CLI success when shutdown fails, and sanitizes the failure', async () => {
  await jest.isolateModulesAsync(async () => {
    const driver = require('pg'), isolatedDotenv = require('dotenv');
    driver.Pool.mockImplementation(() => fake);
    jest.spyOn(isolatedDotenv, 'config').mockReturnValue({ parsed: {} });
    fake.end.mockRejectedValueOnce(new Error(syntheticUrl));
    const cli = require('../src/cli/databaseHealth');
    expect(await cli.runDatabaseHealth(['--connect'])).toBe(1);
    expect(fake.query).toHaveBeenCalledTimes(1); expect(fake.end).toHaveBeenCalledTimes(1);
    expect(output).not.toHaveBeenCalled(); expect(JSON.stringify(errors.mock.calls)).not.toContain(syntheticUrl);
  });
});
