import type { Metadata } from 'next';
import { BookOpen, Clock, Plus, Target } from 'lucide-react';

import { BarChartCard } from '@/components/analytics/bar-chart-card';
import { DonutChartCard } from '@/components/analytics/donut-chart-card';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StudyDialog } from '@/components/study/study-dialog';
import { StudySessionList } from '@/components/study/study-session-list';
import { Button } from '@/components/ui/button';

import { formatDayTick } from '@/lib/dates';
import { getPreferences } from '@/lib/services/preferences';
import {
  getStudyByDay,
  getStudyBySubject,
  getStudySubjects,
  getStudySummary,
  listStudySessions,
} from '@/lib/services/study';
import { requireUser } from '@/lib/session';
import { formatMinutes, percentage } from '@/lib/utils';

export const metadata: Metadata = { title: 'Study' };

export default async function StudyPage() {
  const user = await requireUser();
  const [sessions, summary, byDay, bySubject, subjects, preferences] = await Promise.all([
    listStudySessions(user.id, { limit: 40 }),
    getStudySummary(user.id),
    getStudyByDay(user.id, 14),
    getStudyBySubject(user.id),
    getStudySubjects(user.id),
    getPreferences(user.id),
  ]);

  const createTrigger = (
    <Button>
      <Plus className="h-4 w-4" />
      Log session
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Study"
        description="Log what you studied, for how long, and see where your hours actually go."
        actions={<StudyDialog subjects={subjects} trigger={createTrigger} />}
      />

      <section aria-label="Study summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today" value={formatMinutes(summary.todayMinutes)} icon={Clock} />
        <StatCard
          label="This week"
          value={formatMinutes(summary.weekMinutes)}
          hint={`${percentage(summary.weekMinutes, preferences.weeklyStudyGoal)}% of your ${formatMinutes(preferences.weeklyStudyGoal)} goal`}
          icon={Target}
        />
        <StatCard label="This month" value={formatMinutes(summary.monthMinutes)} />
        <StatCard
          label="All time"
          value={formatMinutes(summary.totalMinutes)}
          hint={`${summary.sessionCount} sessions · avg ${formatMinutes(summary.averageSessionMinutes)}`}
          icon={BookOpen}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChartCard
          title="Minutes per day"
          description="Last 14 days"
          data={byDay.map((row) => ({ label: formatDayTick(row.dayKey), value: row.minutes }))}
          seriesName="Minutes"
          unit=" min"
          colorToken={2}
        />
        <DonutChartCard
          title="Subject breakdown"
          description="All-time minutes by subject"
          data={bySubject.map((row) => ({ label: row.subject, value: row.minutes }))}
          unit=" min"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Recent sessions</h2>
        <StudySessionList
          sessions={sessions}
          subjects={subjects}
          emptyAction={
            <StudyDialog
              subjects={subjects}
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Log your first session
                </Button>
              }
            />
          }
        />
      </section>
    </>
  );
}
