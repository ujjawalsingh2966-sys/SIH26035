import { JsonRepository } from './JsonRepository';
import { JsonUnitOfWork } from './JsonUnitOfWork';
import type { RepositoryBundle } from './RepositoryBundle';

/** Loaded only for JSON selection. Preserve filenames, load policies and storage labels. */
export function createJsonRepositories(): RepositoryBundle {
  const unitOfWork = new JsonUnitOfWork();
  return {
    adapter: 'json', unitOfWork,
    manufacturerStore: new JsonRepository('manufacturers.json', true, 'Manufacturer', unitOfWork),
    instrumentStore: new JsonRepository('instruments.json', true, 'Instrument', unitOfWork),
    testCaseStore: new JsonRepository('testCases.json', false, 'Account', unitOfWork),
    observationStore: new JsonRepository('observations.json', false, 'Account', unitOfWork),
    auditStore: new JsonRepository('audit.json', false, 'Account', unitOfWork),
    nativeTestStore: new JsonRepository('nativeTests.json', true, 'Native test', unitOfWork),
    evidenceStore: new JsonRepository('evidence.json', false, 'Account', unitOfWork),
    accountStore: new JsonRepository('accounts.json', true, 'Account', unitOfWork),
    staffStore: new JsonRepository('staffAccounts.json', true, 'Staff', unitOfWork),
    sessionStore: new JsonRepository('sessions.json', true, 'Session', unitOfWork),
    businessApplicationStore: new JsonRepository('applications.json', true, 'Application', unitOfWork),
  };
}
