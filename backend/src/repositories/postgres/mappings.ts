import type { RepositoryEntities } from '../RepositoryBundle';
import { PersistenceError } from '../PersistenceError';

export type StoreName = keyof RepositoryEntities;
export interface RelationalMapping {
  readonly table: string;
  readonly rank: number;
  readonly columns: readonly string[];
  readonly fields: readonly string[];
  readonly identityKind?: 'staff' | 'business';
}
/** Static allowlist only. Schema/constraints/RLS are deliberately not created here. */
export const MAPPINGS: Readonly<Record<StoreName, RelationalMapping>> = {
  accountStore: { table: 'business_accounts', rank: 0, columns: ['email_normalized', 'active'], fields: ['email', 'active'], identityKind: 'business' },
  staffStore: { table: 'staff_accounts', rank: 0, columns: ['email_normalized', 'active', 'role', 'credential_version'], fields: ['email', 'active', 'role', 'credentialVersion'], identityKind: 'staff' },
  sessionStore: { table: 'sessions', rank: 1, columns: ['account_id', 'kind', 'expires_at', 'revoked_at'], fields: ['accountId', 'kind', 'expiresAt', 'revokedAt'] },
  manufacturerStore: { table: 'manufacturers', rank: 1, columns: ['identifier_normalized', 'name_normalized', 'address_normalized'], fields: ['identifier', 'name', 'address'] },
  instrumentStore: { table: 'instruments', rank: 2, columns: ['manufacturer_id', 'serial_normalized'], fields: ['manufacturerId', 'serialNumber'] },
  testCaseStore: { table: 'test_cases', rank: 3, columns: ['instrument_id', 'technician_id', 'reviewer_id', 'status', 'revision'], fields: ['instrumentId', 'technicianId', 'reviewerId', 'status', 'revision'] },
  observationStore: { table: 'observations', rank: 4, columns: ['test_case_id', 'test_type', 'sequence'], fields: ['testCaseId', 'testType', 'sequence'] },
  nativeTestStore: { table: 'native_tests', rank: 4, columns: ['test_case_id', 'programme_id', 'procedure_id', 'series'], fields: ['testCaseId', 'programmeId', 'submission.procedureId', 'submission.series'] },
  evidenceStore: { table: 'evidence', rank: 4, columns: ['test_case_id', 'uploaded_by'], fields: ['testCaseId', 'uploadedBy'] },
  auditStore: { table: 'audit_events', rank: 5, columns: ['test_case_id', 'actor_id', 'action', 'occurred_at'], fields: ['testCaseId', 'actorId', 'action', 'timestamp'] },
  businessApplicationStore: { table: 'business_applications', rank: 4, columns: ['owner_id', 'submission_key', 'status'], fields: ['ownerId', 'submissionKey', 'status'] },
};
for (const mapping of Object.values(MAPPINGS)) {
  Object.freeze(mapping.columns); Object.freeze(mapping.fields); Object.freeze(mapping);
}
Object.freeze(MAPPINGS);

export function mappingFor(name: StoreName): RelationalMapping {
  if (!Object.prototype.hasOwnProperty.call(MAPPINGS, name)) throw new PersistenceError('invalid-record');
  return MAPPINGS[name];
}

export function projections(mapping: RelationalMapping, record: { id: string }): unknown[] {
  return mapping.fields.map((field, index) => {
    let value: unknown = record;
    for (const part of field.split('.')) {
      value = value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, part)
        ? (value as Record<string, unknown>)[part] : undefined;
    }
    if (mapping.columns[index].endsWith('_normalized') && typeof value === 'string') {
      // Same JS normalization as the existing services, not database locale rules.
      return field === 'email' ? value.trim().toLowerCase() : value.trim().replace(/\s+/g, ' ').toLowerCase();
    }
    return value === undefined ? null : value;
  });
}
