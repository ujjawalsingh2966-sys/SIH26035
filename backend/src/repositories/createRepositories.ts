import { readPersistenceAdapter, PersistenceConfigurationError } from '../config/persistence';
import type { RepositoryBundle, RepositoryEntities } from './RepositoryBundle';
import type { SqlPool } from './postgres/PostgresUnitOfWork';

export interface RepositoryFactoryOptions { environment?: NodeJS.ProcessEnv; postgresPool?: SqlPool }

/** Explicit internal injection is for synthetic tests, never HTTP input or a fallback. */
export function createRepositories(options: RepositoryFactoryOptions = {}): RepositoryBundle {
  const environment = options.environment ?? process.env;
  const adapter = readPersistenceAdapter(environment);
  if (adapter === 'json') {
    const { createJsonRepositories } = require('./createJsonRepositories') as typeof import('./createJsonRepositories');
    return Object.freeze(createJsonRepositories());
  }
  if (!options.postgresPool) {
    const { readDatabaseConfig } = require('../config/database') as typeof import('../config/database');
    readDatabaseConfig(environment); // Validation only. No pool construction or network.
    if (options.environment && options.environment !== process.env) {
      // Production pool reads process.env. Never validate one environment and use another.
      throw new PersistenceConfigurationError();
    }
  }
  const { PostgresUnitOfWork } = require('./postgres/PostgresUnitOfWork') as typeof import('./postgres/PostgresUnitOfWork');
  const { PostgresRepository } = require('./postgres/PostgresRepository') as typeof import('./postgres/PostgresRepository');
  const unitOfWork = new PostgresUnitOfWork(() => {
    if (options.postgresPool) return options.postgresPool;
    const { getDatabasePool } = require('../database/pool') as typeof import('../database/pool');
    return getDatabasePool();
  });
  const repository = <K extends keyof RepositoryEntities>(name: K) => new PostgresRepository<RepositoryEntities[K]>(name, unitOfWork);
  return Object.freeze<RepositoryBundle>({ adapter, unitOfWork,
    manufacturerStore: repository('manufacturerStore'), instrumentStore: repository('instrumentStore'),
    testCaseStore: repository('testCaseStore'), observationStore: repository('observationStore'),
    auditStore: repository('auditStore'), nativeTestStore: repository('nativeTestStore'),
    evidenceStore: repository('evidenceStore'), accountStore: repository('accountStore'),
    staffStore: repository('staffStore'), sessionStore: repository('sessionStore'),
    businessApplicationStore: repository('businessApplicationStore') });
}

let selected: RepositoryBundle | undefined;
export function getRepositories(): RepositoryBundle {
  return selected ??= createRepositories();
}
