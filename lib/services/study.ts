import type { Prisma, StudySession } from '@prisma/client';

import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import {
  monthRange,
  toDayKey,
  trailingDayRange,
  weekRange,
  type DateRange,
  type DayKey,
} from '@/lib/dates';
import { studySessionCreateSchema, studySessionUpdateSchema } from '@/lib/validations/study';
import { studySessionAward } from '@/lib/xp';

import { syncAchievements } from './achievements';
import { parseOrThrow } from './validate';
import { awardXP } from './xp';

/**
 * Study service.
 *
 * XP is granted once per session row (`STUDY_SESSION:<id>`), scaled by
 * duration. Editing a session's duration does not re-award XP, which keeps the
 * reward tied to the act of studying rather than to edits.
 */

export interface StudyListFilter {
  subject?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export async function listStudySessions(
  userId: string,
  filter: StudyListFilter = {},
): Promise<StudySession[]> {
  const where: Prisma.StudySessionWhereInput = { userId };
  if (filter.subject) where.subject = { equals: filter.subject, mode: 'insensitive' };
  if (filter.from || filter.to) {
    where.sessionDate = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }

  return prisma.studySession.findMany({
    where,
    orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }],
    ...(filter.limit ? { take: filter.limit } : {}),
  });
}

export async function getStudySession(userId: string, id: string): Promise<StudySession> {
  const session = await prisma.studySession.findFirst({ where: { id, userId } });
  if (!session) throw new NotFoundError('Study session');
  return session;
}

export async function createStudySession(
  userId: string,
  input: unknown,
): Promise<{ session: StudySession; xpAwarded: number }> {
  const data = parseOrThrow(studySessionCreateSchema, input);

  const session = await prisma.studySession.create({
    data: {
      userId,
      subject: data.subject,
      topic: data.topic,
      durationMinutes: data.durationMinutes,
      notes: data.notes,
      sessionDate: data.sessionDate,
    },
  });

  const result = await awardXP(userId, studySessionAward(session));
  await syncAchievements(userId);
  return { session, xpAwarded: result.points };
}

export async function updateStudySession(
  userId: string,
  id: string,
  input: unknown,
): Promise<StudySession> {
  const data = parseOrThrow(studySessionUpdateSchema, input);
  const existing = await getStudySession(userId, id);

  return prisma.studySession.update({
    where: { id: existing.id },
    data: {
      subject: data.subject,
      topic: data.topic,
      durationMinutes: data.durationMinutes,
      notes: data.notes,
      sessionDate: data.sessionDate,
    },
  });
}

export async function deleteStudySession(userId: string, id: string): Promise<void> {
  const existing = await getStudySession(userId, id);
  await prisma.studySession.delete({ where: { id: existing.id } });
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

async function minutesBetween(userId: string, range: DateRange): Promise<number> {
  const result = await prisma.studySession.aggregate({
    where: { userId, sessionDate: { gte: range.start, lte: range.end } },
    _sum: { durationMinutes: true },
  });
  return result._sum.durationMinutes ?? 0;
}

export interface StudySummary {
  todayMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
  totalMinutes: number;
  sessionCount: number;
  averageSessionMinutes: number;
  distinctSubjects: number;
}

export async function getStudySummary(userId: string): Promise<StudySummary> {
  const now = new Date();
  const today = { start: startOfToday(now), end: endOfToday(now) };

  const [todayMinutes, weekMinutes, monthMinutes, totals, subjects] = await Promise.all([
    minutesBetween(userId, today),
    minutesBetween(userId, weekRange(now)),
    minutesBetween(userId, monthRange(now)),
    prisma.studySession.aggregate({
      where: { userId },
      _sum: { durationMinutes: true },
      _count: { _all: true },
      _avg: { durationMinutes: true },
    }),
    prisma.studySession.findMany({
      where: { userId },
      distinct: ['subject'],
      select: { subject: true },
    }),
  ]);

  return {
    todayMinutes,
    weekMinutes,
    monthMinutes,
    totalMinutes: totals._sum.durationMinutes ?? 0,
    sessionCount: totals._count._all,
    averageSessionMinutes: Math.round(totals._avg.durationMinutes ?? 0),
    distinctSubjects: subjects.length,
  };
}

/** Minutes per subject, descending. Powers the subject breakdown chart. */
export async function getStudyBySubject(
  userId: string,
  range?: DateRange,
): Promise<{ subject: string; minutes: number; sessions: number }[]> {
  const rows = await prisma.studySession.groupBy({
    by: ['subject'],
    where: {
      userId,
      ...(range ? { sessionDate: { gte: range.start, lte: range.end } } : {}),
    },
    _sum: { durationMinutes: true },
    _count: { _all: true },
  });

  return rows
    .map((row) => ({
      subject: row.subject,
      minutes: row._sum.durationMinutes ?? 0,
      sessions: row._count._all,
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Zero-filled daily minutes for the trailing `days` days. */
export async function getStudyByDay(
  userId: string,
  days = 14,
): Promise<{ dayKey: DayKey; minutes: number }[]> {
  const range = trailingDayRange(days);
  const sessions = await prisma.studySession.findMany({
    where: { userId, sessionDate: { gte: range.start, lte: range.end } },
    select: { sessionDate: true, durationMinutes: true },
  });

  const buckets = new Map<DayKey, number>();
  const cursor = new Date(range.start);
  while (cursor <= range.end) {
    buckets.set(toDayKey(cursor), 0);
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const session of sessions) {
    const key = toDayKey(session.sessionDate);
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + session.durationMinutes);
  }

  return [...buckets.entries()].map(([dayKey, minutes]) => ({ dayKey, minutes }));
}

/** Subjects the user has already logged, for the form's autocomplete list. */
export async function getStudySubjects(userId: string): Promise<string[]> {
  const rows = await prisma.studySession.findMany({
    where: { userId },
    distinct: ['subject'],
    orderBy: { subject: 'asc' },
    select: { subject: true },
  });
  return rows.map((row) => row.subject);
}

function startOfToday(reference: Date): Date {
  const date = new Date(reference);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday(reference: Date): Date {
  const date = new Date(reference);
  date.setHours(23, 59, 59, 999);
  return date;
}
