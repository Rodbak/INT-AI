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

  // Full error detail is exposed in responses only when explicitly opted in
  // (DEBUG_ERRORS=1) or in local development. In production it defaults to a
  // safe generic message so internal details never leak to real visitors.
  const debugErrors =
    process.env.DEBUG_ERRORS === '1' ||
    process.env.DEBUG_ERRORS === 'true' ||
    process.env.NODE_ENV === 'development';

  const response: any = {
    error:
      statusCode === 500
        ? debugErrors
          ? `Internal server error: ${err.message}`
          : 'Internal server error'
        : err.message,
  };

  if (debugErrors) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
