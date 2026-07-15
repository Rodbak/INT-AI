import type { Request, Response, NextFunction } from 'express';
import { pino } from 'pino';

const logger = pino({ name: 'correlation' });

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.headers['x-request-id']?.toString() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  next();
}

export { logger };
