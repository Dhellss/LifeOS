'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  AXIS_PROPS,
  CHART_COLORS,
  ChartFrame,
  GRID_PROPS,
  TOOLTIP_STYLES,
} from '@/components/analytics/chart-kit';

export interface BarDatum {
  label: string;
  value: number;
}

export interface BarChartCardProps {
  title: string;
  description?: string;
  data: BarDatum[];
  seriesName: string;
  /** `horizontal` reads better for long category labels. */
  layout?: 'vertical' | 'horizontal';
  unit?: string;
  height?: number;
  /** Colour every bar from the palette instead of using one colour. */
  multicolor?: boolean;
  colorToken?: 1 | 2 | 3 | 4 | 5;
}

export function BarChartCard({
  title,
  description,
  data,
  seriesName,
  layout = 'vertical',
  unit = '',
  height = 240,
  multicolor = false,
  colorToken = 1,
}: BarChartCardProps) {
  const isEmpty = data.length === 0 || data.every((datum) => datum.value === 0);
  const baseColor = `hsl(var(--chart-${colorToken}))`;

  return (
    <ChartFrame title={title} description={description} isEmpty={isEmpty} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={layout === 'horizontal' ? 'vertical' : 'horizontal'}
          margin={
            layout === 'horizontal'
              ? { top: 4, right: 16, bottom: 0, left: 8 }
              : { top: 4, right: 8, bottom: 0, left: -18 }
          }
        >
          <CartesianGrid
            {...GRID_PROPS}
            vertical={layout === 'horizontal'}
            horizontal={layout === 'vertical'}
          />
          {layout === 'horizontal' ? (
            <>
              <XAxis type="number" allowDecimals={false} {...AXIS_PROPS} />
              <YAxis type="category" dataKey="label" width={96} {...AXIS_PROPS} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} {...AXIS_PROPS} width={44} />
            </>
          )}
          <Tooltip
            {...TOOLTIP_STYLES}
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            formatter={(value) => [`${value}${unit}`, seriesName]}
          />
          <Bar dataKey="value" name={seriesName} radius={[4, 4, 0, 0]} fill={baseColor}>
            {multicolor
              ? data.map((datum, index) => (
                  <Cell key={datum.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))
              : null}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
