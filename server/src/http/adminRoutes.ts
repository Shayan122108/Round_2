import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError, requireAdmin } from '../auth/auth.js';
import { ok, parse } from './util.js';
import {
  endCompetition, getCompetition, pauseCompetition, publicCompetition, resumeCompetition, startCompetition,
} from '../services/competition.js';
import { audit } from '../services/audit.js';
<<<<<<< HEAD
=======
import { recomputeTeam } from '../services/scoring.js';
import { enqueueSubmission, queueStats } from '../services/queue.js';
import { buildLeaderboard } from './playerRoutes.js';
import { safeUnlink } from '../services/storage.js';
import { runAdminEvaluator } from '../services/adminEvaluator.js';
>>>>>>> 6790b9ff7981255ac233b9d6821f13fe9b3cd55d

export const adminRouter = Router();
adminRouter.use(requireAdmin); // Every /api/admin/* route requires authenticated admin role

// ---------- Overview & Dashboard Stats ----------
adminRouter.get('/overview', async (_req, res) => {
  const [
    totalParticipants,
    pendingR1,
    pendingR3,
    r1Approved,
    r2Solved,
    r3Approved,
    comp,
    benchmark,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'PARTICIPANT' } }),
    prisma.user.count({ where: { role: 'PARTICIPANT', round1Status: 'PENDING_VERIFICATION' } }),
    prisma.user.count({ where: { role: 'PARTICIPANT', round3Status: 'PENDING_VERIFICATION' } }),
    prisma.user.count({ where: { role: 'PARTICIPANT', round1Status: 'APPROVED' } }),
    prisma.user.count({ where: { role: 'PARTICIPANT', round2Status: 'SOLVED' } }),
    prisma.user.count({ where: { role: 'PARTICIPANT', round3Status: 'APPROVED' } }),
    getCompetition(),
    prisma.benchmarkConfig.findUnique({ where: { id: 1 } }),
  ]);

  ok(res, {
    competition: publicCompetition(comp),
    counts: {
      totalParticipants,
      pendingVerifications: pendingR1 + pendingR3,
      pendingRound1: pendingR1,
      pendingRound3: pendingR3,
      round1Approved: r1Approved,
      round2Solved: r2Solved,
      round3Approved: r3Approved,
    },
    benchmarks: benchmark,
  });
});

// ---------- Pending Verifications Queue ----------
adminRouter.get('/pending-verifications', async (_req, res) => {
  const participants = await prisma.user.findMany({
    where: {
      role: 'PARTICIPANT',
      OR: [
        { round1Status: 'PENDING_VERIFICATION' },
        { round3Status: 'PENDING_VERIFICATION' },
      ],
    },
    include: { variant: true },
    orderBy: { updatedAt: 'asc' },
  });

  const queue = participants.map((p) => {
    const roundAwaiting = p.round1Status === 'PENDING_VERIFICATION' ? 1 : 3;
    return {
      userId: p.id,
      registrationId: p.registrationId,
      webId: `WEB-${String(p.webId).padStart(3, '0')}`,
      numericWebId: p.webId,
      round: roundAwaiting,
      currentScore: p.totalScore,
      variantName: p.variant?.hiddenModel ?? 'Unassigned',
      variantLabel: p.variant?.label ?? '',
      round1Status: p.round1Status,
      round2Status: p.round2Status,
      round3Status: p.round3Status,
      round3BoilerplateReleased: p.round3BoilerplateReleased,
      requestedAt: p.updatedAt,
    };
  });

  ok(res, queue);
});

// ---------- All Participants & Search ----------
adminRouter.get('/participants', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const where: any = { role: 'PARTICIPANT' };
  if (search) {
    // Check if search is numeric web_id
    const num = Number.parseInt(search.replace(/[^0-9]/g, ''), 10);
    where.OR = [
      { registrationId: { contains: search, mode: 'insensitive' } },
      { displayName: { contains: search, mode: 'insensitive' } },
      ...(Number.isFinite(num) ? [{ webId: num }] : []),
    ];
  }

  const participants = await prisma.user.findMany({
    where,
    include: { variant: true },
    orderBy: { webId: 'asc' },
    take: 100,
  });

  ok(res, participants.map((p) => ({
    id: p.id,
    registrationId: p.registrationId,
    webId: `WEB-${String(p.webId).padStart(3, '0')}`,
    numericWebId: p.webId,
    displayName: p.displayName,
    totalScore: p.totalScore,
    variantId: p.variantId,
    variantLabel: p.variant?.label ?? null,
    hiddenModel: p.variant?.hiddenModel ?? null,
    round1Status: p.round1Status,
    round1Points: p.round1Points,
    round2Status: p.round2Status,
    round2Points: p.round2Points,
    round3Status: p.round3Status,
    round3Points: p.round3Points,
    round3BoilerplateReleased: p.round3BoilerplateReleased,
  })));
});

