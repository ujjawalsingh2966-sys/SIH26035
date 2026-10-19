import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { JsonStore } from '../repositories/JsonStore';
import { accountStore } from './AccountService';
import { staffStore } from './StaffService';

interface SessionRecord {
  id: string; accountId: string; kind: 'staff' | 'business'; role: string; email: string;
  credentialVersion: number; createdAt: string; expiresAt: string; revokedAt?: string;
}
export const sessionStore = new JsonStore<SessionRecord>('sessions.json', true, 'Session');
const digest = (sid: string) => createHash('sha256').update(sid).digest('hex');
const jwtOptions = { algorithm: 'HS256' as const, issuer: 'W8LAB', audience: 'W8LAB-web' };
export function issueSession(account: { id: string; email: string; role: string; credentialVersion?: number }) {
  const sid = randomBytes(32).toString('base64url');
  const now = Math.floor(Date.now() / 1000), exp = now + 8 * 60 * 60;
  const token = jwt.sign({ id: account.id, email: account.email, role: account.role, sid, iat: now, exp }, config.jwtSecret, jwtOptions);
  sessionStore.saveItem({ id: digest(sid), accountId: account.id, kind: account.role === 'Business' ? 'business' : 'staff',
    role: account.role, email: account.email, credentialVersion: account.credentialVersion ?? 0,
    createdAt: new Date(now * 1000).toISOString(), expiresAt: new Date(exp * 1000).toISOString() });
  return token;
}
export function resolveSession(token: string) {
  const claims = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: jwtOptions.issuer, audience: jwtOptions.audience }) as jwt.JwtPayload;
  if (typeof claims.sid !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(claims.sid) || typeof claims.exp !== 'number') return undefined;
  const session = sessionStore.findById(digest(claims.sid));
  if (!session || session.revokedAt || Date.parse(session.expiresAt) <= Date.now()
    || session.accountId !== claims.id || session.role !== claims.role || session.email !== claims.email) return undefined;
  const account = session.kind === 'staff' ? staffStore.findById(session.accountId) : accountStore.findById(session.accountId);
  if (!account?.active || account.role !== session.role || account.email !== session.email
    || ('credentialVersion' in account ? account.credentialVersion : 0) !== session.credentialVersion) return undefined;
  return { user: { id: account.id, role: account.role, email: account.email }, sessionId: session.id };
}
export function revokeSession(id: string) {
  const session = sessionStore.findById(id);
  if (session) sessionStore.saveItem({ ...session, revokedAt: new Date().toISOString() });
}
