import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Flame,
  FolderKanban,
  NotebookPen,
  Repeat,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { MoodBadge } from '@/components/journal/mood';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/components/calendar/event-type';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatMinutes, formatNumber, truncate } from '@/lib/utils';
import type { DashboardData } from '@/lib/services/dashboard';

/** Active projects with their derived progress bars. */
export function ActiveProjectsCard({ active, activeCount }: DashboardData['projects']) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
          Active projects
          {activeCount > active.length ? <Badge variant="muted">{activeCount}</Badge> : null}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">
            All
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {active.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No active projects"
            description="Group related tasks into a project to track progress toward something bigger."
            action={
              <Button size="sm" asChild>
                <Link href="/projects">Create a project</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-4">
            {active.map((project) => (
              <li key={project.id} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex min-w-0 items-center gap-2 text-sm font-medium hover:underline"
                  >
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color ?? 'hsl(var(--primary))' }}
                    />
                    <span className="truncate">{project.name}</span>
                  </Link>
                  <span className="tabular shrink-0 text-xs text-muted-foreground">
                    {project.progress.completed}/{project.progress.total} ·{' '}
                    {project.progress.percent}%
                  </span>
                </div>
                <Progress
                  value={project.progress.percent}
                  aria-label={`${project.name} progress`}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Habit streak summary with today's check-in state per habit. */
export function HabitStreakCard({ summary, items }: DashboardData['habits']) {
  const top = [...items].sort((a, b) => b.streak.current - a.streak.current).slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-muted-foreground" />
          Habits
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/habits">
            Check in
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="No habits yet"
            description="Add a habit to start building streaks you can actually see."
            action={
              <Button size="sm" asChild>
                <Link href="/habits">Create a habit</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <p className="tabular text-2xl font-semibold">
                {summary.completedToday}
                <span className="text-base font-normal text-muted-foreground">
                  /{summary.activeHabits}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">done today</p>
            </div>
            <Progress value={summary.todayCompletionRate} aria-label="Habits completed today" />
            <ul className="space-y-1.5">
              {top.map((habit) => (
                <li key={habit.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: habit.color ?? 'hsl(var(--chart-2))' }}
                    />
                    <span className="truncate">{habit.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs">
                    {habit.completedToday ? <Badge variant="success">Today</Badge> : null}
                    <span className="tabular inline-flex items-center gap-0.5 text-muted-foreground">
                      <Flame className="h-3 w-3" />
                      {habit.streak.current}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Next five events, colour-coded by type. */
export function UpcomingEventsCard({ events }: { events: DashboardData['upcomingEvents'] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          Upcoming
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/calendar">
            Calendar
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nothing scheduled"
            description="Add lectures, deadlines or sessions so they show up here."
            action={
              <Button size="sm" asChild>
                <Link href="/calendar">Add an event</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-1 h-full w-0.5 shrink-0 rounded-full"
                  style={{ backgroundColor: EVENT_TYPE_COLORS[event.type] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.startTime).toLocaleDateString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                    {event.allDay
                      ? ' · all day'
                      : ` · ${new Date(event.startTime).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`}
                    {' · '}
                    {EVENT_TYPE_LABELS[event.type]}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Recent XP events and achievement unlocks. */
export function ActivityCard({
  recentXP,
  recentAchievements,
}: Pick<DashboardData, 'recentXP' | 'recentAchievements'>) {
  const hasActivity = recentXP.length > 0 || recentAchievements.length > 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          Recent activity
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/achievements">
            Achievements
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {!hasActivity ? (
          <EmptyState
            icon={Sparkles}
            title="No activity yet"
            description="Complete a task, log a study session or check in on a habit to earn your first XP."
          />
        ) : (
          <ul className="space-y-2.5">
            {recentAchievements.map((achievement) => (
              <li key={achievement.key} className="flex items-start gap-2.5 text-sm">
                <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{achievement.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Unlocked{' '}
                    {new Date(achievement.unlockedAt).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
              </li>
            ))}
            {recentXP.map((event) => (
              <li key={event.id} className="flex items-start gap-2.5 text-sm">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{event.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    +{event.points} XP ·{' '}
                    {new Date(event.createdAt).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Study + fitness + journal roll-up for the current week. */
export function WellbeingCard({
  study,
  fitness,
  recentJournal,
}: Pick<DashboardData, 'study' | 'fitness' | 'recentJournal'>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-muted-foreground" />
          This week
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border p-3">
            <dt className="text-xs text-muted-foreground">Study time</dt>
            <dd className="tabular mt-0.5 text-lg font-semibold">
              {formatMinutes(study.weekMinutes)}
            </dd>
          </div>
          <div className="rounded-md border border-border p-3">
            <dt className="text-xs text-muted-foreground">Workouts</dt>
            <dd className="tabular mt-0.5 text-lg font-semibold">{fitness.weekCount}</dd>
          </div>
        </dl>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Latest journal
          </p>
          {recentJournal.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing written yet.{' '}
              <Link href="/journal" className="text-primary hover:underline">
                Start journaling
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {recentJournal.map((entry) => (
                <li key={entry.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                      {entry.title ?? 'Untitled entry'}
                    </p>
                    <MoodBadge mood={entry.mood} />
                  </div>
                  <p className="text-xs text-muted-foreground">{truncate(entry.content, 90)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Headline XP + level panel. */
export function LevelCard({ level }: Pick<DashboardData, 'level'>) {
  return (
    <Card className="bg-primary/5">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Level
            </p>
            <p className="tabular text-3xl font-semibold leading-tight">{level.level}</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Zap className="h-4 w-4" />
          </span>
        </div>
        <Progress value={level.progressPercent} aria-label="Progress to next level" />
        <p className="tabular text-xs text-muted-foreground">
          {formatNumber(level.totalXP)} XP total · {formatNumber(level.xpRemaining)} to level{' '}
          {level.level + 1}
        </p>
      </CardContent>
    </Card>
  );
}
