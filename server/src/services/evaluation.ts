import fsp from 'node:fs/promises';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { InfraError, runInSandbox, type SandboxResult } from './sandbox.js';
import { computeMetrics, parseLabelsCsv } from './metrics.js';
import { paths } from './storage.js';
import { awardForSubmission } from './scoring.js';
import { runAdminEvaluator } from './adminEvaluator.js';

export interface EvalOutcome {
  errorCode: string | null;
  qualified: boolean;
  metrics?: ReturnType<typeof computeMetrics>;
  rowsScored?: number;
}

const LABEL_MIN = 65, LABEL_MAX = 90;

/** Pure trusted decision step: given the sandbox output + private labels, produce the outcome. */
export function scorePredictions(
  sb: SandboxResult,
  labels: number[],
  rule: { estimator: string; minAccuracy: number; minF1?: number },
): EvalOutcome {
  if (!sb.ok) return { errorCode: sb.errorCode, qualified: false };
  const estimatorMatches = sb.estimator === rule.estimator ||
    (rule.estimator === 'HistGradientBoostingClassifier' && sb.estimator === 'GradientBoostingClassifier') ||
    (rule.estimator === 'GradientBoostingClassifier' && sb.estimator === 'HistGradientBoostingClassifier');
  if (!estimatorMatches) return { errorCode: 'WRONG_ESTIMATOR', qualified: false };
  if (sb.predictions.length !== labels.length) return { errorCode: 'BAD_PREDICTION_SHAPE', qualified: false };
  if (sb.predictions.some((p) => p < LABEL_MIN || p > LABEL_MAX)) return { errorCode: 'INVALID_LABELS', qualified: false };
  const m = computeMetrics(labels, sb.predictions);
  const qualified = m.accuracy >= rule.minAccuracy && (rule.minF1 === undefined || m.f1 >= rule.minF1);
  return { errorCode: null, qualified, metrics: m, rowsScored: m.total };
}

/**
 * Evaluates one submission. Idempotent: re-running a finished submission is a no-op,
 * and score awards go through awardForSubmission (unique per team+milestone).
 * Throws InfraError for transient faults so BullMQ retries.
 */
export async function evaluateSubmission(submissionId: string): Promise<void> {
  const claimed = await prisma.submission.updateMany({
    where: { id: submissionId, status: { in: ['QUEUED', 'RUNNING'] } },
    data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return; // already finished / cancelled / unknown
  const sub = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId }, include: { team: { include: { variant: true } } } });
  const v = sub.team.variant;

  // Trusted configuration comes from the DB + server config, never from the request.
  const stage1 = sub.stage === 1;
  const evalKey = stage1 ? `variant_${v.id}` : 'stage2';
  const rule = stage1
    ? { estimator: 'LogisticRegression', minAccuracy: v.stage1MinAccuracy }
    : { estimator: v.estimator, minAccuracy: v.stage2MinAccuracy, minF1: v.stage2MinMacroF1 };

  const t0 = Date.now();
  let outcome: EvalOutcome;
  try {
    const labelsCsv = await fsp.readFile(paths.evalLabels(evalKey), 'utf8'); // read by trusted code only
    const { labels } = parseLabelsCsv(labelsCsv);
    const sb = await runInSandbox({ artifactPath: sub.artifactPath, featuresPath: paths.evalFeatures(evalKey) });
    outcome = scorePredictions(sb, labels, rule);
  } catch (e) {
    if (e instanceof InfraError || (e as NodeJS.ErrnoException)?.code === 'ENOENT') {
      logger.error({ err: String(e), submissionId }, 'infrastructure failure during evaluation');
      await prisma.submission.updateMany({ where: { id: submissionId, status: 'RUNNING' }, data: { status: 'QUEUED' } });
      throw e instanceof InfraError ? e : new InfraError(String(e));
    }
    logger.error({ err: String(e), submissionId }, 'unexpected evaluation error');
    outcome = { errorCode: 'INTERNAL_ERROR', qualified: false };
  }

  const durationMs = Date.now() - t0;
  const failed = outcome.errorCode !== null;

  // Run organizer holdout evaluator (test_for_admin.csv) in background for admin review
  let adminMetrics = null;
  if (!failed) {
    try {
      const adminEval = await runAdminEvaluator(sub.artifactPath, 60_000);
      if (adminEval.status === 'success') {
        adminMetrics = adminEval;
        logger.info({ submissionId, adminMetrics }, 'admin holdout evaluation succeeded');
      } else {
        adminMetrics = { error_code: adminEval.error_code, message: adminEval.message };
        logger.warn({ submissionId, err: adminEval.error_code }, 'admin holdout evaluation returned error');
      }
    } catch (e) {
      logger.warn({ err: String(e), submissionId }, 'admin holdout evaluation failed to run');
    }
  }

  await prisma.$transaction(async (tx) => {
    const cur = await tx.submission.findUniqueOrThrow({ where: { id: submissionId } });
    if (cur.status !== 'RUNNING') return; // cancelled meanwhile
    const m = outcome.metrics;
    const data = {
      accuracy: m?.accuracy ?? null, precision: m?.precision ?? null, recall: m?.recall ?? null, f1: m?.f1 ?? null,
      qualified: !failed && outcome.qualified, rowsScored: outcome.rowsScored ?? null, durationMs, errorCode: outcome.errorCode,
      adminMetrics: adminMetrics as any,
    };
    await tx.evaluationResult.upsert({ where: { submissionId }, create: { submissionId, ...data }, update: data });
    await tx.submission.update({ where: { id: submissionId }, data: { status: failed ? 'FAILED' : 'COMPLETED', completedAt: new Date() } });
  });

  if (!failed && outcome.qualified) await awardForSubmission(submissionId);
  logger.info({ submissionId, stage: sub.stage, durationMs, errorCode: outcome.errorCode, qualified: outcome.qualified }, 'evaluation finished');
}

/** Called by the worker when BullMQ gives up after the final retry. */
export async function markInfrastructureFailure(submissionId: string) {
  await prisma.$transaction(async (tx) => {
    const cur = await tx.submission.findUnique({ where: { id: submissionId } });
    if (!cur || cur.status === 'COMPLETED' || cur.status === 'CANCELLED') return;
    await tx.evaluationResult.upsert({
      where: { submissionId },
      create: { submissionId, qualified: false, errorCode: 'INFRASTRUCTURE_ERROR' },
      update: { qualified: false, errorCode: 'INFRASTRUCTURE_ERROR' },
    });
    await tx.submission.update({ where: { id: submissionId }, data: { status: 'FAILED', completedAt: new Date() } });
  });
}

export function assertEvalDataAllowed(compromised: boolean) {
  if (compromised && !config.ALLOW_COMPROMISED_EVAL_DATA)
    throw new Error('Evaluation data is flagged as compromised (public). Provide fresh holdouts or set ALLOW_COMPROMISED_EVAL_DATA=1 for rehearsals.');
}

