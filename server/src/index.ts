import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { ensureDirs } from './services/storage.js';
import { recoverPending } from './services/queue.js';

async function startServer() {
  await ensureDirs();
  const app = createApp();

  const server = app.listen(config.PORT, () => {
    logger.info(`Server started on port ${config.PORT} [${config.NODE_ENV}]`);
  });

  // Start periodic pending submission recovery
  const recoveryInterval = setInterval(async () => {
    try {
      await recoverPending();
    } catch (err: any) {
      logger.error({ err: err.message }, 'Scheduled submission recovery error');
    }
  }, 30_000);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    clearInterval(recoveryInterval);
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  logger.error({ err }, 'Fatal server startup error');
  process.exit(1);
});

