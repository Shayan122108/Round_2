import { prisma, type Tx } from '../db.js';
import { HttpError } from '../auth/auth.js';
import { getCompetition } from './competition.js';

export const MILESTONE = { STAGE1: 1, ANAGRAM: 2, STAGE2: 3 } as const;

export function normalizeName(s: string): string {
  return (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function clampScore(raw: number, max = 150): number {
  return Math.max(0, Math.min(max, raw));
}

/** Locks the team's progress row for the duration of the transaction (serialises all score mutations). */
export async function lockProgress(tx: Tx, teamId: string) {
  await tx.teamProgress.upsert({ where: { teamId }, update: {}, create: { teamId } });
  await tx.$queryRaw`SELECT "teamId" FROM "TeamProgress" WHERE "teamId" = ${teamId} FOR UPDATE`;
  return tx.teamProgress.findUniqueOrThrow({ where: { teamId } });
}

async function recompute(tx: Tx, teamId: string, touchTime: boolean) {
  const [p, team, cfg] = await Promise.all([
    tx.teamProgress.findUniqueOrThrow({ where: { teamId } }),
    tx.team.findUniqueOrThrow({ where: { id: teamId } }),
    tx.competitionConfig.findUniqueOrThrow({ where: { id: 1 } }),
  ]);
  const raw = p.stage1Points + p.anagramPoints + p.stage2Points - cfg.anagramPenalty * p.incorrectAttempts + team.scoreAdjustment;
  return tx.teamProgress.update({
    where: { teamId },
    data: { totalScore: clampScore(raw, cfg.maxScore), ...(touchTime ? { lastScoreAt: new Date() } : {}) },
  });
}

/**
 * Awards a milestone at most once. Idempotent: a second call (duplicate request, retried job)
 * is a no-op. Must be called inside a transaction that already holds lockProgress().
 */
export async function awardMilestone(tx: Tx, teamId: string, milestone: number, submissionId: string | null) {
  const cfg = await tx.competitionConfig.findUniqueOrThrow({ where: { id: 1 } });
  const points = milestone === 1 ? cfg.stage1Points : milestone === 2 ? cfg.anagramPoints : cfg.stage2Points;
  const existing = await tx.stageCompletion.findUnique({ where: { teamId_milestone: { teamId, milestone } } });
  if (existing) return { awarded: false, points: 0 };
  await tx.stageCompletion.create({ data: { teamId, milestone, submissionId, points } });
  const now = new Date();
  const data =
    milestone === 1 ? { stage1Points: points, stage1QualifiedAt: now }
    : milestone === 2 ? { anagramPoints: points, anagramSolvedAt: now }
    : { stage2Points: points, stage2QualifiedAt: now };
  await tx.teamProgress.update({ where: { teamId }, data });
  await recompute(tx, teamId, true);
  return { awarded: true, points };
}

/** Called by the trusted scorer after a COMPLETED evaluation. Safe to call repeatedly. */
export async function awardForSubmission(submissionId: string): Promise<{ awarded: boolean }> {
  return prisma.$transaction(async (tx) => {
    const sub = await tx.submission.findUniqueOrThrow({ where: { id: submissionId }, include: { result: true } });
    await lockProgress(tx, sub.teamId);
    if (!sub.result?.qualified || sub.status !== 'COMPLETED') return { awarded: false };
    const milestone = sub.stage === 1 ? MILESTONE.STAGE1 : MILESTONE.STAGE2;
    if (milestone === MILESTONE.STAGE2) {
      const anagram = await tx.stageCompletion.findUnique({ where: { teamId_milestone: { teamId: sub.teamId, milestone: MILESTONE.ANAGRAM } } });
      if (!anagram) return { awarded: false };
    }
    const r = await awardMilestone(tx, sub.teamId, milestone, sub.id);
    return { awarded: r.awarded };
  });
}

export interface AnagramOutcome {
  correct: boolean;
  alreadySolved: boolean;
  incorrectAttempts: number;
  penaltyPoints: number;
  totalScore: number;
  starterTemplate?: string;
  algorithmName?: string;
}

/**
 * Verifies an anagram guess server-side. Everything happens under the per-team row lock, so N concurrent
 * wrong guesses apply exactly N penalties and concurrent correct guesses award exactly once.
 */
export async function submitAnagram(teamId: string, userId: string, guess: string): Promise<AnagramOutcome> {
  return prisma.$transaction(async (tx) => {
    // Deadline re-checked inside the transaction using the server clock.
    const comp = await getCompetition(tx);
    if (comp.row.status !== 'RUNNING') throw new HttpError(403, `COMPETITION_${comp.row.status}`, 'The competition is not accepting answers right now.');

    const p = await lockProgress(tx, teamId);
    const team = await tx.team.findUniqueOrThrow({ where: { id: teamId }, include: { variant: true } });
    if (!p.stage1QualifiedAt) throw new HttpError(403, 'STAGE1_REQUIRED', 'Qualify Stage 1 before attempting the anagram.');

    if (p.anagramSolvedAt) {
      return {
        correct: true, alreadySolved: true, incorrectAttempts: p.incorrectAttempts,
        penaltyPoints: p.incorrectAttempts * comp.row.anagramPenalty, totalScore: p.totalScore,
        starterTemplate: team.variant.starterTemplate, algorithmName: team.variant.hiddenModel,
      };
    }

    const correct = normalizeName(guess) === normalizeName(team.variant.hiddenModel);
    if (correct) {
      await tx.anagramAttempt.create({ data: { teamId, userId, guess: guess.slice(0, 80), correct: true } });
      await awardMilestone(tx, teamId, MILESTONE.ANAGRAM, null);
      const np = await tx.teamProgress.findUniqueOrThrow({ where: { teamId } });
      return {
        correct: true, alreadySolved: false, incorrectAttempts: np.incorrectAttempts,
        penaltyPoints: np.incorrectAttempts * comp.row.anagramPenalty, totalScore: np.totalScore,
        starterTemplate: team.variant.starterTemplate, algorithmName: team.variant.hiddenModel,
      };
    }

    await tx.anagramAttempt.create({ data: { teamId, userId, guess: guess.slice(0, 80), correct: false, penaltyApplied: comp.row.anagramPenalty } });
    await tx.teamProgress.update({ where: { teamId }, data: { incorrectAttempts: { increment: 1 } } });
    const np = await recompute(tx, teamId, false);
    return {
      correct: false, alreadySolved: false, incorrectAttempts: np.incorrectAttempts,
      penaltyPoints: np.incorrectAttempts * comp.row.anagramPenalty, totalScore: np.totalScore,
    };
  });
}

/** Admin: recompute total after adjustments/reset. */
export async function recomputeTeam(tx: Tx, teamId: string) {
  await lockProgress(tx, teamId);
  return recompute(tx, teamId, false);
}

/**
 * Leaderboard ordering (documented in README):
 *  1. totalScore DESC
 *  2. lastScoreAt ASC (the team that reached its score first wins; teams with no score time sort last)
 *  3. team name ASC (case-insensitive), 4. team id ASC  -> fully deterministic
 */
export function compareLeaderboard(
  a: { totalScore: number; lastScoreAt: Date | null; name: string; id: string },
  b: { totalScore: number; lastScoreAt: Date | null; name: string; id: string },
): number {
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  const ta = a.lastScoreAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const tb = b.lastScoreAt?.getTime() ?? Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta - tb;
  const n = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  return n !== 0 ? n : a.id.localeCompare(b.id);
}

