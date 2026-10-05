import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

const LABELS: Record<AnalyticsRange, string> = {
  7: '7 days',
  30: '30 days',
  90: '90 days',
};

/**
 * Range switcher.
 *
 * Each range is its own URL, so the view is shareable and survives a reload,
 * and the whole control is server-rendered - no client state, and it works
 * before (or without) hydration.
 *
 * These are plain anchors rather than `next/link`. The App Router's
 * client-side navigation was observed to silently drop some query-only
 * transitions on this route: the RSC payload for the new range was fetched and
 * valid, but the URL and the rendered page were left untouched. A full
 * document navigation always applies, and on a server-rendered, data-heavy
 * page like this one the difference is not worth a control that sometimes
 * ignores a click.
 */
export function RangeSelector({ current }: { current: AnalyticsRange }) {
  return (
    <nav aria-label="Analytics range" className="flex gap-1.5">
      {ANALYTICS_RANGES.map((range) => {
        const active = range === current;
        return (
          <a
            key={range}
            href={`/analytics?range=${range}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              buttonVariants({ variant: active ? 'secondary' : 'ghost', size: 'sm' }),
              active && 'font-semibold',
            )}
          >
            {LABELS[range]}
          </a>
        );
      })}
    </nav>
  );
}
