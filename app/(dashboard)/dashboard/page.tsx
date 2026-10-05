import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, BookOpen, CheckSquare, Dumbbell, Plus, Target } from 'lucide-react';

import { TrendChart } from '@/components/analytics/trend-chart';
import {
  ActiveProjectsCard,
  ActivityCard,
  HabitStreakCard,
  LevelCard,
  UpcomingEventsCard,
  WellbeingCard,
} from '@/components/dashboard/dashboard-cards';
import { Greeting } from '@/components/dashboard/greeting';
import { StatCard } from '@/components/shared/stat-card';
import { TaskDialog } from '@/components/tasks/task-dialog';
import { TaskList } from '@/components/tasks/task-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboardData } from '@/lib/services/dashboard';
import { getProjectOptions } from '@/lib/services/projects';
import { requireUser } from '@/lib/session';
import { formatMinutes } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const user = await requireUser();
  const [data, projectOptions] = await Promise.all([
    getDashboardData(user.id),
    getProjectOptions(user.id),
  ]);

  const { tasks, projects, habits, study, fitness, preferences } = data;
  const dailyGoalProgress =
    preferences.dailyTaskGoal === 0
      ? 0
      : Math.min(100, Math.round((tasks.completedToday / preferences.dailyTaskGoal) * 100));

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Greeting name={user.name} />
        <TaskDialog
          projectOptions={projectOptions}
          trigger={
            <Button>
              <Plus className="h-4 w-4" />
              New task
            </Button>
          }
        />
      </div>

      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Completed today"
          value={tasks.completedToday}
          hint={`${dailyGoalProgress}% of your goal of ${preferences.dailyTaskGoal}`}
          icon={Target}
        />
        <StatCard
          label="Task completion rate"
          value={`${tasks.stats.completionRate}%`}
          hint={`${tasks.stats.done} of ${tasks.stats.done + tasks.stats.todo + tasks.stats.inProgress} tracked`}
          icon={CheckSquare}
        />
        <StatCard
          label="Study this week"
          value={formatMinutes(study.weekMinutes)}
          hint={`Goal ${formatMinutes(preferences.weeklyStudyGoal)}`}
          icon={BookOpen}
        />
        <StatCard
          label="Workouts this week"
          value={fitness.weekCount}
          hint={`Goal ${preferences.weeklyWorkoutGoal} per week`}
          icon={Dumbbell}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
                Due today
                <span className="tabular text-sm font-normal text-muted-foreground">
                  {tasks.dueToday.length}
                </span>
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/tasks">All tasks</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <TaskList
                tasks={tasks.dueToday}
                projectOptions={projectOptions}
                emptyTitle="Nothing due today"
                emptyDescription="Either you are ahead, or nothing has a due date yet."
                emptyAction={
                  <TaskDialog
                    projectOptions={projectOptions}
                    trigger={
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4" />
                        Add a task
                      </Button>
                    }
                  />
                }
              />
            </CardContent>
          </Card>

          {tasks.overdue.length > 0 ? (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Overdue
                  <span className="tabular text-sm font-normal">{tasks.overdue.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TaskList tasks={tasks.overdue.slice(0, 5)} projectOptions={projectOptions} />
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <TrendChart
              title="Tasks completed"
              description="Last 14 days"
              data={data.taskTrend}
              seriesName="Tasks"
              colorToken={1}
              height={200}
            />
            <TrendChart
              title="Study minutes"
              description="Last 14 days"
              data={data.studyTrend}
              seriesName="Minutes"
              colorToken={2}
              unit=" min"
              height={200}
            />
          </div>

          <ActiveProjectsCard active={projects.active} activeCount={projects.activeCount} />
        </div>

        <div className="space-y-4">
          <LevelCard level={data.level} />
          <HabitStreakCard summary={habits.summary} items={habits.items} />
          <UpcomingEventsCard events={data.upcomingEvents} />
          <WellbeingCard study={study} fitness={fitness} recentJournal={data.recentJournal} />
          <ActivityCard recentXP={data.recentXP} recentAchievements={data.recentAchievements} />
        </div>
      </div>
    </>
  );
}
