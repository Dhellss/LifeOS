import type { Metadata } from 'next';
import { BarChart3, CheckSquare, Clock, Zap } from 'lucide-react';

import { BarChartCard } from '@/components/analytics/bar-chart-card';
import { DonutChartCard } from '@/components/analytics/donut-chart-card';
import {
  ANALYTICS_RANGES,
  RangeSelector,
  type AnalyticsRange,
} from '@/components/analytics/range-selector';
import { TrendChart } from '@/components/analytics/trend-chart';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/components/calendar/event-type';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { formatDayTick } from '@/lib/dates';
import { getAnalyticsOverview } from '@/lib/services/analytics';
import { requireUser } from '@/lib/session';
import { formatMinutes, formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'Analytics' };

const XP_TYPE_LABELS: Record<string, string> = {
  TASK_COMPLETED: 'Tasks',
  PROJECT_COMPLETED: 'Projects',
  HABIT_CHECKIN: 'Habits',
  STUDY_SESSION: 'Study',
  WORKOUT_LOGGED: 'Workouts',
  JOURNAL_ENTRY: 'Journal',
  ACHIEVEMENT_UNLOCKED: 'Achievements',
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  // Anything outside the allowed set falls back to the default rather than
  // becoming an arbitrary window the charts were not sized for.
  const requested = Number(typeof params.range === 'string' ? params.range : 30);
  const rangeDays: AnalyticsRange = (ANALYTICS_RANGES as readonly number[]).includes(requested)
    ? (requested as AnalyticsRange)
    : 30;

  const data = await getAnalyticsOverview(user.id, rangeDays);

  const tasksCompletedInRange = data.tasksCompletedByDay.reduce(
    (total, point) => total + point.value,
    0,
  );
  const studyMinutesInRange = data.studyMinutesByDay.reduce((total, row) => total + row.minutes, 0);
  const xpInRange = data.xpByDay.reduce((total, point) => total + point.value, 0);
  const habitAverage =
    data.habitCompletionByDay.length === 0
      ? 0
      : Math.round(
          data.habitCompletionByDay.reduce((total, row) => total + row.rate, 0) /
            data.habitCompletionByDay.length,
        );

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Aggregates computed from your own records — no estimates, no placeholders."
        actions={<RangeSelector current={rangeDays} />}
      />

      <section aria-label="Range summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Tasks completed (${rangeDays}d)`}
          value={tasksCompletedInRange}
          hint={`${data.tasks.completionRate}% all-time completion rate`}
          icon={CheckSquare}
        />
        <StatCard
          label={`Study time (${rangeDays}d)`}
          value={formatMinutes(studyMinutesInRange)}
          hint={`${formatMinutes(data.study.totalMinutes)} all time`}
          icon={Clock}
        />
        <StatCard
          label={`XP earned (${rangeDays}d)`}
          value={formatNumber(xpInRange)}
          hint={`Level ${data.level.level} · ${formatNumber(data.level.totalXP)} XP total`}
          icon={Zap}
        />
        <StatCard
          label="Habit completion"
          value={`${habitAverage}%`}
          hint={`Average across the last ${rangeDays} days`}
          icon={BarChart3}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          title="Tasks completed over time"
          description={`Daily totals, last ${rangeDays} days`}
          data={data.tasksCompletedByDay}
          seriesName="Tasks"
          colorToken={1}
        />
        <TrendChart
          title="XP growth"
          description="Cumulative XP"
          data={data.xpCumulative}
          seriesName="Total XP"
          variant="line"
          colorToken={3}
        />
        <BarChartCard
          title="Study minutes per day"
          description={`Last ${rangeDays} days`}
          data={data.studyMinutesByDay.map((row) => ({
            label: formatDayTick(row.dayKey),
            value: row.minutes,
          }))}
          seriesName="Minutes"
          unit=" min"
          colorToken={2}
        />
        <TrendChart
          title="Habit completion rate"
          description="Share of active habits hitting their target each day"
          data={data.habitCompletionByDay.map((row) => ({ dayKey: row.dayKey, value: row.rate }))}
          seriesName="Completion"
          unit="%"
          colorToken={4}
        />
        <BarChartCard
          title="Workout frequency"
          description="Workouts per week"
          data={data.workoutsByWeek.map((row) => ({
            label: formatDayTick(row.weekStart),
            value: row.count,
          }))}
          seriesName="Workouts"
          colorToken={2}
        />
        <BarChartCard
          title="Study by subject"
          description="All-time minutes"
          data={data.studyBySubject.slice(0, 8).map((row) => ({
            label: row.subject,
            value: row.minutes,
          }))}
          seriesName="Minutes"
          unit=" min"
          layout="horizontal"
          multicolor
        />
        <DonutChartCard
          title="XP by source"
          description="Where your XP came from"
          data={data.xpByType.map((row) => ({
            label: XP_TYPE_LABELS[row.type] ?? row.type,
            value: row.points,
          }))}
          unit=" XP"
        />
        <DonutChartCard
          title="Project status"
          description="All projects by status"
          data={[
            { label: 'Active', value: data.projects.active, color: 'hsl(var(--chart-1))' },
            { label: 'Paused', value: data.projects.paused, color: 'hsl(var(--chart-3))' },
            { label: 'Completed', value: data.projects.completed, color: 'hsl(var(--chart-2))' },
            {
              label: 'Archived',
              value: data.projects.archived,
              color: 'hsl(var(--muted-foreground))',
            },
          ]}
        />
        <DonutChartCard
          title="Events by type"
          description="All calendar events"
          data={data.eventsByType.map((row) => ({
            label: EVENT_TYPE_LABELS[row.type as keyof typeof EVENT_TYPE_LABELS] ?? row.type,
            value: row.count,
            color: EVENT_TYPE_COLORS[row.type as keyof typeof EVENT_TYPE_COLORS],
          }))}
        />
        <TrendChart
          title="Journal entries"
          description={`Entries per day, last ${rangeDays} days`}
          data={data.journalByDay}
          seriesName="Entries"
          variant="line"
          colorToken={5}
        />
      </div>
    </>
  );
}