// ---------- Participant Detail View ----------
adminRouter.get('/participants/:id', async (req, res) => {
  const id = req.params.id;

  const [user, benchmark, decisions, audits] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: { variant: true },
    }),
    prisma.benchmarkConfig.findUnique({ where: { id: 1 } }),
    prisma.decisionHistory.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      where: { target: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  if (!user) {
    throw new HttpError(404, 'NOT_FOUND', 'Participant not found.');
  }

  ok(res, {
    participant: {
      id: user.id,
      registrationId: user.registrationId,
      webId: `WEB-${String(user.webId).padStart(3, '0')}`,
      numericWebId: user.webId,
      displayName: user.displayName,
      totalScore: user.totalScore,
      round1: {
        status: user.round1Status,
        points: user.round1Points,
        approvedAt: user.round1ApprovedAt,
        approvedBy: user.round1ApprovedBy,
        rejectionReason: user.round1RejectionReason,
      },
      round2: {
        status: user.round2Status,
        points: user.round2Points,
        solvedAt: user.round2SolvedAt,
        attempts: user.round2Attempts,
      },
      round3: {
        status: user.round3Status,
        points: user.round3Points,
        boilerplateReleased: user.round3BoilerplateReleased,
        boilerplateReleasedAt: user.round3BoilerplateReleasedAt,
        boilerplateReleasedBy: user.round3BoilerplateReleasedBy,
        approvedAt: user.round3ApprovedAt,
        approvedBy: user.round3ApprovedBy,
        rejectionReason: user.round3RejectionReason,
      },
      variant: user.variant ? {
        id: user.variant.id,
        label: user.variant.label,
        hiddenModel: user.variant.hiddenModel,
        estimator: user.variant.estimator,
      } : null,
      referenceMetrics: {
        round1: {
          mae: benchmark?.round1Mae ?? 1.25,
          rmse: benchmark?.round1Rmse ?? 1.85,
          mse: benchmark?.round1Mse ?? 3.42,
        },
        round3: user.variant ? {
          mae: user.variant.round3Mae,
          rmse: user.variant.round3Rmse,
          mse: user.variant.round3Mse,
        } : null,
      },
      decisions,
      audits,
    },
  });
});

// ---------- Manual Review Controls (Approve / Reject) ----------
const reviewSchema = z.object({
  round: z.union([z.literal(1), z.literal(3)]),
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().trim().max(300).optional().default(''),
}).strict();

