import type { Metadata } from 'next';
import { Activity, Clock, Dumbbell, Plus } from 'lucide-react';

import { BarChartCard } from '@/components/analytics/bar-chart-card';

import { WorkoutDialog } from '@/components/fitness/workout-dialog';
import { WorkoutList } from '@/components/fitness/workout-list';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDayTick } from '@/lib/dates';
import {
  getExerciseHistory,
  getFitnessSummary,
  getWorkoutsByWeek,
  listWorkouts,
} from '@/lib/services/fitness';
import { getPreferences } from '@/lib/services/preferences';
import { requireUser } from '@/lib/session';
import { formatMinutes, formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'Fitness' };

export default async function FitnessPage() {
  const user = await requireUser();
  const [workouts, summary, byWeek, exercises, preferences] = await Promise.all([
    listWorkouts(user.id, { limit: 25 }),
    getFitnessSummary(user.id),
    getWorkoutsByWeek(user.id, 12),
    getExerciseHistory(user.id),
    getPreferences(user.id),
  ]);

  return (
    <>
      <PageHeader
        title="Fitness"
        description="Log workouts with their exercises. Sets, reps and weights build your history."
        actions={
          <WorkoutDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4" />
                Log workout
              </Button>
            }
          />
        }
      />

      <section aria-label="Fitness summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="This week"
          value={summary.weekCount}
          hint={`Goal ${preferences.weeklyWorkoutGoal} · ${formatMinutes(summary.weekMinutes)}`}
          icon={Dumbbell}
        />
        <StatCard
          label="All workouts"
          value={summary.totalCount}
          hint={formatMinutes(summary.totalMinutes)}
        />
        <StatCard
          label="Average session"
          value={formatMinutes(summary.averageDurationMinutes)}
          icon={Clock}
        />
        <StatCard
          label="Total volume"
          value={formatNumber(summary.totalVolume)}
          hint="sets × reps"
          icon={Activity}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChartCard
          title="Workouts per week"
          description="Last 12 weeks"
          data={byWeek.map((row) => ({ label: formatDayTick(row.weekStart), value: row.count }))}
          seriesName="Workouts"
          colorToken={2}
        />

        <Card>
          <CardHeader>
            <CardTitle>Exercise history</CardTitle>
          </CardHeader>
          <CardContent>
            {exercises.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No exercises recorded"
                description="Add exercises to a workout and they will be tracked here."
              />
            ) : (
              <div className="scrollbar-thin max-h-56 overflow-y-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Exercises by frequency</caption>
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-xs text-muted-foreground">
                      <th scope="col" className="py-2 text-left font-medium">
                        Exercise
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Sessions
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Sets
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Best
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {exercises.map((exercise) => (
                      <tr key={exercise.name} className="border-t border-border/60">
                        <td className="py-2 pr-2">{exercise.name}</td>
                        <td className="tabular py-2 text-right">{exercise.occurrences}</td>
                        <td className="tabular py-2 text-right">{exercise.totalSets}</td>
                        <td className="tabular py-2 text-right">
                          {exercise.maxWeight === null ? '—' : `${exercise.maxWeight} kg`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Recent workouts</h2>
        <WorkoutList
          workouts={workouts}
          emptyAction={
            <WorkoutDialog
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Log your first workout
                </Button>
              }
            />
          }
        />
      </section>
    </>
  );
}
