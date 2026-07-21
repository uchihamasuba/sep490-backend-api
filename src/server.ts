import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { prisma } from './db/prisma';

async function main() {
  await prisma.$connect();
  logger.info('Database connected');

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => {
      prisma
        .$disconnect()
        .catch((err: any) => logger.error({ err }, 'Error disconnecting Prisma'))
        .finally(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err: any) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
