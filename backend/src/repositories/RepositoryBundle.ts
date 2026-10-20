import type { Repository, UnitOfWork } from './Repository';
import type { PersistenceAdapter } from '../config/persistence';
import type { Manufacturer, Instrument, TestCase, ObservationRecord, AuditRecord } from '../types/domain';
import type { NativeTestRecord } from '../types/native';
import type { EvidenceRecord } from '../types/evidence';
import type { Account, StaffAccount, SessionRecord } from '../types/identity';
import type { BusinessApplication } from '../types/businessApplication';

export interface RepositoryEntities {
  manufacturerStore: Manufacturer;
  instrumentStore: Instrument;
  testCaseStore: TestCase;
  observationStore: ObservationRecord;
  auditStore: AuditRecord;
  nativeTestStore: NativeTestRecord;
  evidenceStore: EvidenceRecord;
  accountStore: Account;
  staffStore: StaffAccount;
  sessionStore: SessionRecord;
  businessApplicationStore: BusinessApplication;
}
export type RepositoryStores = { [K in keyof RepositoryEntities]: Repository<RepositoryEntities[K]> };
export type RepositoryBundle = RepositoryStores & { readonly adapter: PersistenceAdapter; readonly unitOfWork: UnitOfWork };
