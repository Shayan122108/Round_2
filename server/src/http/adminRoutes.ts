import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { HttpError, hashPin, requireAdmin } from '../auth/auth.js';
import { ok, parse } from './util.js';
import {
  endCompetition, getCompetition, pauseCompetition, publicCompetition, resumeCompetition, startCompetition,
} from '../services/competition.js';
import { audit } from '../services/audit.js';
import { recomputeTeam } from '../services/scoring.js';
import { enqueueSubmission, queueStats } from '../services/queue.js';
import { buildLeaderboard } from './playerRoutes.js';
import { safeUnlink } from '../services/storage.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin); // every /api/admin/* route is gated server-side

const idParam = z.string().uuid();

adminRouter.get('/overview', async (_req, res) => {
  const [teams, users, subs, byStatus, comp, q, recentFailed, durations] = await Promise.all([
    prisma.team.count(), prisma.user.count({ where: { role: 'PARTICIPANT' } }), prisma.submission.count(),
    prisma.submission.groupBy({ by: ['status'], _count: true }),
    getCompetition(),
    queueStats().catch(() => null),
    prisma.submission.findMany({ where: { status: 'FAILED' }, orderBy: { completedAt: 'desc' }, take: 10, include: { result: true, team: { select: { name: true } } } }),
    prisma.evaluationResult.aggregate({ _avg: { durationMs: true }, _max: { durationMs: true } }),
  ]);
  const board = await buildLeaderboard();
  const funnel = { stage1: board.filter((b) => b.stage1).length, anagram: board.filter((b) => b.anagram).length, stage2: board.filter((b) => b.stage2).length };
  ok(res, {
    competition: publicCompetition(comp),
    counts: { teams, participants: users, submissions: subs },
    submissionsByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    queue: q,
    evaluation: { avgDurationMs: Math.round(durations._avg.durationMs ?? 0), maxDurationMs: durations._max.durationMs ?? 0 },
    funnel,
    scoreDistribution: board.map((b) => b.totalScore),
    recentFailures: recentFailed.map((f) => ({ id: f.id, team: f.team.name, stage: f.stage, errorCode: f.result?.errorCode ?? null, at: f.completedAt })),
  });
});

// ---------- teams / users ----------
adminRouter.get('/teams', async (_req, res) => {
  const teams = await prisma.team.findMany({ include: { members: { select: { id: true, registrationId: true, displayName: true } }, progress: true, variant: { select: { id: true, label: true } } }, orderBy: { name: 'asc' } });
  ok(res, teams.map((t) => ({
    id: t.id, name: t.name, variantId: t.variantId, variantLabel: t.variant.label, scoreAdjustment: t.scoreAdjustment,
    members: t.members, progress: t.progress,
  })));
});

const teamCreate = z.object({
  name: z.string().trim().min(2).max(60),
  variantId: z.number().int().min(1).max(99),
  members: z.array(z.object({
    registrationId: z.string().trim().min(1).max(64),
    displayName: z.string().trim().min(1).max(80),
    pin: z.string().min(6).max(128),
  })).max(10).default([]),
}).strict();

adminRouter.post('/teams', async (req, res) => {
  const b = parse(teamCreate, req.body);
  const variant = await prisma.variant.findUnique({ where: { id: b.variantId } });
  if (!variant?.enabled) throw new HttpError(400, 'BAD_VARIANT', 'Unknown or disabled variant.');
  const hashes = await Promise.all(b.members.map((m) => hashPin(m.pin)));
  try {
    const team = await prisma.$transaction(async (tx) => {
      const t = await tx.team.create({ data: { name: b.name, variantId: b.variantId, progress: { create: {} } } });
      for (const [i, m] of b.members.entries())
        await tx.user.create({ data: { registrationId: m.registrationId.toUpperCase(), displayName: m.displayName, pinHash: hashes[i]!, teamId: t.id } });
      await audit(req.user!.id, 'TEAM_CREATED', t.id, { name: b.name, variantId: b.variantId, members: b.members.map((m) => m.registrationId) }, tx);
      return t;
    });
    ok(res, { id: team.id, name: team.name }, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new HttpError(409, 'DUPLICATE', 'Team name or registration ID already exists.');
    throw e;
  }
});

const teamPatch = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  scoreAdjustment: z.number().int().min(-150).max(150).optional(),
  reason: z.string().trim().min(3).max(300).optional(),
}).strict();

