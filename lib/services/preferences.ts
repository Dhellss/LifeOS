import { prisma } from '@/lib/db';
import { preferencesUpdateSchema } from '@/lib/validations/settings';

import { parseOrThrow } from './validate';

/**
 * User preferences.
 *
 * Rows are created lazily: the first read for a user inserts the defaults so
 * the rest of the app can treat preferences as always present.
 */

export interface Preferences {
  timezone: string;
  weekStartsOn: number;
  dailyTaskGoal: number;
  weeklyStudyGoal: number;
  weeklyWorkoutGoal: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  timezone: 'UTC',
  weekStartsOn: 1,
  dailyTaskGoal: 5,
  weeklyStudyGoal: 600,
  weeklyWorkoutGoal: 3,
};

/**
 * Create the row if it is missing, then read it.
 *
 * `upsert` is not atomic here: Prisma issues a read followed by a create, so
 * two concurrent callers both see "missing" and the second one violates the
 * unique index on `userId`. That is not hypothetical - a fresh account's first
 * dashboard load fans out several parallel reads, more than one of which wants
 * preferences, and the loser of the race turned the whole page into a 500.
 *
 * `createMany` with `skipDuplicates` is a single statement that lets the index
 * settle the race, so the duplicate insert is an ordinary no-op.
 */
async function ensureRow(userId: string) {
  await prisma.userPreferences.createMany({
    data: [{ userId, ...DEFAULT_PREFERENCES }],
    skipDuplicates: true,
  });
  return prisma.userPreferences.findUniqueOrThrow({ where: { userId } });
}

function toPreferences(row: {
  timezone: string;
  weekStartsOn: number;
  dailyTaskGoal: number;
  weeklyStudyGoal: number;
  weeklyWorkoutGoal: number;
}): Preferences {
  return {
    timezone: row.timezone,
    weekStartsOn: row.weekStartsOn,
    dailyTaskGoal: row.dailyTaskGoal,
    weeklyStudyGoal: row.weeklyStudyGoal,
    weeklyWorkoutGoal: row.weeklyWorkoutGoal,
  };
}

export async function getPreferences(userId: string): Promise<Preferences> {
  return toPreferences(await ensureRow(userId));
}

export async function updatePreferences(userId: string, input: unknown): Promise<Preferences> {
  const data = parseOrThrow(preferencesUpdateSchema, input);
  await ensureRow(userId);
  return toPreferences(await prisma.userPreferences.update({ where: { userId }, data }));
}

/** Aggregate row counts used by the settings page's data summary. */
export async function getAccountDataSummary(userId: string) {
  const [
    tasks,
    projects,
    habits,
    habitLogs,
    studySessions,
    workouts,
    events,
    journalEntries,
    xpEvents,
    achievements,
  ] = await Promise.all([
    prisma.task.count({ where: { userId } }),
    prisma.project.count({ where: { userId } }),
    prisma.habit.count({ where: { userId } }),
    prisma.habitLog.count({ where: { userId } }),
    prisma.studySession.count({ where: { userId } }),
    prisma.workout.count({ where: { userId } }),
    prisma.calendarEvent.count({ where: { userId } }),
    prisma.journalEntry.count({ where: { userId } }),
    prisma.xPEvent.count({ where: { userId } }),
    prisma.userAchievement.count({ where: { userId } }),
  ]);

  return {
    tasks,
    projects,
    habits,
    habitLogs,
    studySessions,
    workouts,
    events,
    journalEntries,
    xpEvents,
    achievements,
  };
}
