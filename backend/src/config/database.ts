import { X509Certificate } from 'crypto';
import type { PoolConfig } from 'pg';

export class DatabaseConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = 'DatabaseConfigurationError'; }
}

/** No dotenv, JWT, JSON storage or connection initialization at import time. */
export function readDatabaseConfig(environment?: NodeJS.ProcessEnv): PoolConfig {
  if (typeof window !== 'undefined' || typeof process === 'undefined' || !process.versions?.node) {
    throw new DatabaseConfigurationError('PostgreSQL configuration is server-only.');
  }
  const values = environment ?? process.env;
  const raw = values.DATABASE_URL?.trim();
  if (!raw) throw new DatabaseConfigurationError('DATABASE_URL is required for an explicit database operation.');

  let url: URL;
  try { url = new URL(raw); }
  catch { throw new DatabaseConfigurationError('DATABASE_URL must be a valid PostgreSQL connection URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username
    || !url.password || url.pathname.length < 2 || url.hash) {
    throw new DatabaseConfigurationError('DATABASE_URL must specify a PostgreSQL host, account and database.');
  }
  // pg's URL parser can override the explicit ssl object. Only these documented
  // sslmode values are accepted, then removed so verification cannot be weakened.
  for (const [key, value] of url.searchParams) {
    if (key !== 'sslmode' || !['require', 'verify-full'].includes(value)) {
      throw new DatabaseConfigurationError('DATABASE_URL contains unsupported or insecure connection options.');
    }
  }
  url.searchParams.delete('sslmode');

  const suppliedMax = values.DATABASE_POOL_MAX;
  if (suppliedMax !== undefined && !/^[1-5]$/.test(suppliedMax)) {
    throw new DatabaseConfigurationError('DATABASE_POOL_MAX must be an integer from 1 to 5.');
  }
  const ssl: NonNullable<Exclude<PoolConfig['ssl'], boolean>> = {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
  };
  if (values.DATABASE_SSL_CA !== undefined) {
    const ca = values.DATABASE_SSL_CA.replace(/\\n/g, '\n').trim();
    const pattern = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
    const certificates = ca.match(pattern);
    try {
      if (!certificates?.length || ca.replace(pattern, '').trim()) throw new Error();
      for (const certificate of certificates) new X509Certificate(certificate);
    } catch { throw new DatabaseConfigurationError('DATABASE_SSL_CA must contain valid PEM CA certificates only.'); }
    ssl.ca = ca;
  }
  return {
    connectionString: url.toString(),
    max: suppliedMax === undefined ? 2 : Number(suppliedMax),
    min: 0,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    idleTimeoutMillis: 5000,
    ssl,
    application_name: 'w8lab-backend',
  };
}
