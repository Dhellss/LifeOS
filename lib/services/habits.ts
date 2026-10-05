import type { Habit, HabitLog } from '@prisma/client';

import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import {
  monthRange,
  parseDayKey,
  toDayKey,
  toUtcDateOnly,
  toUtcDayKey,
  trailingDayRange,
  type DayKey,
} from '@/lib/dates';
import { calculateStreak, qualifyingDayKeys, type StreakResult } from '@/lib/streaks';
import { habitCheckinSchema, habitCreateSchema, habitUpdateSchema } from '@/lib/validations/habit';
import { habitCheckinAward } from '@/lib/xp';

import { syncAchievements } from './achievements';
import { parseOrThrow } from './validate';
import { awardXP } from './xp';

/**
 * Habit service.
 *
 * Logs are keyed `(habitId, date)` with `date` stored as a `@db.Date`, so the
 * database itself enforces "one check-in per habit per day". Streaks are
 * recomputed from the log history by the pure helpers in `lib/streaks.ts`.
 */

/** How many days of history the habit cards render as a mini heatmap. */
export const HABIT_HISTORY_DAYS = 28;

export interface HabitWithStats extends Habit {
  streak: StreakResult;
  /** `yyyy-MM-dd` -> count, covering the trailing `HABIT_HISTORY_DAYS`. */
  history: Record<DayKey, number>;
  todayCount: number;
  completedToday: boolean;
  /** Share of the trailing window that met the target, 0-100. */
  completionRate: number;
}

export async function listHabits(
  userId: string,
  options: { includeInactive?: boolean } = {},
): Promise<HabitWithStats[]> {
  const habits = await prisma.habit.findMany({
    where: { userId, ...(options.includeInactive ? {} : { isActive: true }) },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    include: { logs: { orderBy: { date: 'asc' } } },
  });
  return habits.map((habit) => decorate(habit, habit.logs));
}

export async function getHabit(userId: string, habitId: string): Promise<HabitWithStats> {
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId },
    include: { logs: { orderBy: { date: 'asc' } } },
  });
  if (!habit) throw new NotFoundError('Habit');
  return decorate(habit, habit.logs);
}

export async function createHabit(userId: string, input: unknown): Promise<HabitWithStats> {
  const data = parseOrThrow(habitCreateSchema, input);
  const habit = await prisma.habit.create({
    data: {
      userId,
      name: data.name,
      description: data.description,
      frequency: data.frequency,
      targetCount: data.targetCount,
      color: data.color,
    },
  });
  return decorate(habit, []);
}

export async function updateHabit(
  userId: string,
  habitId: string,
  input: unknown,
): Promise<HabitWithStats> {
  const data = parseOrThrow(habitUpdateSchema, input);
  const existing = await prisma.habit.findFirst({
    where: { id: habitId, userId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Habit');

  const habit = await prisma.habit.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      description: data.description,
      frequency: data.frequency,
      targetCount: data.targetCount,
      color: data.color,
      isActive: data.isActive,
    },
    include: { logs: { orderBy: { date: 'asc' } } },
  });
  return decorate(habit, habit.logs);
}

