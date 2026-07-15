import { PrismaClient } from '@prisma/client';
import { pino } from 'pino';
import { env } from './env.js';

const logger = pino({ name: 'prisma' });

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development'
    ? [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ]
    : [
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
});

if (env.NODE_ENV === 'development') {
  prisma.$on('query', (e: any) => {
    logger.debug({ query: e.query, duration: `${e.duration}ms` }, 'prisma:query');
  });
}

prisma.$on('error', (e: any) => {
  logger.error({ message: e.message }, 'prisma:error');
});

prisma.$on('warn', (e: any) => {
  logger.warn({ message: e.message }, 'prisma:warn');
});

export async function connectDb() {
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'Database connection failed');
    throw new Error(`Database connection failed: ${message}`);
  }
}

export async function disconnectDb() {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
