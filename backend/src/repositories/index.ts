import { getRepositories } from './createRepositories';

export const { manufacturerStore, instrumentStore, testCaseStore, observationStore, auditStore,
  nativeTestStore, evidenceStore, accountStore, staffStore, sessionStore, businessApplicationStore } = getRepositories();
