'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  AXIS_PROPS,
  ChartFrame,
  GRID_PROPS,
  TOOLTIP_STYLES,
} from '@/components/analytics/chart-kit';
import { formatDayTick } from '@/lib/dates';

export interface TrendPoint {
  dayKey: string;
  value: number;
}

export interface TrendChartProps {
  title: string;
  description?: string;
  data: TrendPoint[];
  /** Series label shown in the tooltip. */
  seriesName: string;
  variant?: 'area' | 'line';
  colorToken?: 1 | 2 | 3 | 4 | 5;
  height?: number;
  /** Suffix appended to tooltip values, e.g. " min". */
  unit?: string;
}

export function TrendChart({
  title,
  description,
  data,
  seriesName,
  variant = 'area',
  colorToken = 1,
  height = 240,
  unit = '',
}: TrendChartProps) {
  const color = `hsl(var(--chart-${colorToken}))`;
  const gradientId = `trend-${title.replace(/\W+/g, '-').toLowerCase()}`;
  const isEmpty = data.every((point) => point.value === 0);

  return (
    <ChartFrame title={title} description={description} isEmpty={isEmpty} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        {variant === 'area' ? (
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="dayKey" tickFormatter={formatDayTick} {...AXIS_PROPS} minTickGap={24} />
            <YAxis allowDecimals={false} {...AXIS_PROPS} width={44} />
            <Tooltip
              {...TOOLTIP_STYLES}
              labelFormatter={formatDayTick}
              formatter={(value) => [`${value}${unit}`, seriesName]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              name={seriesName}
            />
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="dayKey" tickFormatter={formatDayTick} {...AXIS_PROPS} minTickGap={24} />
            <YAxis allowDecimals={false} {...AXIS_PROPS} width={44} />
            <Tooltip
              {...TOOLTIP_STYLES}
              labelFormatter={formatDayTick}
              formatter={(value) => [`${value}${unit}`, seriesName]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              name={seriesName}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </ChartFrame>
  );
}
