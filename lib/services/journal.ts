import type { JournalEntry, Mood, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { toUtcDateOnly, toUtcDayKey } from '@/lib/dates';
import { calculateStreak, type StreakResult } from '@/lib/streaks';
import { journalEntryCreateSchema, journalEntryUpdateSchema } from '@/lib/validations/journal';
import { journalEntryAward } from '@/lib/xp';

import { syncAchievements } from './achievements';
import { parseOrThrow } from './validate';
import { awardXP } from './xp';

/**
 * Journal service.
 *
 * `entryDate` is a `@db.Date`, so multiple entries per day are allowed while
 * streaks still collapse to distinct calendar days.
 */

export interface JournalListFilter {
  search?: string;
  mood?: Mood;
  from?: Date;
  to?: Date;
  limit?: number;
}

export async function listJournalEntries(
  userId: string,
  filter: JournalListFilter = {},
): Promise<JournalEntry[]> {
  const where: Prisma.JournalEntryWhereInput = { userId };
  if (filter.mood) where.mood = filter.mood;
  if (filter.search) {
    where.OR = [
      { title: { contains: filter.search, mode: 'insensitive' } },
      { content: { contains: filter.search, mode: 'insensitive' } },
    ];
  }
  if (filter.from || filter.to) {
    where.entryDate = {
      ...(filter.from ? { gte: toUtcDateOnly(filter.from) } : {}),
      ...(filter.to ? { lte: toUtcDateOnly(filter.to) } : {}),
    };
  }

  return prisma.journalEntry.findMany({
    where,
    orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
    ...(filter.limit ? { take: filter.limit } : {}),
  });
}

export async function getJournalEntry(userId: string, id: string): Promise<JournalEntry> {
  const entry = await prisma.journalEntry.findFirst({ where: { id, userId } });
  if (!entry) throw new NotFoundError('Journal entry');
  return entry;
}

export async function createJournalEntry(
  userId: string,
  input: unknown,
): Promise<{ entry: JournalEntry; xpAwarded: number }> {
  const data = parseOrThrow(journalEntryCreateSchema, input);

  const entry = await prisma.journalEntry.create({
    data: {
      userId,
      title: data.title,
      content: data.content,
      mood: data.mood,
      entryDate: toUtcDateOnly(data.entryDate),
    },
  });

  const result = await awardXP(
    userId,
    journalEntryAward({ id: entry.id, dayKey: toUtcDayKey(entry.entryDate) }),
  );
  await syncAchievements(userId);
  return { entry, xpAwarded: result.points };
}

export async function updateJournalEntry(
  userId: string,
  id: string,
  input: unknown,
): Promise<JournalEntry> {
  const data = parseOrThrow(journalEntryUpdateSchema, input);
  const existing = await getJournalEntry(userId, id);

  return prisma.journalEntry.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      content: data.content,
      mood: data.mood,
      entryDate: data.entryDate ? toUtcDateOnly(data.entryDate) : undefined,
    },
  });
}

export async function deleteJournalEntry(userId: string, id: string): Promise<void> {
  const existing = await getJournalEntry(userId, id);
  await prisma.journalEntry.delete({ where: { id: existing.id } });
}

export interface JournalSummary {
  totalEntries: number;
  streak: StreakResult;
  moodCounts: { mood: string; count: number }[];
  /** Average words per entry, rounded. */
  averageWords: number;
}

export async function getJournalSummary(userId: string): Promise<JournalSummary> {
  const [entries, moodRows] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { userId },
      select: { entryDate: true, content: true },
    }),
    prisma.journalEntry.groupBy({
      by: ['mood'],
      where: { userId, mood: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const words = entries.reduce(
    (sum, entry) => sum + entry.content.trim().split(/\s+/).filter(Boolean).length,
    0,
  );

  return {
    totalEntries: entries.length,
    streak: calculateStreak(
      entries.map((entry) => toUtcDayKey(entry.entryDate)),
      toUtcDayKey(new Date()),
    ),
    moodCounts: moodRows
      .map((row) => ({ mood: (row.mood ?? 'UNSET') as string, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    averageWords: entries.length === 0 ? 0 : Math.round(words / entries.length),
  };
}

export async function getRecentJournalEntries(userId: string, limit = 3): Promise<JournalEntry[]> {
  return listJournalEntries(userId, { limit });
}
