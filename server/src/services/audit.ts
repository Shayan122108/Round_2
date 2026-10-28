import { prisma, type Tx } from '../db.js';

type Db = Tx | typeof prisma;

export async function audit(actorId: string | null, action: string, target?: string | null, details?: unknown, db: Db = prisma) {
  await db.auditLog.create({
    data: { actorId, action, target: target ?? null, details: details === undefined ? undefined : (details as object) },
  });
}

