import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error({[`Error ${err.message}`]: err.message, stack: err.stack, path: req.path});

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Prevent leaking stack traces in production
  res.status(statusCode).json({
    success: false,
    error: {
      message: statusCode === 500 && process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : message,
    }
  });
};
