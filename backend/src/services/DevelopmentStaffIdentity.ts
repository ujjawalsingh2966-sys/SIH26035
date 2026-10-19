import { createHash } from 'crypto';
import { auditStore, testCaseStore } from '../repositories';
import { evidenceStore } from './EvidenceService';

// Legacy ownership lookup ONLY: registration reservations and explicit operator
// adoption. Never used to authenticate, issue sessions, or choose a staff role.
export const developmentStaffId = (email: string) => email === 'technician@example.com'
  ? 'dev-user-01' : `dev-${createHash('sha256').update(email).digest('hex').slice(0, 24)}`;

const documentedStaff = new Set([
  'technician@example.com', 'technician2@example.com', 'reviewer@example.com', 'admin@example.com'
]);

export function isKnownStaffEmail(email: string): boolean {
  if (documentedStaff.has(email)) return true;
  const id = developmentStaffId(email);
  return testCaseStore.findAll().some(record => record.technicianId === id || record.reviewerId === id)
    || auditStore.findAll().some(record => record.actorId === id)
    || evidenceStore.findAll().some(record => record.uploadedBy === id);
}
