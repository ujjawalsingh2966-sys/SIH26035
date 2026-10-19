import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { resolveSession } from '../services/SessionService';

// Type extension for Express Request
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; email: string };
      sessionId?: string;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const session = resolveSession(token);
    if (!session) return res.status(401).json({ success: false, error: 'Session is unavailable. Please sign in again.' });
    req.user = session.user;
    req.sessionId = session.sessionId;
    res.set('Cache-Control', 'no-store');
    next();
  } catch (err) {
    logger.warn('Failed authentication attempt: Invalid token');
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      logger.warn(`Authorization blocked: User ${req.user.id} with role ${req.user.role} attempted to access restricted route`);
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};
