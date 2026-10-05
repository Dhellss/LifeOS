import {
  ACHIEVEMENTS,
  achievementProgress,
  evaluateAchievements,
  getAchievement,
  type AchievementDefinition,
  type AchievementStats,
} from '@/lib/achievements';
import { prisma } from '@/lib/db';
import { toUtcDayKey } from '@/lib/dates';
import { calculateStreak, qualifyingDayKeys } from '@/lib/streaks';
import { levelFromXP } from '@/lib/xp';

import { awardXP, getTotalXP } from './xp';
import { achievementAward } from '@/lib/xp';

/**
 * Achievement evaluation.
 *
 * `syncAchievements` is called after every XP-bearing action. It recomputes the
 * user's metric snapshot, diffs it against the rows already in
 * `UserAchievement`, and persists anything newly earned. The unique
 * `(userId, achievementKey)` index makes concurrent calls safe.
 */

export async function collectAchievementStats(userId: string): Promise<AchievementStats> {
  const today = toUtcDayKey(new Date());

  const [
    tasksCompleted,
    projectsCompleted,
    studyAggregate,
    workouts,
    journalEntries,
    habits,
    journalDays,
    totalXP,
  ] = await Promise.all([
    prisma.task.count({ where: { userId, status: 'DONE' } }),
    prisma.project.count({ where: { userId, status: 'COMPLETED' } }),
    prisma.studySession.aggregate({
      where: { userId },
      _count: { _all: true },
      _sum: { durationMinutes: true },
    }),
    prisma.workout.count({ where: { userId } }),
    prisma.journalEntry.count({ where: { userId } }),
    prisma.habit.findMany({
      where: { userId },
      select: {
        targetCount: true,
        logs: { select: { date: true, count: true } },
      },
    }),
    prisma.journalEntry.findMany({ where: { userId }, select: { entryDate: true } }),
    getTotalXP(userId),
  ]);

  const longestHabitStreak = habits.reduce((longest, habit) => {
    const days = qualifyingDayKeys(
      habit.logs.map((log) => ({ dayKey: toUtcDayKey(log.date), count: log.count })),
      habit.targetCount,
    );
    return Math.max(longest, calculateStreak(days, today).longest);
  }, 0);

  const longestJournalStreak = calculateStreak(
    journalDays.map((entry) => toUtcDayKey(entry.entryDate)),
    today,
  ).longest;

  return {
    tasksCompleted,
    projectsCompleted,
    longestHabitStreak,
    studySessions: studyAggregate._count._all,
    studyMinutes: studyAggregate._sum.durationMinutes ?? 0,
    workouts,
    journalEntries,
    longestJournalStreak,
    level: levelFromXP(totalXP),
  };
}

/**
 * Recompute and persist newly earned achievements.
 * Returns the definitions unlocked by this call (empty when nothing changed).
 */
export async function syncAchievements(userId: string): Promise<AchievementDefinition[]> {
  const [stats, existing] = await Promise.all([
    collectAchievementStats(userId),
    prisma.userAchievement.findMany({ where: { userId }, select: { achievementKey: true } }),
  ]);

  const newlyEarned = evaluateAchievements(
    stats,
    existing.map((row) => row.achievementKey),
  );
  if (newlyEarned.length === 0) return [];

  const created = await prisma.userAchievement.createMany({
    data: newlyEarned.map((achievement) => ({ userId, achievementKey: achievement.key })),
    skipDuplicates: true,
  });
  if (created.count === 0) return [];

  // Unlocking an achievement is itself an XP-bearing action.
  for (const achievement of newlyEarned) {
    await awardXP(userId, achievementAward(achievement));
  }

  return newlyEarned;
}

export interface AchievementView extends AchievementDefinition {
  unlocked: boolean;
  unlockedAt: Date | null;
  progress: number;
  currentValue: number;
}

/** The full catalogue annotated with this user's unlock state and progress. */
export async function listAchievements(userId: string): Promise<{
  achievements: AchievementView[];
  stats: AchievementStats;
  unlockedCount: number;
}> {
  const [stats, rows] = await Promise.all([
    collectAchievementStats(userId),
    prisma.userAchievement.findMany({ where: { userId } }),
  ]);

  const unlockedAt = new Map(rows.map((row) => [row.achievementKey, row.unlockedAt]));

  const achievements = ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    unlocked: unlockedAt.has(achievement.key),
    unlockedAt: unlockedAt.get(achievement.key) ?? null,
    progress: achievementProgress(achievement, stats),
    currentValue: stats[achievement.metric],
  }));

  return { achievements, stats, unlockedCount: unlockedAt.size };
}

/** Most recently unlocked achievements, for the dashboard activity feed. */
export async function getRecentAchievements(userId: string, limit = 5) {
  const rows = await prisma.userAchievement.findMany({
    where: { userId },
    orderBy: { unlockedAt: 'desc' },
    take: limit,
  });
  return rows.flatMap((row) => {
    const definition = getAchievement(row.achievementKey);
    return definition ? [{ ...definition, unlockedAt: row.unlockedAt }] : [];
  });
}
