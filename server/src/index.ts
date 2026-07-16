import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import app from './app.js';
import { disconnectDb } from './db.js';
import { connectRedis, disconnectRedis } from './utils/redis.js';
import { logger } from './middleware/logger.js';
import { initRateLimiters } from './middleware/rateLimit.js';
import { env } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Static frontend + SPA fallback: only used for local dev/preview and the
// Docker/self-host deployment path. On Vercel, the static build is served
// directly by Vercel and this app only ever receives /api/* requests
// (see api/index.ts), so these routes are appended here rather than in
// app.ts.
const frontendDistPath = path.resolve(__dirname, '../../app/dist');
app.use(express.static(frontendDistPath, { maxAge: '1y', etag: true }));

app.get('/*splat', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

const server = app.listen(env.PORT, async () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started');
  try {
    await connectRedis();
    initRateLimiters();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn({ error: message }, 'Redis connection failed (continuing without Redis)');
  }
});

async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal');
  server.close(async () => {
    await disconnectRedis();
    await disconnectDb();
    logger.info('Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logger.error({ error: message }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error: Error) => {
  logger.error({ error: error.message, stack: error.stack }, 'Uncaught exception');
  process.exit(1);
});
