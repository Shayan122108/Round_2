import { Queue, type JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { logger } from '../logger.js';

export function makeRedis() {
  // BullMQ requires maxRetriesPerRequest = null for workers; harmless for producers.
  return new Redis(config.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: true });
}

let queue: Queue | undefined;
export function getQueue(): Queue {
  queue ??= new Queue(config.QUEUE_NAME, { connection: makeRedis() });
  return queue;
}

export const JOB_OPTS: JobsOptions = {
  attempts: 3, // transient infrastructure faults only; model faults finish the job normally
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600 },
};

/**
 * Adds the evaluation job (jobId == submissionId => duplicate adds are ignored by BullMQ).
 * The DB row already exists; if this throws the recovery loop will retry it.
 */
export async function enqueueSubmission(submissionId: string): Promise<void> {
  const q = getQueue();
  const existing = await q.getJob(submissionId);
  if (existing) {
    const state = await existing.getState();
    if (state === 'failed' || state === 'completed') await existing.remove();
    else {
      await prisma.submission.updateMany({ where: { id: submissionId, enqueuedAt: null }, data: { enqueuedAt: new Date() } });
      return;
    }
  }
  await q.add('evaluate', { submissionId }, { ...JOB_OPTS, jobId: submissionId });
  await prisma.submission.updateMany({ where: { id: submissionId }, data: { enqueuedAt: new Date() } });
}

/**
 * Recovery: re-enqueue accepted submissions that never reached Redis, or whose job was lost
 * (Redis flush, worker killed mid-run). Safe to run anywhere, any number of times.
 */
export async function recoverPending(opts: { staleRunningMs?: number } = {}): Promise<number> {
  const staleRunning = opts.staleRunningMs ?? (config.SANDBOX_TIMEOUT_SEC * 3 + 60) * 1000;
  const q = getQueue();
  const candidates = await prisma.submission.findMany({
    where: {
      OR: [
        { status: 'QUEUED', enqueuedAt: null },
        { status: 'QUEUED', queuedAt: { lt: new Date(Date.now() - 30_000) } },
        { status: 'RUNNING', startedAt: { lt: new Date(Date.now() - staleRunning) } },
      ],
    },
    select: { id: true, status: true },
    take: 500,
  });
  let n = 0;
  for (const c of candidates) {
    try {
      const job = await q.getJob(c.id);
      const state = job ? await job.getState() : null;
      if (state === 'waiting' || state === 'active' || state === 'delayed' || state === 'prioritized') {
        if (c.status === 'QUEUED') continue; // genuinely queued, nothing to do
        if (state === 'active') continue;
      }
      if (c.status === 'RUNNING') await prisma.submission.updateMany({ where: { id: c.id, status: 'RUNNING' }, data: { status: 'QUEUED' } });
      await enqueueSubmission(c.id);
      n++;
    } catch (e) {
      logger.warn({ err: String(e), submissionId: c.id }, 'recoverPending: enqueue failed, will retry');
    }
  }
  if (n) logger.info({ recovered: n }, 'recovered pending submissions');
  return n;
}

export async function queueStats() {
  const q = getQueue();
  const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
  return counts;
}

export async function closeQueue() {
  if (queue) { await queue.close(); queue = undefined; }
}

