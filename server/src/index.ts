import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { connectDb, disconnectDb } from './db';
import { connectRedis, disconnectRedis } from './utils/redis';
import { authenticate } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { logger } from './middleware/logger';
import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';
import chatRoutes from './routes/chat';
import modelsRoutes from './routes/models';
import specialistsRoutes from './routes/specialists';
import teamsRoutes from './routes/teams';
import automationsRoutes from './routes/automations';
import promptsRoutes from './routes/prompts';
import connectionsRoutes from './routes/connections';
import knowledgeRoutes from './routes/knowledge';
import usageRoutes from './routes/usage';
import billingRoutes from './routes/billing';
import adminRoutes from './routes/admin';
import { initRateLimiters } from './middleware/rateLimit';
import { env } from './env';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowedOrigins = env.CORS_ORIGINS.split(',');
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));

app.use(logger.requestLogger);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  try {
    await connectDb();
    res.json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(503).json({ status: 'not ready', database: 'disconnected', error: message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/conversations', authenticate, conversationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/specialists', authenticate, specialistsRoutes);
app.use('/api/teams', authenticate, teamsRoutes);
app.use('/api/automations', authenticate, automationsRoutes);
app.use('/api/prompts', authenticate, promptsRoutes);
app.use('/api/connections', authenticate, connectionsRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started');
  connectRedis().then(() => {
    initRateLimiters();
  });
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