adminRouter.post('/participants/:id/review', async (req, res) => {
  const id = req.params.id;
  const { round, action, reason } = parse(reviewSchema, req.body);
  const adminUser = req.user!;

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id },
      include: { variant: true },
    });

    if (!user) {
      throw new HttpError(404, 'NOT_FOUND', 'Participant not found.');
    }

    if (round === 1) {
      if (action === 'APPROVE') {
        if (user.round1Status === 'APPROVED') {
          throw new HttpError(400, 'ALREADY_APPROVED', 'Round 1 has already been approved.');
        }

        const newScore = Math.min(150, 30 + user.round2Points + user.round3Points);
        const updated = await tx.user.update({
          where: { id },
          data: {
            round1Status: 'APPROVED',
            round1Points: 30,
            round1ApprovedAt: new Date(),
            round1ApprovedBy: adminUser.displayName || adminUser.registrationId,
            round1RejectionReason: null,
            round2Status: user.round2Status === 'LOCKED' ? 'IN_PROGRESS' : user.round2Status,
            totalScore: newScore,
            lastScoreAt: new Date(),
          },
        });

        await tx.decisionHistory.create({
          data: {
            userId: id,
            round: 1,
            action: 'APPROVE',
            points: 30,
            reason: reason || 'Verified against admin reference metrics in person.',
            adminId: adminUser.id,
            adminName: adminUser.displayName || adminUser.registrationId,
          },
        });

        await audit(adminUser.id, 'ROUND_1_APPROVED', id, {
          registrationId: user.registrationId,
          pointsAwarded: 30,
          newTotalScore: newScore,
        }, tx);

        return { updated, message: 'Round 1 approved. 30 points awarded and Round 2 unlocked.' };
      } else {
        // REJECT
        const updated = await tx.user.update({
          where: { id },
          data: {
            round1Status: 'REJECTED',
            round1RejectionReason: reason || 'Metrics did not match reference standards.',
          },
        });

        await tx.decisionHistory.create({
          data: {
            userId: id,
            round: 1,
            action: 'REJECT',
            points: 0,
            reason: reason || 'Metrics rejected upon manual inspection.',
            adminId: adminUser.id,
            adminName: adminUser.displayName || adminUser.registrationId,
          },
        });

        await audit(adminUser.id, 'ROUND_1_REJECTED', id, {
          registrationId: user.registrationId,
          reason,
        }, tx);

        return { updated, message: 'Round 1 rejected. No points awarded.' };
      }
    } else {
      // Round 3 Review
      if (user.round2Status !== 'SOLVED') {
        throw new HttpError(403, 'ROUND2_REQUIRED', 'Round 2 must be solved before Round 3 can be evaluated.');
      }

      if (action === 'APPROVE') {
        if (user.round3Status === 'APPROVED') {
          throw new HttpError(400, 'ALREADY_APPROVED', 'Round 3 has already been approved.');
        }

        const newScore = Math.min(150, user.round1Points + user.round2Points + 70);
        const updated = await tx.user.update({
          where: { id },
          data: {
            round3Status: 'APPROVED',
            round3Points: 70,
            round3ApprovedAt: new Date(),
            round3ApprovedBy: adminUser.displayName || adminUser.registrationId,
            round3RejectionReason: null,
            totalScore: newScore,
            lastScoreAt: new Date(),
          },
        });

        await tx.decisionHistory.create({
          data: {
            userId: id,
            round: 3,
            action: 'APPROVE',
            points: 70,
            reason: reason || 'Model verified against variant reference metrics.',
            adminId: adminUser.id,
            adminName: adminUser.displayName || adminUser.registrationId,
          },
        });

        await audit(adminUser.id, 'ROUND_3_APPROVED', id, {
          registrationId: user.registrationId,
          variantId: user.variantId,
          pointsAwarded: 70,
          newTotalScore: newScore,
        }, tx);

        return { updated, message: 'Round 3 approved! 70 points awarded. Competition completed.' };
      } else {
        // REJECT
        const updated = await tx.user.update({
          where: { id },
          data: {
            round3Status: 'REJECTED',
            round3RejectionReason: reason || 'Metrics did not meet required thresholds.',
          },
        });

        await tx.decisionHistory.create({
          data: {
            userId: id,
            round: 3,
            action: 'REJECT',
            points: 0,
            reason: reason || 'Metrics rejected upon manual inspection.',
            adminId: adminUser.id,
            adminName: adminUser.displayName || adminUser.registrationId,
          },
        });

        await audit(adminUser.id, 'ROUND_3_REJECTED', id, {
          registrationId: user.registrationId,
          reason,
        }, tx);

        return { updated, message: 'Round 3 rejected. No points awarded.' };
      }
    }
  });

  ok(res, result);
});

// ---------- Release Round 3 Boilerplate ----------
adminRouter.post('/participants/:id/release-boilerplate', async (req, res) => {
  const id = req.params.id;
  const adminUser = req.user!;

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id },
      include: { variant: true },
    });

    if (!user) {
      throw new HttpError(404, 'NOT_FOUND', 'Participant not found.');
    }

    if (user.round2Status !== 'SOLVED') {
      throw new HttpError(400, 'ROUND2_NOT_SOLVED', 'Participant must solve Round 2 before Round 3 boilerplate can be released.');
    }

    if (user.round3BoilerplateReleased) {
      return { user, message: 'Boilerplate was already released for this participant.' };
    }

    const updated = await tx.user.update({
      where: { id },
      data: {
        round3BoilerplateReleased: true,
        round3BoilerplateReleasedAt: new Date(),
        round3BoilerplateReleasedBy: adminUser.displayName || adminUser.registrationId,
        round3Status: user.round3Status === 'AWAITING_RELEASE' ? 'READY' : user.round3Status,
      },
    });

    await audit(adminUser.id, 'ROUND3_BOILERPLATE_RELEASED', id, {
      registrationId: user.registrationId,
      variantId: user.variantId,
    }, tx);

    return { user: updated, message: `Round 3 boilerplate released for ${user.registrationId}.` };
  });

  ok(res, result);
});

