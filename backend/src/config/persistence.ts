export type PersistenceAdapter = 'json' | 'postgres';

export class PersistenceConfigurationError extends Error {
  constructor() { super('Invalid server persistence configuration. Use json or postgres.'); this.name = 'PersistenceConfigurationError'; }
}

/** No dotenv, file access, pool construction or application imports. */
export function readPersistenceAdapter(environment?: NodeJS.ProcessEnv): PersistenceAdapter {
  if (typeof window !== 'undefined' || typeof process === 'undefined' || !process.versions?.node) throw new PersistenceConfigurationError();
  const adapter = (environment ?? process.env).PERSISTENCE_ADAPTER;
  if (adapter === undefined) return 'json';
  if (adapter !== 'json' && adapter !== 'postgres') throw new PersistenceConfigurationError();
  return adapter;
}
