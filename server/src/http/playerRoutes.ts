import fs from 'node:fs';
import path from 'node:path';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError, requireAuth, requireParticipant } from '../auth/auth.js';
import { ok, parse } from './util.js';
import { getCompetition, publicCompetition, assertOpen } from '../services/competition.js';
import { audit } from '../services/audit.js';
import { SERVER_ROOT } from '../config.js';

export const playerRouter = Router();

const DATASETS_DIR = path.join(SERVER_ROOT, 'data', 'datasets');
const BOILERPLATES_DIR = path.join(SERVER_ROOT, 'data', 'boilerplates');

function sendFile(res: Response, filePath: string, downloadName: string, contentType = 'text/csv') {
  if (!fs.existsSync(filePath)) {
    throw new HttpError(404, 'FILE_NOT_FOUND', `Requested file "${downloadName}" is currently unavailable.`);
  }
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  fs.createReadStream(filePath).pipe(res);
}

// Normalize strings for case-insensitive and whitespace-insensitive comparison
export function normalizeAnswer(str: string): string {
  return (str ?? '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9 ]/g, '');
}

/** Participant Dashboard State */
playerRouter.get('/me', requireParticipant, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    include: { variant: true },
  });

  const comp = await getCompetition();

  const r1Approved = user.round1Status === 'APPROVED';
  const r2Solved = user.round2Status === 'SOLVED';
  const r3Approved = user.round3Status === 'APPROVED';

  // Model name revealed ONLY after Round 2 is solved
  const assignedModelName = r2Solved && user.variant ? user.variant.hiddenModel : null;

  const nextAction =
    !r1Approved ? 'ROUND1'
    : !r2Solved ? 'ROUND2'
    : !r3Approved ? 'ROUND3'
    : 'COMPLETED';

  ok(res, {
    user: {
      id: user.id,
      webId: user.webId,
      registrationId: user.registrationId,
      displayName: user.displayName,
      role: user.role,
    },
    competition: publicCompetition(comp),
    score: {
      total: user.totalScore,
      max: 150,
    },
    breakdown: {
      round1: user.round1Points,
      round2: user.round2Points,
      round3: user.round3Points,
    },
    stages: {
      stage1: {
        status: user.round1Status,
        completed: r1Approved,
        points: user.round1Points,
        approvedAt: user.round1ApprovedAt,
        rejectionReason: user.round1RejectionReason,
      },
      anagram: {
        unlocked: r1Approved,
        status: user.round2Status,
        completed: r2Solved,
        points: user.round2Points,
        solvedAt: user.round2SolvedAt,
        attempts: user.round2Attempts,
      },
      stage2: {
        unlocked: r2Solved,
        status: user.round3Status,
        completed: r3Approved,
        boilerplateReleased: user.round3BoilerplateReleased,
        boilerplateReleasedAt: user.round3BoilerplateReleasedAt,
        points: user.round3Points,
        approvedAt: user.round3ApprovedAt,
        rejectionReason: user.round3RejectionReason,
      },
    },
    reveal: r2Solved ? {
      algorithmName: assignedModelName,
      boilerplateReleased: user.round3BoilerplateReleased,
    } : null,
    nextAction,
  });
});

/** Participant requests verification for Round 1 or Round 3 */
const requestVerificationSchema = z.object({
  round: z.union([z.literal(1), z.literal(3)]),
}).strict();

