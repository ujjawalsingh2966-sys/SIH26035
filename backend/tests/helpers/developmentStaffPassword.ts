import { randomBytes } from 'crypto';
import { hashStaffPassword, staffStore, StaffRole } from '../../src/services/StaffService';
import { developmentStaffId } from '../../src/services/DevelopmentStaffIdentity';
// Test-only credentials, freshly generated in memory. No production/demo default.
const password = randomBytes(24).toString('base64url');
let hash: Promise<string> | undefined;
export function developmentStaffPassword(): string { return password; }
export async function provisionLegacyTestStaff() {
  const passwordHash = await (hash ||= hashStaffPassword(password));
  for (const [email, role] of [['technician@example.com', 'Technician'], ['technician2@example.com', 'Technician'],
    ['reviewer@example.com', 'Reviewer'], ['admin@example.com', 'Administrator']]) {
    if ((await staffStore.findAll()).some(item => item.email === email)) continue;
    const now = new Date().toISOString();
    (await staffStore.saveItem({ id: developmentStaffId(email), name: 'Synthetic staff', email, role: role as StaffRole, passwordHash,
      active: true, credentialVersion: 0, createdAt: now, updatedAt: now, createdBy: 'test-fixture' }));
  }
}
