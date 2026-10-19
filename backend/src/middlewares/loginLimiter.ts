import { createHash } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
const attempts = new Map<string, { count: number; until: number }>();
export function resetLoginLimiter() { attempts.clear(); }
export function loginLimiter(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
  const keys: [string, number][] = [[`ip:${req.ip}`, 100], [`email:${createHash('sha256').update(email).digest('hex')}`, 20]];
  if (attempts.size > 10000 || keys.some(([key, max]) => (attempts.get(key)?.count || 0) >= max)) {
    return res.set('Retry-After', '900').status(429).json({ success: false, error: 'Too many sign-in attempts. Try again later.' });
  }
  for (const [key] of keys) {
    const old = attempts.get(key);
    attempts.set(key, { count: (old?.count || 0) + 1, until: old?.until || now + 15 * 60 * 1000 });
  }
  next();
}
