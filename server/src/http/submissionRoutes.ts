import fsp from 'node:fs/promises';
import { Router, type Request } from 'express';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { HttpError, requireAuth, requireParticipant } from '../auth/auth.js';
import { ok } from './util.js';
import { assertOpen } from '../services/competition.js';
import { enqueueSubmission } from '../services/queue.js';
import { newArtifactPath, paths, safeUnlink, sha256File } from '../services/storage.js';
import { publicSubmission } from './playerRoutes.js';
import { logger } from '../logger.js';

export const submissionRouter = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, paths.uploadTmp()),
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.part`), // never uses the client's filename
  }),
  limits: { fileSize: config.MAX_ARTIFACT_MB * 1024 * 1024, files: 1, fields: 5, parts: 8 },
  fileFilter: (_req, file, cb) => {
    if (!/\.joblib$/i.test(file.originalname)) return cb(new HttpError(400, 'BAD_FILE_TYPE', 'Only .joblib model files are accepted.'));
    cb(null, true);
  },
});

const ACTIVE = ['QUEUED', 'RUNNING'] as const;
const MAX_ACTIVE_PER_TEAM = 2;

async function handleSubmission(req: Request, stage: 1 | 2) {
  const file = req.file;
  try {
    if (!file) throw new HttpError(400, 'NO_FILE', 'Attach your model as multipart field "file" (.joblib).');
    const teamId = req.user!.teamId!; // identity comes from the session, never from the body
    await assertOpen();

    const progress = await prisma.teamProgress.findUnique({ where: { teamId } });
    if (stage === 1 && progress?.stage1QualifiedAt) throw new HttpError(409, 'STAGE_ALREADY_COMPLETED', 'Stage 1 is already completed.');
    if (stage === 2) {
      if (!progress?.anagramSolvedAt) throw new HttpError(403, 'ANAGRAM_REQUIRED', 'Solve the anagram to unlock Stage 2.');
      if (progress.stage2QualifiedAt) throw new HttpError(409, 'STAGE_ALREADY_COMPLETED', 'Stage 2 is already completed.');
    }

    const idemKey = req.get('idempotency-key')?.slice(0, 100) || null;
    if (idemKey) {
      const dup = await prisma.submission.findUnique({ where: { teamId_idempotencyKey: { teamId, idempotencyKey: idemKey } }, include: { result: true } });
      if (dup) return { submission: dup, duplicate: true };
    }

    const [recent, active, depth] = await Promise.all([
      prisma.submission.count({ where: { teamId, queuedAt: { gt: new Date(Date.now() - 60_000) } } }),
      prisma.submission.count({ where: { teamId, status: { in: [...ACTIVE] } } }),
      prisma.submission.count({ where: { status: { in: [...ACTIVE] } } }),
    ]);
    if (recent >= config.SUBMISSIONS_PER_MINUTE_PER_TEAM) throw new HttpError(429, 'TEAM_RATE_LIMITED', 'Your team is submitting too quickly. Wait a minute and try again.');
    if (active >= MAX_ACTIVE_PER_TEAM) throw new HttpError(429, 'TOO_MANY_ACTIVE', 'Wait for your pending submissions to finish evaluating.');
    if (depth >= config.MAX_QUEUE_DEPTH) throw new HttpError(503, 'QUEUE_FULL', 'The evaluation queue is full. Please retry in a moment.');

    if (file.size === 0) throw new HttpError(400, 'EMPTY_FILE', 'The uploaded file is empty.');
    const sha256 = await sha256File(file.path);
    const artifactPath = newArtifactPath();
    await fsp.rename(file.path, artifactPath);

    let sub;
    try {
      sub = await prisma.submission.create({
        data: {
          teamId, submittedById: req.user!.id, stage, artifactPath, artifactName: file.originalname.slice(0, 120).replace(/[^\w.\- ]/g, '_'),
          sha256, sizeBytes: file.size, idempotencyKey: idemKey,
        },
      });
    } catch (e) {
      await safeUnlink(artifactPath);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && idemKey) {
        const dup = await prisma.submission.findUnique({ where: { teamId_idempotencyKey: { teamId, idempotencyKey: idemKey } } });
        if (dup) return { submission: dup, duplicate: true };
      }
      throw e;
    }

    // The row is durable BEFORE enqueueing. A queue failure must not lose the submission.
    try {
      await enqueueSubmission(sub.id);
    } catch (e) {
      logger.error({ err: String(e), submissionId: sub.id }, 'enqueue failed; recovery loop will retry');
    }
    return { submission: sub, duplicate: false };
  } finally {
    if (file) await safeUnlink(file.path); // no-op after rename
  }
}

async function queuePosition(id: string, queuedAt: Date) {
  return prisma.submission.count({ where: { status: { in: [...ACTIVE] }, queuedAt: { lt: queuedAt } } });
}

for (const stage of [1, 2] as const) {
  submissionRouter.post(`/stage${stage}`, requireParticipant, upload.single('file'), async (req, res) => {
    const { submission, duplicate } = await handleSubmission(req, stage);
    const pos = ACTIVE.includes(submission.status as never) ? await queuePosition(submission.id, submission.queuedAt) : null;
    ok(res, { submissionId: submission.id, status: submission.status, stage, queuePosition: pos, duplicate }, duplicate ? 200 : 202);
  });
}

async function loadOwned(req: Request) {
  const id = String(req.params.submissionId);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'NOT_FOUND', 'Submission not found.');
  const sub = await prisma.submission.findUnique({ where: { id }, include: { result: true } });
  // Same 404 for "missing" and "someone else's" so ids cannot be probed.
  if (!sub || (req.user!.role !== 'ADMIN' && sub.teamId !== req.user!.teamId))
    throw new HttpError(404, 'NOT_FOUND', 'Submission not found.');
  return sub;
}

submissionRouter.get('/:submissionId', requireAuth, async (req, res) => {
  const sub = await loadOwned(req);
  const pos = ACTIVE.includes(sub.status as never) ? await queuePosition(sub.id, sub.queuedAt) : null;
  ok(res, { ...publicSubmission(sub), queuePosition: pos });
});

submissionRouter.get('/:submissionId/result', requireAuth, async (req, res) => {
  const sub = await loadOwned(req);
  const pub = publicSubmission(sub);
  if (!pub.result) throw new HttpError(409, 'NOT_READY', `Evaluation is ${sub.status}.`);
  ok(res, { submissionId: sub.id, stage: sub.stage, status: sub.status, ...pub.result });
});

