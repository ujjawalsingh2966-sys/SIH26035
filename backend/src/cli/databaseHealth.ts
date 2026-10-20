import dotenv from 'dotenv';
import path from 'path';
import { checkDatabaseConnection, closeDatabasePool } from '../database/pool';

/** Importing this CLI is inert. --connect is required before loading configuration. */
export async function runDatabaseHealth(args = process.argv.slice(2)): Promise<number> {
  if (args.length !== 1 || args[0] !== '--connect') {
    process.stderr.write('Database check not run. After approval, use db:health -- --connect.\n');
    return 2;
  }
  let failed = false;
  try {
    // Backend-relative path works from both src/cli and dist/cli. Vercel-injected
    // environment wins; a local file is optional. No application/JWT imports.
    const loaded = dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false, debug: false });
    if (loaded.error && (loaded.error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error();
    await checkDatabaseConnection();
  } catch { failed = true; }
  finally {
    try { await closeDatabasePool(); }
    catch { failed = true; }
  }
  if (failed) {
    process.stderr.write('PostgreSQL check failed. Check private configuration, TLS and database reachability.\n');
    return 1;
  }
  process.stdout.write('PostgreSQL connection check OK. No application data was read or changed.\n');
  return 0;
}

if (require.main === module) {
  runDatabaseHealth().then(code => { process.exitCode = code; }).catch(() => {
    process.stderr.write('PostgreSQL check could not be completed.\n');
    process.exitCode = 1;
  });
}
