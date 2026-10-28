import type { CompetitionConfig } from '@prisma/client';
import { prisma, type Tx } from '../db.js';
import { HttpError } from '../auth/auth.js';

type Db = Tx | typeof prisma;

export async function getConfigRow(db: Db = prisma): Promise<CompetitionConfig> {
  return db.competitionConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/** Lazily transitions RUNNING -> ENDED once the server clock passes endsAt. Server clock is authoritative. */
export async function getCompetition(db: Db = prisma) {
  let row = await getConfigRow(db);
  const now = Date.now();
  if (row.status === 'RUNNING' && row.endsAt && row.endsAt.getTime() <= now) {
    row = await db.competitionConfig.update({ where: { id: 1 }, data: { status: 'ENDED', endsAt: row.endsAt, remainingSeconds: 0 } });
  }
  const remainingSeconds =
    row.status === 'RUNNING' && row.endsAt ? Math.max(0, Math.ceil((row.endsAt.getTime() - now) / 1000))
    : row.status === 'PAUSED' ? row.remainingSeconds ?? 0
    : row.status === 'NOT_STARTED' ? row.durationSeconds
    : 0;
  return { row, remainingSeconds, serverTime: new Date(now).toISOString() };
}

export function publicCompetition(c: Awaited<ReturnType<typeof getCompetition>>) {
  const r = c.row;
  return {
    status: r.status,
    durationSeconds: r.durationSeconds,
    remainingSeconds: c.remainingSeconds,
    endsAt: r.status === 'RUNNING' ? r.endsAt?.toISOString() ?? null : null,
    serverTime: c.serverTime,
    points: { stage1: r.stage1Points, anagram: r.anagramPoints, stage2: r.stage2Points, penalty: r.anagramPenalty, max: r.maxScore },
  };
}

/** Throws unless the competition is accepting actions right now. */
export async function assertOpen(db: Db = prisma) {
  const c = await getCompetition(db);
  if (c.row.status === 'RUNNING') return c;
  const msg = {
    NOT_STARTED: 'The competition has not started yet.',
    PAUSED: 'The competition is paused.',
    ENDED: 'The competition has ended.',
  }[c.row.status];
  throw new HttpError(403, `COMPETITION_${c.row.status}`, msg);
}

export async function startCompetition(durationSeconds?: number) {
  return prisma.$transaction(async (tx) => {
    const c = await getCompetition(tx);
    if (c.row.status === 'RUNNING' || c.row.status === 'PAUSED')
      throw new HttpError(409, 'ALREADY_STARTED', 'Competition already in progress.');
    const dur = durationSeconds ?? c.row.durationSeconds;
    const now = new Date();
    return tx.competitionConfig.update({
      where: { id: 1 },
      data: { status: 'RUNNING', durationSeconds: dur, startedAt: now, endsAt: new Date(now.getTime() + dur * 1000), remainingSeconds: null },
    });
  });
}

export async function pauseCompetition() {
  return prisma.$transaction(async (tx) => {
    const c = await getCompetition(tx);
    if (c.row.status !== 'RUNNING') throw new HttpError(409, 'NOT_RUNNING', 'Competition is not running.');
    return tx.competitionConfig.update({ where: { id: 1 }, data: { status: 'PAUSED', remainingSeconds: c.remainingSeconds, endsAt: null } });
  });
}

export async function resumeCompetition() {
  return prisma.$transaction(async (tx) => {
    const c = await getCompetition(tx);
    if (c.row.status !== 'PAUSED') throw new HttpError(409, 'NOT_PAUSED', 'Competition is not paused.');
    const rem = c.row.remainingSeconds ?? 0;
    return tx.competitionConfig.update({ where: { id: 1 }, data: { status: 'RUNNING', endsAt: new Date(Date.now() + rem * 1000), remainingSeconds: null } });
  });
}

export async function endCompetition() {
  return prisma.$transaction(async (tx) => {
    await getCompetition(tx);
    return tx.competitionConfig.update({ where: { id: 1 }, data: { status: 'ENDED', endsAt: null, remainingSeconds: 0 } });
  });
}

