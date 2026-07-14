import { PrismaClient } from '@prisma/client';
import { pino } from 'pino';

const logger = pino({ name: 'prisma' });

export const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

prisma.$on('query', (e: any) => {
  logger.debug({ query: e.query, duration: `${e.duration}ms` }, 'prisma:query');
});

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
    logger.error({ error }, 'Database connection failed');
    process.exit(1);
  }
}

export async function disconnectDb() {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
