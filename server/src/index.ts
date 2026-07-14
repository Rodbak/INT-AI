import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { connectDb, disconnectDb } from './db';
import { authenticate } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { logger } from './middleware/logger';
import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';
import chatRoutes from './routes/chat';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const requiredEnvVars = ['DATABASE_URL'];
const missingEnv = requiredEnvVars.filter((v) => !process.env[v]);

if (missingEnv.length > 0) {
  logger.error({ missing: missingEnv }, 'Missing required environment variables');
  process.exit(1);
}

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',');

const app = express();

app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
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

app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: NODE_ENV }, 'Server started');
});

async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal');
  server.close(async () => {
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