export async function deleteHabit(userId: string, habitId: string): Promise<void> {
  const existing = await prisma.habit.findFirst({
    where: { id: habitId, userId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Habit');
  await prisma.habit.delete({ where: { id: existing.id } });
}

/**
 * Record (or revise) a check-in.
 *
 * Passing `count: 0` removes the log for that day, which is how the UI
 * un-checks a habit. XP is awarded once per habit per day via the dedupe key,
 * so toggling a check-in off and on again does not farm XP.
 */
export async function checkInHabit(
  userId: string,
  input: unknown,
): Promise<{ habit: HabitWithStats; xpAwarded: number }> {
  const data = parseOrThrow(habitCheckinSchema, input);

  const habit = await prisma.habit.findFirst({
    where: { id: data.habitId, userId },
    select: { id: true, name: true, targetCount: true },
  });
  if (!habit) throw new NotFoundError('Habit');

  const date = toUtcDateOnly(parseDayKey(data.date));

  if (data.count <= 0) {
    await prisma.habitLog.deleteMany({ where: { habitId: habit.id, date } });
    return { habit: await getHabit(userId, habit.id), xpAwarded: 0 };
  }

  await prisma.habitLog.upsert({
    where: { habitId_date: { habitId: habit.id, date } },
    create: { habitId: habit.id, userId, date, count: data.count, note: data.note },
    update: { count: data.count, note: data.note },
  });

  let xpAwarded = 0;
  if (data.count >= habit.targetCount) {
    const result = await awardXP(
      userId,
      habitCheckinAward({ habitId: habit.id, dayKey: data.date, habitName: habit.name }),
    );
    xpAwarded = result.points;
    await syncAchievements(userId);
  }

  return { habit: await getHabit(userId, habit.id), xpAwarded };
}

export interface HabitSummary {
  activeHabits: number;
  completedToday: number;
  longestStreak: number;
  /** Share of today's active habits that have met their target, 0-100. */
  todayCompletionRate: number;
}

export async function getHabitSummary(userId: string): Promise<HabitSummary> {
  const habits = await listHabits(userId);
  const completedToday = habits.filter((habit) => habit.completedToday).length;
  const longestStreak = habits.reduce((max, habit) => Math.max(max, habit.streak.longest), 0);
  return {
    activeHabits: habits.length,
    completedToday,
    longestStreak,
    todayCompletionRate:
      habits.length === 0 ? 0 : Math.round((completedToday / habits.length) * 100),
  };
}

/** Per-day completion ratio across all active habits, for the analytics chart. */
export async function getHabitCompletionByDay(
  userId: string,
  days = 30,
): Promise<{ dayKey: DayKey; completed: number; target: number }[]> {
  const range = trailingDayRange(days);
  const habits = await prisma.habit.findMany({
    where: { userId, isActive: true },
    select: {
      id: true,
      targetCount: true,
      createdAt: true,
      logs: {
        where: { date: { gte: toUtcDateOnly(range.start), lte: toUtcDateOnly(range.end) } },
        select: { date: true, count: true },
      },
    },
  });

  const buckets = new Map<DayKey, { completed: number; target: number }>();
  for (const dayKey of eachDay(range.start, range.end)) {
    buckets.set(dayKey, { completed: 0, target: 0 });
  }

  for (const habit of habits) {
    const met = new Set(
      qualifyingDayKeys(
        habit.logs.map((log) => ({ dayKey: toUtcDayKey(log.date), count: log.count })),
        habit.targetCount,
      ),
    );
    const createdKey = toDayKey(habit.createdAt);
    for (const [dayKey, bucket] of buckets) {
      // A habit cannot be expected on days before it existed.
      if (dayKey < createdKey) continue;
      bucket.target += 1;
      if (met.has(dayKey)) bucket.completed += 1;
    }
  }

  return [...buckets.entries()].map(([dayKey, bucket]) => ({ dayKey, ...bucket }));
}

/** Month heatmap data for a single habit. */
export async function getHabitMonth(userId: string, habitId: string, reference = new Date()) {
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId },
    select: { id: true, targetCount: true },
  });
  if (!habit) throw new NotFoundError('Habit');

  const range = monthRange(reference);
  const logs = await prisma.habitLog.findMany({
    where: {
      habitId: habit.id,
      date: { gte: toUtcDateOnly(range.start), lte: toUtcDateOnly(range.end) },
    },
    select: { date: true, count: true },
  });

  return {
    targetCount: habit.targetCount,
    counts: Object.fromEntries(logs.map((log) => [toUtcDayKey(log.date), log.count])),
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function decorate(habit: Habit, logs: readonly HabitLog[]): HabitWithStats {
  const today = toDayKey(new Date());
  const entries = logs.map((log) => ({ dayKey: toUtcDayKey(log.date), count: log.count }));
  const streak = calculateStreak(qualifyingDayKeys(entries, habit.targetCount), today);

  const window = trailingDayRange(HABIT_HISTORY_DAYS);
  const windowKeys = eachDay(window.start, window.end);
  const countsByDay = new Map(entries.map((entry) => [entry.dayKey, entry.count]));

  const history: Record<DayKey, number> = {};
  let met = 0;
  const createdKey = toDayKey(habit.createdAt);
  let expected = 0;
  for (const dayKey of windowKeys) {
    const count = countsByDay.get(dayKey) ?? 0;
    history[dayKey] = count;
    if (dayKey >= createdKey) {
      expected += 1;
      if (count >= habit.targetCount) met += 1;
    }
  }

  const todayCount = countsByDay.get(today) ?? 0;
  return {
    ...habit,
    streak,
    history,
    todayCount,
    completedToday: todayCount >= habit.targetCount,
    completionRate: expected === 0 ? 0 : Math.round((met / expected) * 100),
  };
}

function eachDay(start: Date, end: Date): DayKey[] {
  const keys: DayKey[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    keys.push(toDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}
