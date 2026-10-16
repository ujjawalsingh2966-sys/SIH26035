// Narrow extraction from the cached verification prototype. Staff identities
// retain their existing development authentication; only Business is persisted.
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { JsonStore } from '../repositories/JsonStore';

export interface Account {
  id: string;
  name: string;
  email: string;
  role: 'Business';
  passwordHash: string;
  active: boolean;
  createdAt: string;
}

export const accountStore = new JsonStore<Account>('accounts.json', true);
export const publicAccount = ({ passwordHash, ...account }: Account) => account;
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export class DuplicateAccountError extends Error {
  constructor() { super('An account with this email already exists'); }
}

export function createBusinessAccount(name: string, email: string, password: string): Account {
  const normalized = normalizeEmail(email);
  if (accountStore.findAll().some(account => account.email === normalized)) throw new DuplicateAccountError();
  const salt = randomBytes(16).toString('hex');
  const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  return accountStore.saveItem({
    id: randomUUID(), name: name.trim(), email: normalized, role: 'Business',
    passwordHash, active: true, createdAt: new Date().toISOString()
  });
}

export function checkPassword(password: string, hash: string): boolean {
  const [salt, expected] = hash.split(':');
  if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(expected || '')) return false;
  const actual = scryptSync(password, salt, 64);
  const buffer = Buffer.from(expected, 'hex');
  return buffer.length === actual.length && timingSafeEqual(buffer, actual);
}
