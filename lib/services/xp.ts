import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { levelProgress, type LevelProgress, type XPAward } from '@/lib/xp';

/**
 * XP persistence.
 *
 * Awards are written through `awardXP`, which relies on the unique
 * `(userId, dedupeKey)` index to make granting idempotent: completing a task,
 * un-completing it and completing it again yields exactly one XP row.
 */

export interface AwardResult {
  awarded: boolean;
  points: number;
}

/** Prisma's `Prisma.TransactionClient` for use inside `$transaction`. */
export type DbClient = Prisma.TransactionClient | typeof prisma;

export async function awardXP(
  userId: string,
  award: XPAward,
  client: DbClient = prisma,
): Promise<AwardResult> {
  if (award.points <= 0) return { awarded: false, points: 0 };

  // `skipDuplicates` lets the unique `(userId, dedupeKey)` index do the
  // de-duplicating in a single statement: a repeated action inserts nothing
  // and reports `count: 0` rather than raising a constraint violation, so
  // replaying an action is an ordinary outcome and not an error path.
  const result = await client.xPEvent.createMany({
    data: [
      {
        userId,
        type: award.type,
        points: award.points,
        reason: award.reason,
        dedupeKey: award.dedupeKey,
      },
    ],
    skipDuplicates: true,
  });

  return result.count > 0 ? { awarded: true, points: award.points } : { awarded: false, points: 0 };
}

export async function getTotalXP(userId: string, client: DbClient = prisma): Promise<number> {
  const result = await client.xPEvent.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  return result._sum.points ?? 0;
}

export async function getLevelProgress(
  userId: string,
  client: DbClient = prisma,
): Promise<LevelProgress> {
  return levelProgress(await getTotalXP(userId, client));
}

export interface XPEventSummary {
  id: string;
  type: string;
  points: number;
  reason: string;
  createdAt: Date;
}

export async function getRecentXPEvents(userId: string, limit = 10): Promise<XPEventSummary[]> {
  const events = await prisma.xPEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, type: true, points: true, reason: true, createdAt: true },
  });
  return events;
}

/** Daily XP totals for the analytics chart, zero-filled by the caller. */
export async function getXPByDay(
  userId: string,
  range: { start: Date; end: Date },
): Promise<{ createdAt: Date; points: number }[]> {
  return prisma.xPEvent.findMany({
    where: { userId, createdAt: { gte: range.start, lte: range.end } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true, points: true },
  });
}

/** XP grouped by source type, for the analytics breakdown. */
export async function getXPByType(userId: string): Promise<{ type: string; points: number }[]> {
  const rows = await prisma.xPEvent.groupBy({
    by: ['type'],
    where: { userId },
    _sum: { points: true },
  });
  return rows
    .map((row) => ({ type: row.type as string, points: row._sum.points ?? 0 }))
    .sort((a, b) => b.points - a.points);
}
