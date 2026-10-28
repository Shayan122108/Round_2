import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError, requireAuth, requireParticipant } from '../auth/auth.js';
import { ok, parse, ERROR_MESSAGES } from './util.js';
import { getCompetition, publicCompetition } from '../services/competition.js';
import { compareLeaderboard, submitAnagram, MILESTONE } from '../services/scoring.js';
import { paths } from '../services/storage.js';
import { FEATURE_SCHEMA } from '../services/schema.js';

export const playerRouter = Router();

async function teamState(teamId: string) {
  const [team, progress, comp] = await Promise.all([
    prisma.team.findUniqueOrThrow({ where: { id: teamId }, include: { variant: true } }),
    prisma.teamProgress.findUnique({ where: { teamId } }),
    getCompetition(),
  ]);
  const s1 = !!progress?.stage1QualifiedAt;
  const ana = !!progress?.anagramSolvedAt;
  const s2 = !!progress?.stage2QualifiedAt;
  const penalty = comp.row.anagramPenalty;
  return { team, progress, comp, s1, ana, s2, penalty };
}

/** The ONLY place participant-visible progress is shaped. Variant id / model / template are gated by milestone. */
function shapeProgress(st: Awaited<ReturnType<typeof teamState>>) {
  const p = st.progress;
  return {
    team: { name: st.team.name },
    competition: publicCompetition(st.comp),
    score: { total: p?.totalScore ?? 0, max: st.comp.row.maxScore },
    breakdown: {
      stage1: p?.stage1Points ?? 0,
      anagram: p?.anagramPoints ?? 0,
      stage2: p?.stage2Points ?? 0,
      penalties: (p?.incorrectAttempts ?? 0) * st.penalty,
      incorrectAttempts: p?.incorrectAttempts ?? 0,
    },
    stages: {
      stage1: { completed: st.s1, completedAt: p?.stage1QualifiedAt ?? null },
      anagram: { unlocked: st.s1, completed: st.ana, completedAt: p?.anagramSolvedAt ?? null },
      stage2: { unlocked: st.ana, completed: st.s2, completedAt: p?.stage2QualifiedAt ?? null },
    },
    // Scrambled letters are shown after Stage 1; the algorithm name + starter only after a correct answer.
    anagram: st.s1 ? { letters: st.team.variant.shuffledLetters, length: st.team.variant.shuffledLetters.length } : null,
    reveal: st.ana ? { algorithmName: st.team.variant.hiddenModel, starterTemplate: st.team.variant.starterTemplate } : null,
    nextAction: !st.s1 ? 'STAGE1' : !st.ana ? 'ANAGRAM' : !st.s2 ? 'STAGE2' : 'DONE',
    featureSchema: FEATURE_SCHEMA,
  };
}

playerRouter.get('/me', requireParticipant, async (req, res) => {
  const st = await teamState(req.user!.teamId!);
  ok(res, { user: { registrationId: req.user!.registrationId, displayName: req.user!.displayName }, ...shapeProgress(st) });
});

playerRouter.get('/me/progress', requireParticipant, async (req, res) => {
  const st = await teamState(req.user!.teamId!);
  const rank = await rankOf(req.user!.teamId!);
  ok(res, { ...shapeProgress(st), rank });
});

playerRouter.get('/me/scores', requireParticipant, async (req, res) => {
  const st = await teamState(req.user!.teamId!);
  const attempts = await prisma.anagramAttempt.findMany({
    where: { teamId: st.team.id }, orderBy: { createdAt: 'desc' },
    select: { correct: true, penaltyApplied: true, createdAt: true },
  });
  const sh = shapeProgress(st);
  ok(res, { score: sh.score, breakdown: sh.breakdown, anagramAttempts: attempts, rank: await rankOf(st.team.id) });
});

playerRouter.get('/me/submissions', requireParticipant, async (req, res) => {
  const rows = await prisma.submission.findMany({
    where: { teamId: req.user!.teamId! }, orderBy: { queuedAt: 'desc' }, take: 100, include: { result: true },
  });
  ok(res, rows.map(publicSubmission));
});

export function publicSubmission(s: Awaited<ReturnType<typeof prisma.submission.findFirstOrThrow>> & { result?: any }) {
  const r = s.result;
  const done = s.status === 'COMPLETED' || s.status === 'FAILED';
  return {
    id: s.id, stage: s.stage, status: s.status, filename: s.artifactName,
    queuedAt: s.queuedAt, startedAt: s.startedAt, completedAt: s.completedAt,
    result: done && r ? {
      qualified: r.qualified, accuracy: r.accuracy, precision: r.precision, recall: r.recall, f1: r.f1,
      rowsScored: r.rowsScored, durationMs: r.durationMs, errorCode: r.errorCode,
      message: r.errorCode ? ERROR_MESSAGES[r.errorCode] ?? 'The submission could not be evaluated.' : null,
    } : null,
  };
}

