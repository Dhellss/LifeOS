import { prisma } from '@/lib/db';
import { trailingDayRange, type DayKey } from '@/lib/dates';
import { fillDailySeries, offsetCumulative, sumSeries, type SeriesPoint } from '@/lib/series';
import { levelProgress, type LevelProgress } from '@/lib/xp';

import { getEventCountsByType } from './calendar';
import { getHabitCompletionByDay } from './habits';
import { getProjectStats, type ProjectStats } from './projects';
import { getStudyByDay, getStudyBySubject, getStudySummary, type StudySummary } from './study';
import { getFitnessSummary, getWorkoutsByWeek, type FitnessSummary } from './fitness';
import { getTaskStats, type TaskStats } from './tasks';
import { getTotalXP, getXPByDay, getXPByType } from './xp';

/**
 * Analytics service.
 *
 * Every number here comes from a real aggregate query against the signed-in
 * user's rows. Series are zero-filled server-side so the chart components can
 * render straight from the payload without gap handling.
 */

export interface AnalyticsOverview {
  rangeDays: number;
  tasks: TaskStats;
  projects: ProjectStats;
  study: StudySummary;
  fitness: FitnessSummary;
  level: LevelProgress;
  tasksCompletedByDay: SeriesPoint[];
  studyMinutesByDay: { dayKey: DayKey; minutes: number }[];
  studyBySubject: { subject: string; minutes: number; sessions: number }[];
  habitCompletionByDay: { dayKey: DayKey; completed: number; target: number; rate: number }[];
  workoutsByWeek: { weekStart: DayKey; count: number; minutes: number }[];
  xpByDay: SeriesPoint[];
  xpCumulative: SeriesPoint[];
  xpByType: { type: string; points: number }[];
  eventsByType: { type: string; count: number }[];
  journalByDay: SeriesPoint[];
}

export async function getAnalyticsOverview(
  userId: string,
  rangeDays = 30,
): Promise<AnalyticsOverview> {
  const range = trailingDayRange(rangeDays);

  const [
    tasks,
    projects,
    study,
    fitness,
    totalXP,
    completedTasks,
    studyMinutesByDay,
    studyBySubject,
    habitRows,
    workoutsByWeek,
    xpRows,
    xpByType,
    eventsByType,
    journalRows,
  ] = await Promise.all([
    getTaskStats(userId),
    getProjectStats(userId),
    getStudySummary(userId),
    getFitnessSummary(userId),
    getTotalXP(userId),
    prisma.task.findMany({
      where: { userId, status: 'DONE', completedAt: { gte: range.start, lte: range.end } },
      select: { completedAt: true },
    }),
    getStudyByDay(userId, rangeDays),
    getStudyBySubject(userId),
    getHabitCompletionByDay(userId, rangeDays),
    getWorkoutsByWeek(userId, Math.max(4, Math.ceil(rangeDays / 7))),
    getXPByDay(userId, range),
    getXPByType(userId),
    getEventCountsByType(userId),
    prisma.journalEntry.findMany({
      where: { userId, entryDate: { gte: range.start, lte: range.end } },
      select: { entryDate: true },
    }),
  ]);

  const tasksCompletedByDay = fillDailySeries(
    range,
    completedTasks.flatMap((task) =>
      task.completedAt ? [{ date: task.completedAt, value: 1 }] : [],
    ),
  );

  const xpByDay = fillDailySeries(
    range,
    xpRows.map((row) => ({ date: row.createdAt, value: row.points })),
  );

  const journalByDay = fillDailySeries(
    range,
    journalRows.map((row) => ({ date: row.entryDate, value: 1 })),
  );

  return {
    rangeDays,
    tasks,
    projects,
    study,
    fitness,
    level: levelProgress(totalXP),
    tasksCompletedByDay,
    studyMinutesByDay,
    studyBySubject,
    habitCompletionByDay: habitRows.map((row) => ({
      ...row,
      rate: row.target === 0 ? 0 : Math.round((row.completed / row.target) * 100),
    })),
    workoutsByWeek,
    xpByDay,
    // The cumulative line starts from the XP already earned before the window,
    // so the curve reflects the real total rather than restarting at zero.
    xpCumulative: offsetCumulative(xpByDay, totalXP - sumSeries(xpByDay)),
    xpByType,
    eventsByType,
    journalByDay,
  };
}
