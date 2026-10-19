import dotenv from 'dotenv';
import { randomBytes } from 'crypto';
import { JsonStore } from '../repositories/JsonStore';
dotenv.config();

function signingSecret(): string {
  if (process.env.NODE_ENV === 'test') return randomBytes(48).toString('hex');
  const configured = process.env.JWT_SECRET;
  if (configured) {
    if (configured.length < 32 || /replace|dev-safe-secret/i.test(configured)) throw new Error('JWT_SECRET must be a private random value of at least 32 characters');
    return configured;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production');
  // Local-only durable random key, never a shared source-code fallback. Uses the
  // same strict isolated storage policy as accounts. Never sent in API responses.
  const keys = new JsonStore<{ id: string; secret: string }>('authSecrets.json', true, 'Local signing key');
  const existing = keys.findById('local-signing-key');
  if (existing) {
    if (!/^[a-f0-9]{96}$/.test(existing.secret)) throw new Error('Local signing key is invalid');
    return existing.secret;
  }
  return keys.saveItem({ id: 'local-signing-key', secret: randomBytes(48).toString('hex') }).secret;
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: signingSecret(),
  clientUrl: process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(origin => origin.trim()).filter(Boolean)
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3014',
      ],
};
