import { Worker } from 'bullmq';
import { config } from './config.js';
import { logger } from './logger.js';
import { makeRedis } from './services/queue.js';
import { evaluateSubmission, markInfrastructureFailure } from './services/evaluation.js';
import { ensureDirs } from './services/storage.js';

async function startWorker() {
  await ensureDirs();
  const redis = makeRedis();

  logger.info(`Starting BullMQ worker for queue "${config.QUEUE_NAME}" with concurrency ${config.EVAL_CONCURRENCY}`);

  const worker = new Worker(
    config.QUEUE_NAME,
    async (job) => {
      const { submissionId } = job.data;
      logger.info({ jobId: job.id, submissionId }, 'Worker processing submission');
      await evaluateSubmission(submissionId);
    },
    {
      connection: redis,
      concurrency: config.EVAL_CONCURRENCY,
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, submissionId: job.data.submissionId }, 'Job completed successfully');
  });

  worker.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, submissionId: job?.data.submissionId, err: err.message }, 'Job evaluation failed');
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      logger.warn({ submissionId: job.data.submissionId }, 'Job exceeded max attempts, marking infrastructure failure');
      await markInfrastructureFailure(job.data.submissionId);
    }
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down worker...`);
    await worker.close();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startWorker().catch((err) => {
  logger.error({ err }, 'Fatal worker startup error');
  process.exit(1);
});

