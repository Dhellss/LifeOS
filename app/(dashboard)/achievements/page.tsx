import type { Metadata } from 'next';
import { Trophy, Zap } from 'lucide-react';

import { AchievementCard } from '@/components/achievements/achievement-card';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { listAchievements } from '@/lib/services/achievements';
import { getLevelProgress, getRecentXPEvents } from '@/lib/services/xp';
import { requireUser } from '@/lib/session';
import { formatMinutes, formatNumber, percentage } from '@/lib/utils';

export const metadata: Metadata = { title: 'Achievements' };

export default async function AchievementsPage() {
  const user = await requireUser();
  const [{ achievements, stats, unlockedCount }, level, recentXP] = await Promise.all([
    listAchievements(user.id),
    getLevelProgress(user.id),
    getRecentXPEvents(user.id, 12),
  ]);

  const unlocked = achievements.filter((achievement) => achievement.unlocked);
  const locked = achievements.filter((achievement) => !achievement.unlocked);

  return (
    <>
      <PageHeader
        title="Achievements"
        description="Milestones unlock automatically when your records cross their threshold."
      />

      <section aria-label="Progression" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Level"
          value={level.level}
          hint={`${formatNumber(level.xpRemaining)} XP to level ${level.level + 1}`}
          icon={Zap}
        />
        <StatCard label="Total XP" value={formatNumber(level.totalXP)} />
        <StatCard
          label="Unlocked"
          value={`${unlockedCount}/${ACHIEVEMENTS.length}`}
          hint={`${percentage(unlockedCount, ACHIEVEMENTS.length)}% complete`}
          icon={Trophy}
        />
        <StatCard
          label="Study logged"
          value={formatMinutes(stats.studyMinutes)}
          hint={`${stats.studySessions} sessions`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Level progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={level.progressPercent} aria-label="Progress to next level" />
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Tasks done</dt>
                <dd className="tabular font-semibold">{stats.tasksCompleted}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Projects shipped</dt>
                <dd className="tabular font-semibold">{stats.projectsCompleted}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Best habit streak</dt>
                <dd className="tabular font-semibold">{stats.longestHabitStreak}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Workouts</dt>
                <dd className="tabular font-semibold">{stats.workouts}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent XP</CardTitle>
          </CardHeader>
          <CardContent>
            {recentXP.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Complete an action anywhere in LifeOS to start earning XP.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recentXP.map((event) => (
                  <li key={event.id} className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate">{event.reason}</span>
                    <span className="tabular shrink-0 font-medium text-primary">
                      +{event.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {unlocked.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Unlocked ({unlocked.length})</h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {unlocked.map((achievement) => (
              <li key={achievement.key}>
                <AchievementCard achievement={achievement} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          {unlocked.length > 0 ? `Still to earn (${locked.length})` : 'Available achievements'}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {locked.map((achievement) => (
            <li key={achievement.key}>
              <AchievementCard achievement={achievement} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
