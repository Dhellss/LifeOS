import type { Metadata } from 'next';
import { Flame, Plus, Repeat } from 'lucide-react';

import { HabitCard } from '@/components/habits/habit-card';
import { HabitDialog } from '@/components/habits/habit-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { toDayKey } from '@/lib/dates';
import { getHabitSummary, listHabits } from '@/lib/services/habits';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Habits' };

export default async function HabitsPage() {
  const user = await requireUser();
  const [habits, summary] = await Promise.all([
    listHabits(user.id, { includeInactive: true }),
    getHabitSummary(user.id),
  ]);

  const todayKey = toDayKey(new Date());
  const active = habits.filter((habit) => habit.isActive);
  const archived = habits.filter((habit) => !habit.isActive);

  return (
    <>
      <PageHeader
        title="Habits"
        description="Check in daily. Streaks only count days that reach the habit's target."
        actions={
          <HabitDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4" />
                New habit
              </Button>
            }
          />
        }
      />

      <section aria-label="Habit summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active habits" value={summary.activeHabits} icon={Repeat} />
        <StatCard
          label="Done today"
          value={`${summary.completedToday}/${summary.activeHabits}`}
          hint={`${summary.todayCompletionRate}% of today`}
        />
        <StatCard label="Longest streak" value={summary.longestStreak} icon={Flame} hint="days" />
        <StatCard label="Archived" value={archived.length} />
      </section>

      {habits.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No habits yet"
          description="Pick one small thing you want to do consistently. Streaks and XP follow from there."
          action={
            <HabitDialog
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Create your first habit
                </Button>
              }
            />
          }
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((habit) => (
              <li key={habit.id}>
                <HabitCard habit={habit} todayKey={todayKey} />
              </li>
            ))}
          </ul>

          {archived.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Archived</h2>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {archived.map((habit) => (
                  <li key={habit.id}>
                    <HabitCard habit={habit} todayKey={todayKey} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