adminRouter.patch('/teams/:id', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const b = parse(teamPatch, req.body);
  if (b.scoreAdjustment !== undefined && !b.reason) throw new HttpError(400, 'REASON_REQUIRED', 'A reason is required for score corrections.');
  const out = await prisma.$transaction(async (tx) => {
    const before = await tx.team.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, 'NOT_FOUND', 'Team not found.');
    const t = await tx.team.update({ where: { id }, data: { name: b.name, scoreAdjustment: b.scoreAdjustment } });
    const prog = await recomputeTeam(tx, id);
    await audit(req.user!.id, b.scoreAdjustment !== undefined ? 'SCORE_ADJUSTED' : 'TEAM_UPDATED', id, { before: { name: before.name, adj: before.scoreAdjustment }, after: { name: t.name, adj: t.scoreAdjustment }, reason: b.reason }, tx);
    return { team: t, totalScore: prog.totalScore };
  });
  ok(res, { id, name: out.team.name, scoreAdjustment: out.team.scoreAdjustment, totalScore: out.totalScore });
});

const reassign = z.object({ variantId: z.number().int().min(1).max(99), force: z.boolean().default(false) }).strict();

adminRouter.post('/teams/:id/reassign-variant', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const b = parse(reassign, req.body);
  await prisma.$transaction(async (tx) => {
    const team = await tx.team.findUnique({ where: { id }, include: { progress: true } });
    if (!team) throw new HttpError(404, 'NOT_FOUND', 'Team not found.');
    const v = await tx.variant.findUnique({ where: { id: b.variantId } });
    if (!v?.enabled) throw new HttpError(400, 'BAD_VARIANT', 'Unknown or disabled variant.');
    const hasProgress = !!(team.progress?.stage1QualifiedAt || team.progress?.anagramSolvedAt);
    if (hasProgress && !b.force) throw new HttpError(409, 'HAS_PROGRESS', 'Team already has progress; pass force=true to reassign.');
    await tx.team.update({ where: { id }, data: { variantId: b.variantId } });
    await audit(req.user!.id, 'VARIANT_REASSIGNED', id, { from: team.variantId, to: b.variantId, force: b.force }, tx);
  });
  ok(res, { id, variantId: b.variantId });
});

adminRouter.get('/variants', async (_req, res) => {
  const vs = await prisma.variant.findMany({ orderBy: { id: 'asc' }, select: { id: true, label: true, hiddenModel: true, shuffledLetters: true, estimator: true, stage1MinAccuracy: true, stage2MinAccuracy: true, stage2MinMacroF1: true, enabled: true } });
  ok(res, vs);
});

const variantPatch = z.object({
  stage1MinAccuracy: z.number().min(0).max(1).optional(),
  stage2MinAccuracy: z.number().min(0).max(1).optional(),
  stage2MinMacroF1: z.number().min(0).max(1).optional(),
  enabled: z.boolean().optional(),
}).strict();

adminRouter.patch('/variants/:id', async (req, res) => {
  const id = parse(z.coerce.number().int(), req.params.id);
  const b = parse(variantPatch, req.body);
  const v = await prisma.variant.update({ where: { id }, data: b }).catch(() => { throw new HttpError(404, 'NOT_FOUND', 'Variant not found.'); });
  await audit(req.user!.id, 'VARIANT_UPDATED', String(id), b);
  ok(res, { id: v.id });
});

// ---------- submissions ----------
adminRouter.get('/submissions', async (req, res) => {
  const q = parse(z.object({
    status: z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
    stage: z.coerce.number().int().min(1).max(2).optional(),
    teamId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }), req.query);
  const rows = await prisma.submission.findMany({
    where: { status: q.status, stage: q.stage, teamId: q.teamId }, orderBy: { queuedAt: 'desc' }, take: q.limit,
    include: { result: true, team: { select: { name: true, variantId: true } } },
  });
  ok(res, rows.map((s) => ({ id: s.id, team: s.team.name, variantId: s.team.variantId, stage: s.stage, status: s.status, attempts: s.attempts, queuedAt: s.queuedAt, startedAt: s.startedAt, completedAt: s.completedAt, sizeBytes: s.sizeBytes, sha256: s.sha256, result: s.result })));
});

adminRouter.get('/submissions/:id', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const s = await prisma.submission.findUnique({ where: { id }, include: { result: true, team: { select: { name: true, variantId: true } } } });
  if (!s) throw new HttpError(404, 'NOT_FOUND', 'Submission not found.');
  const { artifactPath: _p, ...safe } = s; // server file paths never leave the API
  ok(res, safe);
});

adminRouter.post('/submissions/:id/retry', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const s = await prisma.submission.findUnique({ where: { id }, include: { result: true } });
  if (!s) throw new HttpError(404, 'NOT_FOUND', 'Submission not found.');
  if (s.status !== 'FAILED') throw new HttpError(409, 'NOT_FAILED', 'Only FAILED submissions can be retried.');
  await prisma.$transaction(async (tx) => {
    await tx.evaluationResult.deleteMany({ where: { submissionId: id } });
    await tx.submission.update({ where: { id }, data: { status: 'QUEUED', startedAt: null, completedAt: null, enqueuedAt: null, queuedAt: new Date() } });
    await audit(req.user!.id, 'SUBMISSION_RETRY', id, undefined, tx);
  });
  await enqueueSubmission(id).catch(() => undefined); // recovery loop covers failures
  ok(res, { id, status: 'QUEUED' });
});

