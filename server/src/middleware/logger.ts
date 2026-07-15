import type { Request, Response, NextFunction } from 'express';
import { pino } from 'pino';
import type { AuthenticatedRequest } from '../types.js';

const logger = pino({ name: 'http' });

export function requestLogger(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData: any = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
    };

    if (req.user) {
      logData.userId = req.user.id;
    }

    if (res.statusCode >= 500) {
      logger.error(logData, `${req.method} ${req.url} ${res.statusCode}`);
    } else if (res.statusCode >= 400) {
      logger.warn(logData, `${req.method} ${req.url} ${res.statusCode}`);
    } else {
      logger.info(logData, `${req.method} ${req.url} ${res.statusCode}`);
    }
  });

  next();
}

export { logger };