// ---------- Admin Benchmark Management ----------
adminRouter.get('/benchmarks', async (_req, res) => {
  const [r1Benchmark, variants] = await Promise.all([
    prisma.benchmarkConfig.findUnique({ where: { id: 1 } }),
    prisma.variant.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        label: true,
        hiddenModel: true,
        estimator: true,
        round3Mae: true,
        round3Rmse: true,
        round3Mse: true,
      },
    }),
  ]);

  ok(res, {
    round1: r1Benchmark,
    variants,
  });
});

const benchmarkUpdateSchema = z.object({
  round1: z.object({
    mae: z.number().min(0),
    rmse: z.number().min(0),
    mse: z.number().min(0),
  }).optional(),
  variants: z.array(z.object({
    id: z.number().int().min(1).max(4),
    mae: z.number().min(0),
    rmse: z.number().min(0),
    mse: z.number().min(0),
  })).optional(),
}).strict();

adminRouter.put('/benchmarks', async (req, res) => {
  const { round1, variants } = parse(benchmarkUpdateSchema, req.body);
  const adminUser = req.user!;

  await prisma.$transaction(async (tx) => {
    if (round1) {
      await tx.benchmarkConfig.upsert({
        where: { id: 1 },
        update: {
          round1Mae: round1.mae,
          round1Rmse: round1.rmse,
          round1Mse: round1.mse,
          updatedBy: adminUser.displayName || adminUser.registrationId,
        },
        create: {
          id: 1,
          round1Mae: round1.mae,
          round1Rmse: round1.rmse,
          round1Mse: round1.mse,
          updatedBy: adminUser.displayName || adminUser.registrationId,
        },
      });
    }

    if (variants) {
      for (const v of variants) {
        await tx.variant.update({
          where: { id: v.id },
          data: {
            round3Mae: v.mae,
            round3Rmse: v.rmse,
            round3Mse: v.mse,
          },
        });
      }
    }

    await audit(adminUser.id, 'BENCHMARKS_UPDATED', null, { round1, variants }, tx);
  });

  ok(res, { success: true, message: 'Reference metrics updated successfully.' });
});

// ---------- Competition / Round Timer Controls ----------
adminRouter.get('/competition', async (_req, res) => {
  ok(res, publicCompetition(await getCompetition()));
});

<<<<<<< HEAD
=======
adminRouter.post('/submissions/:id/admin-evaluate', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const s = await prisma.submission.findUnique({ where: { id } });
  if (!s) throw new HttpError(404, 'NOT_FOUND', 'Submission not found.');
  const evalResult = await runAdminEvaluator(s.artifactPath);
  await prisma.evaluationResult.upsert({
    where: { submissionId: id },
    create: { submissionId: id, adminMetrics: evalResult as any },
    update: { adminMetrics: evalResult as any },
  });
  await audit(req.user!.id, 'ADMIN_EVALUATION_RUN', id, { result: evalResult });
  ok(res, { submissionId: id, result: evalResult });
});

adminRouter.post('/admin-evaluate-all', async (req, res) => {
  const subs = await prisma.submission.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    include: { team: { select: { name: true } } },
  });
  const results: any[] = [];
  for (const s of subs) {
    const evalResult = await runAdminEvaluator(s.artifactPath);
    await prisma.evaluationResult.upsert({
      where: { submissionId: s.id },
      create: { submissionId: s.id, adminMetrics: evalResult as any },
      update: { adminMetrics: evalResult as any },
    });
    results.push({ submissionId: s.id, teamName: s.team.name, stage: s.stage, result: evalResult });
  }
  await audit(req.user!.id, 'ADMIN_EVALUATION_ALL', null, { count: results.length });
  ok(res, { evaluated: results.length, results });
});

