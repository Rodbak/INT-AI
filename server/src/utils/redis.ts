import { Redis } from 'ioredis';
import { pino } from 'pino';

const logger = pino({ name: 'redis' });

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: null,
});

redis.on('error', (error: Error) => {
  logger.warn({ error: error.message }, 'Redis connection error (continuing without Redis)');
});

export async function connectRedis(): Promise<Redis> {
  try {
    await redis.connect();
    logger.info('Redis connected');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn({ error: message }, 'Redis connection failed (continuing without Redis)');
  }
  return redis;
}

export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    logger.info('Redis disconnected');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn({ error: message }, 'Redis disconnection failed');
  }
}