playerRouter.post('/rounds/request-verification', requireParticipant, async (req, res) => {
  await assertOpen();
  const { round } = parse(requestVerificationSchema, req.body);
  const userId = req.user!.id;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (round === 1) {
    if (user.round1Status === 'APPROVED') {
      throw new HttpError(400, 'ALREADY_APPROVED', 'Round 1 is already approved.');
    }
    await prisma.user.update({
      where: { id: userId },
      data: { round1Status: 'PENDING_VERIFICATION' },
    });
    await audit(userId, 'REQUEST_VERIFICATION_ROUND_1', userId);
  } else if (round === 3) {
    if (user.round2Status !== 'SOLVED') {
      throw new HttpError(403, 'ROUND2_REQUIRED', 'Solve Round 2 before requesting Round 3 verification.');
    }
    if (!user.round3BoilerplateReleased) {
      throw new HttpError(403, 'BOILERPLATE_NOT_RELEASED', 'Boilerplate has not been released yet.');
    }
    if (user.round3Status === 'APPROVED') {
      throw new HttpError(400, 'ALREADY_APPROVED', 'Round 3 is already approved.');
    }
    await prisma.user.update({
      where: { id: userId },
      data: { round3Status: 'PENDING_VERIFICATION' },
    });
    await audit(userId, 'REQUEST_VERIFICATION_ROUND_3', userId);
  }

  ok(res, { success: true, message: `Verification requested for Round ${round}. Please notify your invigilator.` });
});

/** Round 2 Answer Submission */
const checkAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(100),
}).strict();

async function handleRound2Answer(userId: string, rawAnswer: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      include: { variant: true },
    });

    if (user.round1Status !== 'APPROVED') {
      throw new HttpError(403, 'ROUND1_REQUIRED', 'Round 1 must be approved before attempting Round 2.');
    }

    if (!user.variant) {
      throw new HttpError(500, 'VARIANT_MISSING', 'Participant variant mapping is missing.');
    }

    // If already solved, return success idempotently
    if (user.round2Status === 'SOLVED') {
      return {
        correct: true,
        alreadySolved: true,
        message: 'Round 2 has already been solved.',
        totalScore: user.totalScore,
        algorithmName: user.variant.hiddenModel,
      };
    }

    const expected = normalizeAnswer(user.variant.hiddenModel);
    const submitted = normalizeAnswer(rawAnswer);
    const isCorrect = expected === submitted;

    if (isCorrect) {
      const newScore = Math.min(150, user.round1Points + 50 + user.round3Points);
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          round2Status: 'SOLVED',
          round2Points: 50,
          round2SolvedAt: new Date(),
          round3Status: 'AWAITING_RELEASE', // Round 3 unlocked, awaiting admin boilerplate release
          totalScore: newScore,
          lastScoreAt: new Date(),
        },
      });

      await audit(userId, 'ROUND2_SOLVED', userId, { answer: rawAnswer, variantId: user.variantId }, tx);

      return {
        correct: true,
        alreadySolved: false,
        message: 'Correct answer! Exactly 50 points awarded. Round 3 is now unlocked.',
        totalScore: updated.totalScore,
        algorithmName: user.variant.hiddenModel,
      };
    } else {
      // Incorrect answer: unlimited attempts without penalties
      await tx.user.update({
        where: { id: userId },
        data: {
          round2Attempts: { increment: 1 },
        },
      });

      return {
        correct: false,
        alreadySolved: false,
        message: 'Incorrect answer. Please verify your predictions and solve the anagram again.',
        totalScore: user.totalScore,
      };
    }
  });
}

// Endpoint matching modern round convention
playerRouter.post('/rounds/round2/check-answer', requireParticipant, async (req, res) => {
  const { answer } = parse(checkAnswerSchema, req.body);
  const result = await handleRound2Answer(req.user!.id, answer);
  ok(res, result);
});

// Endpoint matching existing client route /api/anagram/submit for backwards compatibility
playerRouter.post('/anagram/submit', requireParticipant, async (req, res) => {
  const { answer } = parse(checkAnswerSchema, req.body);
  const result = await handleRound2Answer(req.user!.id, answer);
  ok(res, result);
});

// ---------- Protected Downloads ----------

/** Round 1 train.csv */
playerRouter.get(['/datasets/round1/train', '/datasets/stage1/train'], requireParticipant, async (_req, res) => {
  const filePath = path.join(DATASETS_DIR, 'train.csv');
  sendFile(res, filePath, 'train.csv');
});

/** Round 1 test.csv */
playerRouter.get(['/datasets/round1/test', '/datasets/stage1/test'], requireParticipant, async (_req, res) => {
  const filePath = path.join(DATASETS_DIR, 'test.csv');
  sendFile(res, filePath, 'test.csv');
});

