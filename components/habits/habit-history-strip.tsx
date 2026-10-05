import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface HabitHistoryStripProps {
  /** `yyyy-MM-dd` -> count, ascending. */
  history: Record<string, number>;
  targetCount: number;
  color: string;
}

/**
 * 28-day mini heatmap. Each cell's opacity reflects how close the day came to
 * the habit's target, so partial check-ins are visible without a legend.
 */
export function HabitHistoryStrip({ history, targetCount, color }: HabitHistoryStripProps) {
  const days = Object.entries(history).sort(([a], [b]) => a.localeCompare(b));
  const target = Math.max(1, targetCount);

  return (
    <div className="flex flex-wrap gap-1" aria-label="Last 28 days of check-ins">
      {days.map(([dayKey, count]) => {
        const ratio = Math.min(1, count / target);
        return (
          <Tooltip key={dayKey}>
            <TooltipTrigger asChild>
              <span
                className="h-4 w-4 rounded-[3px] border border-border"
                style={{
                  backgroundColor: ratio === 0 ? 'transparent' : color,
                  opacity: ratio === 0 ? 1 : 0.35 + ratio * 0.65,
                }}
              />
            </TooltipTrigger>
            <TooltipContent>
              {new Date(`${dayKey}T00:00:00`).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
              })}
              {' · '}
              {count}/{target}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
