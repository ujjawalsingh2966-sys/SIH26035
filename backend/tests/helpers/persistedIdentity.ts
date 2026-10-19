// Real persisted identity/session fixtures for domain authorization tests. These
// do NOT bypass authenticate. Password verification has its own login/API suite.
import jwt from 'jsonwebtoken';
import { config } from '../../src/config/env';
import { staffStore, StaffRole } from '../../src/services/StaffService';
import { issueSession } from '../../src/services/SessionService';

export function testSession(id: string, role: string, email = `${id}@example.com`, secret = config.jwtSecret): string {
  if (secret !== config.jwtSecret) return jwt.sign({ id, role, email }, secret);
  const now = new Date().toISOString();
  let account = staffStore.findById(id);
  if (!account) account = staffStore.saveItem({ id, role: role as StaffRole, name: 'Synthetic authorization fixture', email,
    active: true, passwordHash: 'authorization-fixture-not-usable-for-login', credentialVersion: 0, createdAt: now, updatedAt: now, createdBy: 'test-fixture' });
  return issueSession(account);
}
