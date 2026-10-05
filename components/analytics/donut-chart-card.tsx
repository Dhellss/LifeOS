'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { CHART_COLORS, ChartFrame, TOOLTIP_STYLES } from '@/components/analytics/chart-kit';
import { formatNumber } from '@/lib/utils';

export interface DonutDatum {
  label: string;
  value: number;
  /** Explicit colour; falls back to the palette by index. */
  color?: string;
}

export interface DonutChartCardProps {
  title: string;
  description?: string;
  data: DonutDatum[];
  unit?: string;
  height?: number;
}

export function DonutChartCard({
  title,
  description,
  data,
  unit = '',
  height = 240,
}: DonutChartCardProps) {
  const slices = data.filter((datum) => datum.value > 0);
  const total = slices.reduce((sum, datum) => sum + datum.value, 0);

  return (
    <ChartFrame
      title={title}
      description={description}
      isEmpty={slices.length === 0}
      height={height}
    >
      <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-center">
        <div className="h-36 w-full sm:h-full sm:w-1/2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="label"
                innerRadius="58%"
                outerRadius="88%"
                paddingAngle={2}
                strokeWidth={0}
              >
                {slices.map((datum, index) => (
                  <Cell
                    key={datum.label}
                    fill={datum.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                {...TOOLTIP_STYLES}
                formatter={(value, name) => [`${formatNumber(Number(value))}${unit}`, String(name)]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="scrollbar-thin flex-1 space-y-1.5 overflow-y-auto sm:max-h-full">
          {slices.map((datum, index) => (
            <li key={datum.label} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{
                  backgroundColor: datum.color ?? CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
              <span className="min-w-0 flex-1 truncate">{datum.label}</span>
              <span className="tabular shrink-0 font-medium">
                {formatNumber(datum.value)}
                {unit}
              </span>
              <span className="tabular w-10 shrink-0 text-right text-muted-foreground">
                {total === 0 ? '0%' : `${Math.round((datum.value / total) * 100)}%`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  );
}
