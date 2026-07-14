import type { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { pino } from 'pino';

const logger = pino({ name: 'rateLimit' });

interface RateLimitConfig {
  points: number;
  duration: number;
  blockDuration: number;
}

const getUserLimiter = (config: RateLimitConfig) => {
  return new RateLimiterMemory(config);
};

const getIpLimiter = (config: RateLimitConfig) => {
  return new RateLimiterMemory(config);
};

const userLimiter = getUserLimiter({ points: 100, duration: 60, blockDuration: 60 });
const ipLimiter = getIpLimiter({ points: 20, duration: 60, blockDuration: 60 });

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const userId = req.user?.id;
  const key = userId ? `user:${userId}` : `ip:${req.ip || req.connection.remoteAddress}`;
  const limiter = userId ? userLimiter : ipLimiter;

  limiter.consume(key)
    .then(() => next())
    .catch(() => {
      logger.warn({ key, ip: req.ip }, 'Rate limit exceeded');
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
    });
}

export { userLimiter, ipLimiter };
