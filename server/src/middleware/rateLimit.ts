import type { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { pino } from 'pino';
import { redis } from '../utils/redis.js';

const logger = pino({ name: 'rateLimit' });

interface RateLimitConfig {
  points: number;
  duration: number;
  blockDuration: number;
}

const isRedisConnected = () => redis.status === 'ready';

const getRedisLimiter = (config: RateLimitConfig) => {
  if (isRedisConnected()) {
    return new RateLimiterRedis({ storeClient: redis, ...config });
  }
  return new RateLimiterMemory(config);
};

const userConfig: RateLimitConfig = { points: 100, duration: 60, blockDuration: 60 };
const ipConfig: RateLimitConfig = { points: 20, duration: 60, blockDuration: 60 };

let userLimiter = getRedisLimiter(userConfig);
let ipLimiter = getRedisLimiter(ipConfig);

export function initRateLimiters(): void {
  userLimiter = getRedisLimiter(userConfig);
  ipLimiter = getRedisLimiter(ipConfig);
  logger.info({ redis: isRedisConnected() }, 'Rate limiters initialized');
}

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