async function rankOf(teamId: string): Promise<number | null> {
  const board = await buildLeaderboard();
  const i = board.findIndex((b) => b.teamId === teamId);
  return i < 0 ? null : i + 1;
}

// ---------- datasets (explicit, authenticated, entitlement-checked; never static) ----------
function sendCsv(res: Response, file: string, name: string, type = 'text/csv') {
  if (!fs.existsSync(file)) throw new HttpError(404, 'DATASET_MISSING', 'Dataset is not available. Contact an organiser.');
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  fs.createReadStream(file).pipe(res);
}

async function requireStarted() {
  const c = await getCompetition();
  if (c.row.status === 'NOT_STARTED') throw new HttpError(403, 'COMPETITION_NOT_STARTED', 'The competition has not started yet.');
}

playerRouter.get('/datasets/stage1/train', requireParticipant, async (_req, res) => {
  await requireStarted();
  sendCsv(res, paths.stage1Train(), 'train.csv');
});

playerRouter.get('/datasets/stage2/train', requireParticipant, async (req, res) => {
  await requireStarted();
  const st = await teamState(req.user!.teamId!);
  if (!st.ana) throw new HttpError(403, 'ANAGRAM_REQUIRED', 'Solve the anagram to unlock the Stage 2 dataset.');
  sendCsv(res, paths.stage2Train(), 'stage2_train.csv');
});

playerRouter.get('/datasets/challenge-features', requireAuth, async (_req, res) => {
  sendCsv(res, paths.featuresPy(), 'challenge_features.py', 'text/x-python');
});

playerRouter.get('/datasets/clue', requireParticipant, async (req, res) => {
  const st = await teamState(req.user!.teamId!);
  if (!st.s1) throw new HttpError(403, 'STAGE1_REQUIRED', 'Qualify Stage 1 to unlock your clue dataset.');
  sendCsv(res, paths.clue(st.team.variantId), 'clue_dataset.csv');
});

playerRouter.get('/datasets/clue/preview', requireParticipant, async (req, res) => {
  const st = await teamState(req.user!.teamId!);
  if (!st.s1) throw new HttpError(403, 'STAGE1_REQUIRED', 'Qualify Stage 1 to unlock your clue dataset.');
  const file = paths.clue(st.team.variantId);
  if (!fs.existsSync(file)) throw new HttpError(404, 'DATASET_MISSING', 'Clue dataset is not available.');
  const lines = (await fsp.readFile(file, 'utf8')).trim().split(/\r?\n/);
  const headers = lines[0]!.split(',');
  ok(res, {
    totalRows: lines.length - 1,
    headers,
    preview: lines.slice(1, 16).map((l) => Object.fromEntries(l.split(',').map((v, i) => [headers[i], v]))),
  });
});

// ---------- anagram ----------
const anagramSchema = z.object({ answer: z.string().trim().min(1).max(80) }).strict();

playerRouter.post('/anagram/submit', requireParticipant, async (req, res) => {
  const { answer } = parse(anagramSchema, req.body);
  const out = await submitAnagram(req.user!.teamId!, req.user!.id, answer);
  const comp = await getCompetition();
  ok(res, {
    correct: out.correct,
    alreadySolved: out.alreadySolved,
    message: out.correct
      ? out.alreadySolved ? 'Already solved.' : `Correct! +${comp.row.anagramPoints} points. Stage 2 is unlocked.`
      : `Incorrect. A ${comp.row.anagramPenalty}-point penalty has been applied.`,
    incorrectAttempts: out.incorrectAttempts,
    penaltyPoints: out.penaltyPoints,
    totalScore: out.totalScore,
    // Revealed ONLY on verified success.
    ...(out.correct ? { algorithmName: out.algorithmName, starterTemplate: out.starterTemplate } : {}),
  });
});

// ---------- leaderboard ----------
export async function buildLeaderboard() {
  const teams = await prisma.team.findMany({ include: { progress: true } });
  const rows = teams.map((t) => ({
    teamId: t.id, id: t.id, name: t.name,
    totalScore: t.progress?.totalScore ?? 0,
    lastScoreAt: t.progress?.lastScoreAt ?? null,
    stage1: !!t.progress?.stage1QualifiedAt, anagram: !!t.progress?.anagramSolvedAt, stage2: !!t.progress?.stage2QualifiedAt,
  }));
  return rows.sort(compareLeaderboard);
}

playerRouter.get('/leaderboard', async (_req, res) => {
  const board = await buildLeaderboard();
  // Public view: display name + score + stage flags only. No ids, variants, or emails.
  ok(res, {
    leaderboard: board.map((b, i) => ({ rank: i + 1, name: b.name, totalScore: b.totalScore, stages: { stage1: b.stage1, anagram: b.anagram, stage2: b.stage2 } })),
    competition: publicCompetition(await getCompetition()),
  });
});

export { MILESTONE };

