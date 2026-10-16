import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { logger } from '../utils/logger';

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Registration/login bodies contain passwords. Never log or echo input values.
    logger.warn(`Validation failed for ${req.method} ${req.path}`);
    const safeErrors = errors.array().map(error => ({
      msg: error.msg, path: 'path' in error ? error.path : 'request'
    }));
    return res.status(400).json({ success: false, errors: safeErrors });
  }
  next();
};
