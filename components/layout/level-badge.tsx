import { Zap } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { formatNumber } from '@/lib/utils';
import type { LevelProgress } from '@/lib/xp';

/** Compact XP/level readout used in the sidebar footer and the top bar. */
export function LevelBadge({ level }: { level: LevelProgress }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Zap className="h-3.5 w-3.5 text-primary" />
          Level {level.level}
        </span>
        <span className="tabular text-xs text-muted-foreground">
          {formatNumber(level.totalXP)} XP
        </span>
      </div>
      <Progress value={level.progressPercent} aria-label="Progress to next level" />
      <p className="tabular text-[11px] text-muted-foreground">
        {formatNumber(level.xpRemaining)} XP to level {level.level + 1}
      </p>
    </div>
  );
}