adminRouter.get('/admin-eval-results', async (_req, res) => {
  const subs = await prisma.submission.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    include: {
      team: { select: { id: true, name: true, variantId: true } },
      result: true,
    },
  });
  ok(res, subs.map((s) => ({
    submissionId: s.id,
    teamId: s.team.id,
    teamName: s.team.name,
    variantId: s.team.variantId,
    stage: s.stage,
    status: s.status,
    completedAt: s.completedAt,
    standardMetrics: {
      accuracy: s.result?.accuracy ?? null,
      f1: s.result?.f1 ?? null,
      qualified: s.result?.qualified ?? false,
    },
    adminMetrics: s.result?.adminMetrics ?? null,
  })));
});

// ---------- competition ----------
const startBody = z.object({ durationSeconds: z.number().int().min(60).max(86400).optional() }).strict();

>>>>>>> 6790b9ff7981255ac233b9d6821f13fe9b3cd55d
adminRouter.post('/competition/start', async (req, res) => {
  const durationSeconds = req.body?.durationSeconds ? Number(req.body.durationSeconds) : undefined;
  const force = Boolean(req.body?.force);
  await startCompetition(durationSeconds, force);
  await audit(req.user!.id, 'COMPETITION_START', undefined, { durationSeconds, force });
  ok(res, publicCompetition(await getCompetition()));
});

adminRouter.post('/competition/pause', async (req, res) => {
  await pauseCompetition();
  await audit(req.user!.id, 'COMPETITION_PAUSE');
  ok(res, publicCompetition(await getCompetition()));
});

adminRouter.post('/competition/resume', async (req, res) => {
  await resumeCompetition();
  await audit(req.user!.id, 'COMPETITION_RESUME');
  ok(res, publicCompetition(await getCompetition()));
});

adminRouter.post('/competition/end', async (req, res) => {
  await endCompetition();
  await audit(req.user!.id, 'COMPETITION_END');
  ok(res, publicCompetition(await getCompetition()));
});

// ---------- CSV Export of Participants / Leaderboard ----------
adminRouter.get('/export/csv', async (_req, res) => {
  const participants = await prisma.user.findMany({
    where: { role: 'PARTICIPANT' },
    include: { variant: true },
    orderBy: [
      { totalScore: 'desc' },
      { lastScoreAt: 'asc' },
      { webId: 'asc' },
    ],
  });

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = [
    'Rank',
    'Web ID',
    'Registration ID',
    'Display Name',
    'Assigned Model',
    'Variant ID',
    'Total Score',
    'Round 1 Status',
    'Round 1 Points',
    'Round 1 Approved By',
    'Round 1 Approved At',
    'Round 2 Status',
    'Round 2 Points',
    'Round 2 Attempts',
    'Round 2 Solved At',
    'Round 3 Status',
    'Round 3 Points',
    'Round 3 Boilerplate Released',
    'Round 3 Approved By',
    'Round 3 Approved At',
    'Last Score At',
    'Registered At',
  ];

  const rows = participants.map((p, idx) => [
    idx + 1,
    `WEB-${String(p.webId).padStart(3, '0')}`,
    p.registrationId,
    p.displayName,
    p.variant?.hiddenModel ?? 'None',
    p.variantId ?? '',
    p.totalScore,
    p.round1Status,
    p.round1Points,
    p.round1ApprovedBy ?? '',
    p.round1ApprovedAt ? p.round1ApprovedAt.toISOString() : '',
    p.round2Status,
    p.round2Points,
    p.round2Attempts,
    p.round2SolvedAt ? p.round2SolvedAt.toISOString() : '',
    p.round3Status,
    p.round3Points,
    p.round3BoilerplateReleased ? 'YES' : 'NO',
    p.round3ApprovedBy ?? '',
    p.round3ApprovedAt ? p.round3ApprovedAt.toISOString() : '',
    p.lastScoreAt ? p.lastScoreAt.toISOString() : '',
    p.createdAt.toISOString(),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="sdc_mlc_participants_${new Date().toISOString().slice(0, 10)}.csv"`
  );
  res.status(200).send(csvContent);
});

// ---------- Audit Logs ----------
adminRouter.get('/audit-logs', async (req, res) => {
  const limit = Math.min(200, Number.parseInt(req.query.limit as string, 10) || 50);
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  ok(res, logs);
});
