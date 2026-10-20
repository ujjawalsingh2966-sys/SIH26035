import { unitOfWork } from '../repositories/persistence';
// Existing Business identity/password format is retained separately from staff.
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { accountStore } from '../repositories';
import type { Account } from '../types/identity';
export { accountStore } from '../repositories';
export type { Account } from '../types/identity';
export const publicAccount = ({ passwordHash, ...account }: Account) => account;
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export class DuplicateAccountError extends Error {
  constructor() { super('An account with this email already exists'); }
}

export async function createBusinessAccount(name: string, email: string, password: string): Promise<Account> {
  return unitOfWork.write(async () => {
    const normalized = normalizeEmail(email);
    if ((await accountStore.findAll()).some(account => account.email === normalized)) throw new DuplicateAccountError();
    const salt = randomBytes(16).toString('hex');
    const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
    return (await accountStore.saveItem({
      id: randomUUID(), name: name.trim(), email: normalized, role: 'Business',
      passwordHash, active: true, createdAt: new Date().toISOString()
    }));
  });
}

export function checkPassword(password: string, hash: string): boolean {
  const [salt, expected] = hash.split(':');
  if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(expected || '')) return false;
  const actual = scryptSync(password, salt, 64);
  const buffer = Buffer.from(expected, 'hex');
  return buffer.length === actual.length && timingSafeEqual(buffer, actual);
}
