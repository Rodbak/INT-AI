import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { pino } from 'pino';
import type { ApiError } from '../types.js';

const logger = pino({ name: 'error' });

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    logger.warn({ errors: err.errors, url: req.url }, 'Validation error');
    res.status(400).json({ error: 'Validation failed', details: err.errors });
    return;
  }

  const apiError = err as ApiError;
  const statusCode = apiError.statusCode || 500;

  logger.error(
    {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      statusCode,
    },
    'Unhandled error',
  );

  const response: any = {
    error: statusCode === 500 ? `Internal server error: ${err.message}` : err.message,
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
