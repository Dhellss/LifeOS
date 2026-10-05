import type { CalendarEvent, JournalEntry } from '@prisma/client';

import { prisma } from '@/lib/db';
import { dayRange, toDayKey, trailingDayRange } from '@/lib/dates';
import { fillDailySeries, type SeriesPoint } from '@/lib/series';
import type { LevelProgress } from '@/lib/xp';

import { getRecentAchievements } from './achievements';

import { getUpcomingEvents } from './calendar';
import { getFitnessSummary, type FitnessSummary } from './fitness';
import { getHabitSummary, listHabits, type HabitSummary, type HabitWithStats } from './habits';
import { getRecentJournalEntries } from './journal';
import { getActiveProjects, type ProjectWithProgress } from './projects';
import { getStudySummary, type StudySummary } from './study';
import {
  getOverdueTasks,
  getTaskStats,
  getTasksDueBetween,
  type TaskStats,
  type TaskWithProject,
} from './tasks';
import { getLevelProgress, getRecentXPEvents, type XPEventSummary } from './xp';
import { getPreferences, type Preferences } from './preferences';

/**
 * Dashboard aggregation.
 *
 * One call assembles everything the `/dashboard` route renders, so the page
 * component contains no queries of its own and the whole payload is fetched in
 * a single round of parallel reads.
 */

export interface DashboardData {
  today: Date;
  preferences: Preferences;
  level: LevelProgress;
  tasks: {
    stats: TaskStats;
    dueToday: TaskWithProject[];
    overdue: TaskWithProject[];
    completedToday: number;
  };
  projects: {
    active: ProjectWithProgress[];
    activeCount: number;
  };
  habits: {
    summary: HabitSummary;
    items: HabitWithStats[];
  };
  study: StudySummary;
  fitness: FitnessSummary;
  upcomingEvents: CalendarEvent[];
  recentJournal: JournalEntry[];
  recentXP: XPEventSummary[];
  recentAchievements: Awaited<ReturnType<typeof getRecentAchievements>>;
  /** Tasks completed per day over the trailing two weeks. */
  taskTrend: SeriesPoint[];
  /** Study minutes per day over the trailing two weeks. */
  studyTrend: SeriesPoint[];
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const now = new Date();
  const today = dayRange(now);
  const trend = trailingDayRange(14, now);

  const [
    preferences,
    level,
    taskStats,
    dueToday,
    overdue,
    completedToday,
    activeProjects,
    activeProjectCount,
    habitSummary,
    habits,
    study,
    fitness,
    upcomingEvents,
    recentJournal,
    recentXP,
    recentAchievements,
    completedTrendRows,
    studyTrendRows,
  ] = await Promise.all([
    getPreferences(userId),
    getLevelProgress(userId),
    getTaskStats(userId),
    getTasksDueBetween(userId, today),
    getOverdueTasks(userId, today.start),
    prisma.task.count({
      where: { userId, status: 'DONE', completedAt: { gte: today.start, lte: today.end } },
    }),
    getActiveProjects(userId, 4),
    prisma.project.count({ where: { userId, status: 'ACTIVE' } }),
    getHabitSummary(userId),
    listHabits(userId),
    getStudySummary(userId),
    getFitnessSummary(userId),
    getUpcomingEvents(userId, 5),
    getRecentJournalEntries(userId, 3),
    getRecentXPEvents(userId, 8),
    getRecentAchievements(userId, 4),
    prisma.task.findMany({
      where: { userId, status: 'DONE', completedAt: { gte: trend.start, lte: trend.end } },
      select: { completedAt: true },
    }),
    prisma.studySession.findMany({
      where: { userId, sessionDate: { gte: trend.start, lte: trend.end } },
      select: { sessionDate: true, durationMinutes: true },
    }),
  ]);

  return {
    today: now,
    preferences,
    level,
    tasks: {
      stats: taskStats,
      dueToday,
      overdue,
      completedToday,
    },
    projects: { active: activeProjects, activeCount: activeProjectCount },
    habits: { summary: habitSummary, items: habits },
    study,
    fitness,
    upcomingEvents,
    recentJournal,
    recentXP,
    recentAchievements,
    taskTrend: fillDailySeries(
      trend,
      completedTrendRows.flatMap((row) =>
        row.completedAt ? [{ date: row.completedAt, value: 1 }] : [],
      ),
    ),
    studyTrend: fillDailySeries(
      trend,
      studyTrendRows.map((row) => ({ date: row.sessionDate, value: row.durationMinutes })),
    ),
  };
}

/** `yyyy-MM-dd` for today, handy for default form values. */
export function todayKey(): string {
  return toDayKey(new Date());
}
