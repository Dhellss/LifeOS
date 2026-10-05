import * as Icons from 'lucide-react';
import { Lock, type LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { AchievementView } from '@/lib/services/achievements';

/**
 * Resolve a definition's `icon` string to a Lucide component, falling back to
 * a trophy so a typo in the catalogue cannot crash the page.
 */
function resolveIcon(name: string): LucideIcon {
  const candidate = (Icons as unknown as Record<string, LucideIcon | undefined>)[name];
  return candidate ?? Icons.Trophy;
}

const CATEGORY_LABELS: Record<AchievementView['category'], string> = {
  tasks: 'Tasks',
  projects: 'Projects',
  habits: 'Habits',
  study: 'Study',
  fitness: 'Fitness',
  journal: 'Journal',
  progression: 'Progression',
};

export function AchievementCard({ achievement }: { achievement: AchievementView }) {
  const Icon = achievement.unlocked ? resolveIcon(achievement.icon) : Lock;

  return (
    <div
      className={cn(
        'flex h-full flex-col gap-3 rounded-lg border p-5 transition-colors',
        achievement.unlocked ? 'border-primary/35 bg-primary/5' : 'border-border bg-card',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
            achievement.unlocked ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{achievement.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{achievement.description}</p>
        </div>
      </div>

      <div className="mt-auto space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <Badge variant={achievement.unlocked ? 'success' : 'muted'}>
            {achievement.unlocked ? 'Unlocked' : CATEGORY_LABELS[achievement.category]}
          </Badge>
          <span className="tabular text-muted-foreground">
            {Math.min(achievement.currentValue, achievement.threshold)}/{achievement.threshold}
          </span>
        </div>

        <Progress
          value={achievement.progress}
          aria-label={`${achievement.title} progress`}
          indicatorClassName={achievement.unlocked ? 'bg-emerald-500' : undefined}
        />

        {achievement.unlockedAt ? (
          <p className="text-[11px] text-muted-foreground">
            Unlocked{' '}
            {new Date(achievement.unlockedAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
