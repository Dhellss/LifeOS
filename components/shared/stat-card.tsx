import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: string | number;
  /** Short qualifier under the value, e.g. "of 5 planned". */
  hint?: string;
  icon?: LucideIcon;
  /** Percentage change vs. the previous period, if meaningful. */
  delta?: number;
  className?: string;
}

export function StatCard({ label, value, hint, icon: Icon, delta, className }: StatCardProps) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta) && delta !== 0;
  const DeltaIcon = (delta ?? 0) >= 0 ? TrendingUp : TrendingDown;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="tabular text-2xl font-semibold leading-tight">{value}</p>
          <div className="flex items-center gap-2 text-xs">
            {hint ? <span className="text-muted-foreground">{hint}</span> : null}
            {hasDelta ? (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 font-medium',
                  delta! >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
                )}
              >
                <DeltaIcon className="h-3 w-3" />
                {Math.abs(delta!)}%
              </span>
            ) : null}
          </div>
        </div>
        {Icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