/** Round 1 Linear Regression boilerplate */
playerRouter.get(['/datasets/round1/boilerplate', '/datasets/stage1/boilerplate'], requireParticipant, async (_req, res) => {
  const filePath = path.join(BOILERPLATES_DIR, 'linear_regression_boilerplate.py');
  sendFile(res, filePath, 'linear_regression_boilerplate.py', 'text/x-python');
});

/** Round 2 small_test.csv (serves participant's variant-specific test file as small_test.csv) */
playerRouter.get(['/datasets/round2/small-test', '/datasets/clue'], requireParticipant, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
  });

  if (user.round1Status !== 'APPROVED') {
    throw new HttpError(403, 'ROUND1_REQUIRED', 'Qualify and receive approval for Round 1 to unlock Round 2 materials.');
  }

  const variantId = user.variantId || 1;
  const filePath = path.join(DATASETS_DIR, `variant_${variantId}`, 'test.csv');
  sendFile(res, filePath, 'small_test.csv');
});

/** Round 3 Released Starter Boilerplate */
playerRouter.get(['/datasets/round3/boilerplate', '/datasets/stage2/boilerplate'], requireParticipant, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    include: { variant: true },
  });

  if (user.round2Status !== 'SOLVED') {
    throw new HttpError(403, 'ROUND2_REQUIRED', 'Solve Round 2 to unlock Round 3.');
  }

  if (!user.round3BoilerplateReleased) {
    throw new HttpError(403, 'BOILERPLATE_NOT_RELEASED', 'Round 3 starter boilerplate has not been released by an administrator yet.');
  }

  if (!user.variant?.starterTemplate) {
    throw new HttpError(404, 'TEMPLATE_NOT_FOUND', 'Starter template not configured for this variant.');
  }

  res.setHeader('Content-Type', 'text/x-python');
  res.setHeader('Content-Disposition', 'attachment; filename="round3_boilerplate.py"');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(user.variant.starterTemplate);
});

// Legacy helper script download
playerRouter.get('/datasets/challenge-features', requireAuth, async (_req, res) => {
  const filePath = path.join(SERVER_ROOT, 'sandbox', 'challenge_features.py');
  sendFile(res, filePath, 'challenge_features.py', 'text/x-python');
});

// ---------- Live Public Leaderboard ----------
export async function buildPublicLeaderboard() {
  const participants = await prisma.user.findMany({
    where: { role: 'PARTICIPANT' },
    select: {
      id: true,
      webId: true,
      displayName: true,
      totalScore: true,
      lastScoreAt: true,
      round1Status: true,
      round2Status: true,
      round3Status: true,
      createdAt: true,
    },
  });

  return participants
    .sort((a, b) => {
      // 1. Total score descending
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      // 2. Tie breaker: earliest lastScoreAt wins
      const ta = a.lastScoreAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const tb = b.lastScoreAt?.getTime() ?? Number.POSITIVE_INFINITY;
      if (ta !== tb) return ta - tb;
      // 3. Sequential webId ascending
      return a.webId - b.webId;
    })
    .map((p, index) => ({
      rank: index + 1,
      webId: `WEB-${String(p.webId).padStart(3, '0')}`,
      numericWebId: p.webId,
      name: p.displayName,
      totalScore: Math.min(150, Math.max(0, p.totalScore)),
      stages: {
        stage1: p.round1Status === 'APPROVED',
        anagram: p.round2Status === 'SOLVED',
        stage2: p.round3Status === 'APPROVED',
      },
    }));
}

playerRouter.get('/leaderboard', async (_req, res) => {
  const leaderboard = await buildPublicLeaderboard();
  const comp = await getCompetition();
  ok(res, {
    leaderboard,
    competition: publicCompetition(comp),
  });
});

playerRouter.get('/competition', async (_req, res) => {
  const comp = await getCompetition();
  ok(res, publicCompetition(comp));
});

export function publicSubmission(s: any) {
  return { id: s?.id, status: s?.status ?? 'DISABLED', result: {} as any, message: 'Manual verification workflow active.' };
}

