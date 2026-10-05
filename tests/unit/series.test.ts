import { describe, expect, it } from 'vitest';

import { cumulative, fillDailySeries, offsetCumulative, sumSeries } from '@/lib/series';
import { toDayKey, trailingDayRange } from '@/lib/dates';

describe('fillDailySeries', () => {
  const reference = new Date(2026, 2, 10, 12);

  it('zero-fills every day in the range', () => {
    const range = trailingDayRange(5, reference);
    const series = fillDailySeries(range, []);
    expect(series).toHaveLength(5);
    expect(series.every((point) => point.value === 0)).toBe(true);
    expect(series[0]!.dayKey).toBe('2026-03-06');
    expect(series[4]!.dayKey).toBe('2026-03-10');
  });

  it('places rows on the matching day', () => {
    const range = trailingDayRange(3, reference);
    const series = fillDailySeries(range, [
      { date: new Date(2026, 2, 9, 8), value: 30 },
      { date: new Date(2026, 2, 10, 20), value: 45 },
    ]);
    expect(series.map((point) => [point.dayKey, point.value])).toEqual([
      ['2026-03-08', 0],
      ['2026-03-09', 30],
      ['2026-03-10', 45],
    ]);
  });

  it('accumulates multiple rows landing on the same day', () => {
    const range = trailingDayRange(2, reference);
    const series = fillDailySeries(range, [
      { date: new Date(2026, 2, 10, 9), value: 1 },
      { date: new Date(2026, 2, 10, 14), value: 1 },
      { date: new Date(2026, 2, 10, 21), value: 1 },
    ]);
    expect(series[1]).toEqual({ dayKey: '2026-03-10', value: 3 });
  });

  it('ignores rows outside the range', () => {
    const range = trailingDayRange(2, reference);
    const series = fillDailySeries(range, [
      { date: new Date(2026, 1, 1), value: 99 },
      { date: new Date(2026, 4, 1), value: 99 },
    ]);
    expect(series.every((point) => point.value === 0)).toBe(true);
  });

  it('returns an ascending series', () => {
    const range = trailingDayRange(14, reference);
    const keys = fillDailySeries(range, []).map((point) => point.dayKey);
    expect([...keys].sort()).toEqual(keys);
  });

  it('ends on the reference day', () => {
    const range = trailingDayRange(30, reference);
    const series = fillDailySeries(range, []);
    expect(series[series.length - 1]!.dayKey).toBe(toDayKey(reference));
  });
});

describe('cumulative', () => {
  it('produces a running total', () => {
    const series = cumulative([
      { dayKey: '2026-03-08', value: 10 },
      { dayKey: '2026-03-09', value: 0 },
      { dayKey: '2026-03-10', value: 25 },
    ]);
    expect(series.map((point) => point.value)).toEqual([10, 10, 35]);
  });

  it('is monotonically non-decreasing for non-negative input', () => {
    const series = cumulative([
      { dayKey: 'a', value: 1 },
      { dayKey: 'b', value: 0 },
      { dayKey: 'c', value: 4 },
      { dayKey: 'd', value: 2 },
    ]);
    for (let index = 1; index < series.length; index += 1) {
      expect(series[index]!.value).toBeGreaterThanOrEqual(series[index - 1]!.value);
    }
  });

  it('returns an empty series for empty input', () => {
    expect(cumulative([])).toEqual([]);
  });
});

describe('offsetCumulative', () => {
  it('starts the running total from the offset', () => {
    const series = offsetCumulative(
      [
        { dayKey: '2026-03-09', value: 10 },
        { dayKey: '2026-03-10', value: 5 },
      ],
      100,
    );
    expect(series.map((point) => point.value)).toEqual([110, 115]);
  });

  it('clamps a negative offset to zero', () => {
    // The XP chart derives its offset by subtracting the window total from the
    // all-time total; rounding or a concurrent write must not push the curve
    // below zero.
    const series = offsetCumulative([{ dayKey: '2026-03-10', value: 5 }], -50);
    expect(series[0]!.value).toBe(5);
  });

  it('matches cumulative when the offset is zero', () => {
    const input = [
      { dayKey: 'a', value: 2 },
      { dayKey: 'b', value: 3 },
    ];
    expect(offsetCumulative(input, 0)).toEqual(cumulative(input));
  });
});

describe('sumSeries', () => {
  it('adds up the values', () => {
    expect(
      sumSeries([
        { dayKey: 'a', value: 2 },
        { dayKey: 'b', value: 0 },
        { dayKey: 'c', value: 40 },
      ]),
    ).toBe(42);
  });

  it('is zero for an empty series', () => {
    expect(sumSeries([])).toBe(0);
  });
});
