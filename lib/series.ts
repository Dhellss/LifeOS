import { toDayKey, type DateRange, type DayKey } from './dates';

/**
 * Time-series shaping for the charts.
 *
 * Pure, so it lives here rather than in `lib/services/analytics.ts`: that
 * module composes database aggregates, while these two functions only reshape
 * rows that have already been fetched. Keeping them apart means the series
 * logic is unit-testable without a database.
 */

export interface SeriesPoint {
  dayKey: DayKey;
  value: number;
}

/**
 * Turn sparse rows into a dense, ascending daily series.
 *
 * Rows outside the range are ignored, and several rows landing on the same day
 * accumulate, so callers can pass raw query results without pre-grouping.
 */
export function fillDailySeries(
  range: DateRange,
  rows: readonly { date: Date; value: number }[],
): SeriesPoint[] {
  const buckets = new Map<DayKey, number>();
  const cursor = new Date(range.start);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(range.end);
  while (cursor <= end) {
    buckets.set(toDayKey(cursor), 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const row of rows) {
    const key = toDayKey(row.date);
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + row.value);
  }

  return [...buckets.entries()].map(([dayKey, value]) => ({ dayKey, value }));
}

/** Running total of a daily series, e.g. cumulative XP. */
export function cumulative(series: readonly SeriesPoint[]): SeriesPoint[] {
  return offsetCumulative(series, 0);
}

/**
 * Running total that starts from `offset` rather than zero.
 *
 * The XP chart uses this so a 30-day window still shows the user's real total
 * instead of restarting the curve at the window boundary.
 */
export function offsetCumulative(series: readonly SeriesPoint[], offset: number): SeriesPoint[] {
  let running = Math.max(0, offset);
  return series.map((point) => {
    running += point.value;
    return { dayKey: point.dayKey, value: running };
  });
}

/** Sum the values of a series. */
export function sumSeries(series: readonly SeriesPoint[]): number {
  return series.reduce((total, point) => total + point.value, 0);
}
