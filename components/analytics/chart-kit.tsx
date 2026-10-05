'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Shared chart chrome.
 *
 * Recharts renders inside a fixed-height box; the wrapper supplies the title,
 * the empty state, and the `aria` description so the chart is not an opaque
 * region for assistive technology.
 */
export interface ChartFrameProps {
  title: string;
  description?: string;
  /** Rendered instead of the chart when there is no data to plot. */
  isEmpty?: boolean;
  emptyLabel?: string;
  height?: number;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function ChartFrame({
  title,
  description,
  isEmpty = false,
  emptyLabel = 'No data in this range yet.',
  height = 240,
  action,
  className,
  children,
}: ChartFrameProps) {
  return (
    <section
      className={cn('rounded-lg border border-border bg-card p-5', className)}
      aria-label={title}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </header>

      {isEmpty ? (
        <div
          className="flex items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground"
          style={{ height }}
        >
          {emptyLabel}
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </section>
  );
}

/** Token-driven colours so charts follow the active theme. */
export const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
] as const;

export const AXIS_PROPS = {
  stroke: 'hsl(var(--muted-foreground))',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export const GRID_PROPS = {
  stroke: 'hsl(var(--border))',
  strokeDasharray: '3 3',
  vertical: false,
} as const;

export const TOOLTIP_STYLES = {
  contentStyle: {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.5rem',
    fontSize: '12px',
    color: 'hsl(var(--popover-foreground))',
    boxShadow: '0 8px 24px -12px rgb(0 0 0 / 0.35)',
  },
  labelStyle: { color: 'hsl(var(--muted-foreground))', marginBottom: 4 },
  itemStyle: { color: 'hsl(var(--popover-foreground))' },
} as const;
