import type { IncomingMessage, ServerResponse } from 'node:http';

// Nothing in this module runs at import time — Vercel must always be able to
// load this file successfully, even if server/src/app.ts (or anything it
// pulls in — Prisma, Redis, env validation) throws. All real work happens
// lazily on first invocation, inside the try/catch below, so a crash there
// is caught and reported in the HTTP response instead of surfacing as an
// opaque platform-level FUNCTION_INVOCATION_FAILED with no visible cause.
let initPromise: Promise<{ app: (req: IncomingMessage, res: ServerResponse) => void }> | null = null;

async function init() {
  const [{ default: app }, { connectRedis }, { initRateLimiters }] = await Promise.all([
    import('../server/src/app.js'),
    import('../server/src/utils/redis.js'),
    import('../server/src/middleware/rateLimit.js'),
  ]);

  // Fire-and-forget: redis.connect() is a no-op once already connected/connecting,
  // so requests that arrive before it resolves just use the in-memory rate
  // limiter fallback until Redis is ready.
  connectRedis()
    .then(() => initRateLimiters())
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Redis connection failed (continuing without Redis):', message);
    });

  return { app };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!initPromise) {
      initPromise = init();
    }
    const { app } = await initPromise;
    app(req, res);
  } catch (error: unknown) {
    // Let the next request retry instead of caching a permanently-broken init.
    initPromise = null;
    const err = error as Error;
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Function failed to initialize',
        name: err?.name,
        message: err?.message ?? String(error),
        stack: err?.stack,
      }),
    );
  }
}
