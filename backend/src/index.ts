import app from './app';
import { config } from './config/env';
import { logger } from './utils/logger';

type SafeDbError = { code?: unknown; message?: unknown };

function databaseFailureKind(error: unknown): string {
  const value = error && typeof error === 'object' ? error as SafeDbError : {};
  const code = typeof value.code === 'string' ? value.code : '';
  const message = typeof value.message === 'string' ? value.message : '';

  if (['ENETUNREACH', 'EHOSTUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT'].includes(code)) return 'network-' + code;
  if (['28P01', '28000'].includes(code)) return 'authentication';
  if (['42501'].includes(code)) return 'database-permission';
  if (['3D000'].includes(code)) return 'database-name';
  if (['SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(code) || /certificate|self.signed|unable to verify/i.test(message)) return 'tls-verification';
  if (/tenant or user not found/i.test(message)) return 'pooler-user-or-host';
  return 'unclassified';
}

/** Staging-only, opt-in, one-time read-only connectivity diagnosis. Logs never contain credentials or SQL errors. */
async function diagnoseDatabaseOnce(): Promise<void> {
  if (process.env.W8LAB_STAGING_DB_DIAGNOSTIC !== '1' || process.env.PERSISTENCE_ADAPTER !== 'postgres') return;
  let phase = 'connect';
  let client: import('pg').PoolClient | undefined;
  try {
    const { getDatabasePool } = await import('./database/pool');
    client = await getDatabasePool().connect();
    phase = 'read';
    await client.query('BEGIN READ ONLY');
    await client.query('SELECT id FROM w8lab.staff_accounts LIMIT 0');
    await client.query('ROLLBACK');
    logger.info('Staging PostgreSQL diagnosis: CONNECT_AND_SCHEMA_READ_OK');
  } catch (error) {
    logger.warn('Staging PostgreSQL diagnosis: failed at ' + phase + ' (' + databaseFailureKind(error) + ')');
    if (client) {
      try { await client.query('ROLLBACK'); } catch { /* no raw error output */ }
    }
  } finally {
    if (client) client.release();
  }
}

const startServer = () => {
  try {
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
      void diagnoseDatabaseOnce();
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
