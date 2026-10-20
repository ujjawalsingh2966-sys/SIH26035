import { Pool } from 'pg';
import { readDatabaseConfig } from '../config/database';

export class DatabaseConnectionError extends Error {
  constructor() { super('PostgreSQL operation could not be completed.'); this.name = 'DatabaseConnectionError'; }
}

let sharedPool: Pool | undefined;
let closing: Promise<void> | undefined;

/** Reused within one warm Node.js instance. No connection is opened by imports. */
export function getDatabasePool(): Pool {
  if (closing) throw new DatabaseConnectionError();
  if (sharedPool) return sharedPool;
  const configuration = readDatabaseConfig();
  try {
    const pool = new Pool(configuration);
    // Raw driver messages/stacks can contain connection details. Never log them.
    pool.on('error', () => { console.warn('PostgreSQL idle connection became unavailable.'); });
    sharedPool = pool;
    return pool;
  } catch { throw new DatabaseConnectionError(); }
}

/** The only SQL in this plumbing phase. No prepared names or session state. */
export async function checkDatabaseConnection(): Promise<void> {
  const pool = getDatabasePool();
  try {
    const result = await pool.query<{ ok: number }>('SELECT 1 AS ok');
    if (result.rows.length !== 1 || result.rows[0].ok !== 1) throw new Error();
  } catch { throw new DatabaseConnectionError(); }
}

/** For explicit CLI cleanup/shutdown, not for the end of each web request. */
export function closeDatabasePool(): Promise<void> {
  if (closing) return closing;
  if (!sharedPool) return Promise.resolve();
  const pool = sharedPool;
  closing = Promise.resolve().then(() => pool.end()).then(() => {
    sharedPool = undefined;
    closing = undefined;
  }, () => {
    // Do not allocate another pool if the previous pool could not be closed.
    // Keep the rejected closing promise so future access fails closed.
    throw new DatabaseConnectionError();
  });
  return closing;
}
