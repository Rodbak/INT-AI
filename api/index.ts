import app from '../server/src/app.js';
import { connectRedis } from '../server/src/utils/redis.js';
import { initRateLimiters } from '../server/src/middleware/rateLimit.js';
import { logger } from '../server/src/middleware/logger.js';

// Runs once per cold start (module scope), not per request. redis.connect()
// is a no-op once already connected/connecting, so this is safe to leave
// as a fire-and-forget: requests that arrive before it resolves just use
// the in-memory rate limiter fallback until Redis is ready.
connectRedis()
  .then(() => initRateLimiters())
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn({ error: message }, 'Redis connection failed (continuing without Redis)');
  });

export default app;