adminRouter.post('/submissions/:id/cancel', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const r = await prisma.submission.updateMany({ where: { id, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'CANCELLED', completedAt: new Date() } });
  if (r.count === 0) throw new HttpError(409, 'NOT_CANCELLABLE', 'Submission is not queued or running.');
  await audit(req.user!.id, 'SUBMISSION_CANCEL', id);
  ok(res, { id, status: 'CANCELLED' });
});

// ---------- competition ----------
const startBody = z.object({ durationSeconds: z.number().int().min(60).max(86400).optional() }).strict();

adminRouter.post('/competition/start', async (req, res) => {
  const b = parse(startBody, req.body ?? {});
  await startCompetition(b.durationSeconds);
  await audit(req.user!.id, 'COMPETITION_START', null, b);
  ok(res, publicCompetition(await getCompetition()));
});
adminRouter.post('/competition/pause', async (req, res) => { await pauseCompetition(); await audit(req.user!.id, 'COMPETITION_PAUSE'); ok(res, publicCompetition(await getCompetition())); });
adminRouter.post('/competition/resume', async (req, res) => { await resumeCompetition(); await audit(req.user!.id, 'COMPETITION_RESUME'); ok(res, publicCompetition(await getCompetition())); });
adminRouter.post('/competition/end', async (req, res) => { await endCompetition(); await audit(req.user!.id, 'COMPETITION_END'); ok(res, publicCompetition(await getCompetition())); });

const configPatch = z.object({
  durationSeconds: z.number().int().min(60).max(86400).optional(),
  stage1Points: z.number().int().min(0).max(150).optional(),
  anagramPoints: z.number().int().min(0).max(150).optional(),
  stage2Points: z.number().int().min(0).max(150).optional(),
  anagramPenalty: z.number().int().min(0).max(150).optional(),
}).strict();

adminRouter.patch('/competition/config', async (req, res) => {
  const b = parse(configPatch, req.body);
  const c = await getCompetition();
  if (c.row.status === 'RUNNING' && (b.stage1Points !== undefined || b.anagramPoints !== undefined || b.stage2Points !== undefined || b.anagramPenalty !== undefined))
    throw new HttpError(409, 'RUNNING', 'Point values cannot change while the competition is running.');
  await prisma.competitionConfig.update({ where: { id: 1 }, data: b });
  await audit(req.user!.id, 'COMPETITION_CONFIG', null, b);
  ok(res, publicCompetition(await getCompetition()));
});

// ---------- reset (explicit confirmation) ----------
adminRouter.post('/reset-scores', async (req, res) => {
  const b = parse(z.object({ confirm: z.literal('RESET ALL SCORES') }).strict(), req.body);
  void b;
  const subs = await prisma.submission.findMany({ select: { artifactPath: true } });
  await prisma.$transaction(async (tx) => {
    await tx.stageCompletion.deleteMany();
    await tx.anagramAttempt.deleteMany();
    await tx.submission.deleteMany(); // cascades evaluation results
    await tx.team.updateMany({ data: { scoreAdjustment: 0 } });
    await tx.teamProgress.updateMany({ data: { stage1Points: 0, anagramPoints: 0, stage2Points: 0, incorrectAttempts: 0, stage1QualifiedAt: null, anagramSolvedAt: null, stage2QualifiedAt: null, totalScore: 0, lastScoreAt: null } });
    await tx.competitionConfig.update({ where: { id: 1 }, data: { status: 'NOT_STARTED', startedAt: null, endsAt: null, remainingSeconds: null } });
    await audit(req.user!.id, 'RESET_SCORES', null, { submissionsDeleted: subs.length }, tx);
  });
  await Promise.all(subs.map((s) => safeUnlink(s.artifactPath)));
  ok(res, { reset: true });
});

adminRouter.get('/leaderboard', async (_req, res) => {
  const board = await buildLeaderboard();
  ok(res, board.map((b, i) => ({ rank: i + 1, teamId: b.teamId, name: b.name, totalScore: b.totalScore, lastScoreAt: b.lastScoreAt })));
});

adminRouter.get('/audit-logs', async (req, res) => {
  const q = parse(z.object({ limit: z.coerce.number().int().min(1).max(500).default(100), action: z.string().max(60).optional() }), req.query);
  ok(res, await prisma.auditLog.findMany({ where: { action: q.action }, orderBy: { createdAt: 'desc' }, take: q.limit }));
});

