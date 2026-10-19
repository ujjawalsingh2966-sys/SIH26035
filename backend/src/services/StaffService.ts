import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'crypto';
import { JsonStore } from '../repositories/JsonStore';
import { accountStore, normalizeEmail, DuplicateAccountError } from './AccountService';
import { developmentStaffId, isKnownStaffEmail } from './DevelopmentStaffIdentity';

export const STAFF_ROLES = ['Technician', 'Reviewer', 'Administrator'] as const;
export type StaffRole = typeof STAFF_ROLES[number];
export interface StaffAccount {
  id: string; name: string; email: string; role: StaffRole; active: boolean;
  passwordHash: string; credentialVersion: number; createdAt: string; updatedAt: string; createdBy: string;
  securityHistory?: { action: string; actorId: string; timestamp: string }[];
}
export const staffStore = new JsonStore<StaffAccount>('staffAccounts.json', true, 'Staff');
export const publicStaff = ({ passwordHash, credentialVersion, securityHistory, ...staff }: StaffAccount) => staff;
export class StaffError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
});
export async function hashStaffPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$131072$8$1$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyStaffPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  const valid = parts.length === 6 && parts.slice(0, 4).join('$') === 'scrypt$131072$8$1'
    && /^[a-f0-9]{32}$/.test(parts[4]) && /^[a-f0-9]{128}$/.test(parts[5]);
  // Unknown/malformed accounts still perform the same expensive KDF.
  const actual = await derive(password, valid ? parts[4] : '00000000000000000000000000000000');
  return valid && timingSafeEqual(actual, Buffer.from(parts[5], 'hex'));
}
export function validateStaffInput(input: Record<string, unknown>) {
  if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.length > 120
    || typeof input.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
    || !STAFF_ROLES.includes(input.role as StaffRole)
    || typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128) {
    throw new StaffError('Name (2–120), valid email, staff role and password (12–128 characters) are required');
  }
}
function ensureUnique(email: string) {
  if (staffStore.findAll().some(item => item.email === email) || accountStore.findAll().some(item => item.email === email)) throw new DuplicateAccountError();
}
export async function createStaff(input: Record<string, unknown>, actorId: string, bootstrap = false) {
  validateStaffInput(input);
  if (bootstrap && input.role !== 'Administrator') throw new StaffError('Bootstrap may only provision an Administrator');
  const email = normalizeEmail(input.email as string);
  ensureUnique(email);
  let id = randomUUID() as string;
  if (input.adoptLegacyIdentity === true) {
    if (!isKnownStaffEmail(email)) throw new StaffError('No recognized legacy identity matches this email');
    // Explicit administrator provisioning only. This lookup preserves historical
    // IDs; it never authenticates a password or chooses a role from email text.
    id = developmentStaffId(email);
    if (staffStore.findById(id)) throw new DuplicateAccountError();
  }
  const passwordHash = await hashStaffPassword(input.password as string);
  // Recheck after the asynchronous KDF: concurrent create/bootstrap cannot win twice.
  ensureUnique(email);
  if (staffStore.findById(id)) throw new DuplicateAccountError();
  if (bootstrap && staffStore.findAll().length) throw new StaffError('Bootstrap is disabled once any staff account exists', 409);
  const actor = staffStore.findById(actorId);
  if (!bootstrap && (!actor?.active || actor.role !== 'Administrator')) throw new StaffError('Administrator session is no longer active', 401);
  const now = new Date().toISOString();
  return staffStore.saveItem({ id, name: (input.name as string).trim(), email, role: input.role as StaffRole,
    active: true, passwordHash, credentialVersion: 0, createdAt: now, updatedAt: now, createdBy: actorId,
    securityHistory: [{ action: 'PROVISIONED', actorId, timestamp: now }] });
}
export async function updateStaff(id: string, input: Record<string, unknown>, actorId: string) {
  if (!Object.keys(input).length || Object.keys(input).some(key => !['name', 'active', 'password'].includes(key))) {
    throw new StaffError('Only name, active and password may be changed; staff identity and role are immutable');
  }
  if (input.name !== undefined && (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.length > 120)
    || input.active !== undefined && typeof input.active !== 'boolean'
    || input.password !== undefined && (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128)) throw new StaffError('Invalid staff update');
  const passwordHash = input.password === undefined ? undefined : await hashStaffPassword(input.password as string);
  const account = staffStore.findById(id);
  if (!account) throw new StaffError('Staff account not found', 404);
  if (input.active === false && (actorId === id || account.role === 'Administrator'
    && !staffStore.findAll().some(item => item.id !== id && item.active && item.role === 'Administrator'))) {
    throw new StaffError('Cannot deactivate yourself or the last active administrator', 409);
  }
  const actor = staffStore.findById(actorId);
  if (!actor?.active || actor.role !== 'Administrator') throw new StaffError('Administrator account is unavailable', 401);
  return staffStore.saveItem({ ...account,
    name: typeof input.name === 'string' ? input.name.trim() : account.name,
    active: typeof input.active === 'boolean' ? input.active : account.active,
    passwordHash: passwordHash || account.passwordHash,
    credentialVersion: account.credentialVersion + (passwordHash || input.active !== undefined ? 1 : 0), updatedAt: new Date().toISOString(),
    securityHistory: [...(account.securityHistory || []), { action: passwordHash ? 'PASSWORD_RESET' : input.active !== undefined ? (input.active ? 'ACTIVATED' : 'DEACTIVATED') : 'NAME_UPDATED', actorId, timestamp: new Date().toISOString() }] });
}
