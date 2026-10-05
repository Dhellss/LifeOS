import { describe, expect, it } from 'vitest';

import { EMPTY_STREAK, calculateStreak, qualifyingDayKeys } from '@/lib/streaks';

const TODAY = '2026-03-10';

describe('calculateStreak', () => {
  it('returns an empty result for no history', () => {
    expect(calculateStreak([], TODAY)).toEqual(EMPTY_STREAK);
  });

  it('counts a single check-in today as a streak of one', () => {
    expect(calculateStreak([TODAY], TODAY)).toEqual({
      current: 1,
      longest: 1,
      completedToday: true,
    });
  });

  it('counts consecutive days ending today', () => {
    const result = calculateStreak(['2026-03-08', '2026-03-09', '2026-03-10'], TODAY);
    expect(result).toEqual({ current: 3, longest: 3, completedToday: true });
  });

  it('keeps the streak alive when the last check-in was yesterday', () => {
    const result = calculateStreak(['2026-03-07', '2026-03-08', '2026-03-09'], TODAY);
    expect(result.current).toBe(3);
    expect(result.completedToday).toBe(false);
  });

  it('breaks the streak once a full day has been missed', () => {
    // Nothing on the 9th or 10th, so the run ending on the 8th is historical.
    const result = calculateStreak(['2026-03-06', '2026-03-07', '2026-03-08'], TODAY);
    expect(result.current).toBe(0);
    expect(result.longest).toBe(3);
  });

  it('reports the longest historical run independently of the current one', () => {
    const result = calculateStreak(
      [
        // A five-day run in February.
        '2026-02-01',
        '2026-02-02',
        '2026-02-03',
        '2026-02-04',
        '2026-02-05',
        // A two-day run ending today.
        '2026-03-09',
        '2026-03-10',
      ],
      TODAY,
    );
    expect(result.current).toBe(2);
    expect(result.longest).toBe(5);
    expect(result.completedToday).toBe(true);
  });

  it('is insensitive to input order and duplicates', () => {
    const ordered = calculateStreak(['2026-03-08', '2026-03-09', '2026-03-10'], TODAY);
    const shuffled = calculateStreak(
      ['2026-03-10', '2026-03-08', '2026-03-09', '2026-03-10'],
      TODAY,
    );
    expect(shuffled).toEqual(ordered);
  });

  it('spans month boundaries', () => {
    const result = calculateStreak(
      ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'],
      '2026-03-02',
    );
    expect(result.current).toBe(4);
    expect(result.longest).toBe(4);
  });

  it('handles a leap-day boundary', () => {
    const result = calculateStreak(['2028-02-28', '2028-02-29', '2028-03-01'], '2028-03-01');
    expect(result.current).toBe(3);
  });

  it('ignores future-dated entries when sizing the current streak', () => {
    const result = calculateStreak(['2026-03-10', '2026-03-12'], TODAY);
    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
  });
});

describe('qualifyingDayKeys', () => {
  it('keeps only days that met the target count', () => {
    const logs = [
      { dayKey: '2026-03-08', count: 8 },
      { dayKey: '2026-03-09', count: 3 },
      { dayKey: '2026-03-10', count: 8 },
    ];
    expect(qualifyingDayKeys(logs, 8)).toEqual(['2026-03-08', '2026-03-10']);
  });

  it('treats a target below 1 as 1 so any check-in counts', () => {
    const logs = [{ dayKey: '2026-03-10', count: 1 }];
    expect(qualifyingDayKeys(logs, 0)).toEqual(['2026-03-10']);
    expect(qualifyingDayKeys(logs, -5)).toEqual(['2026-03-10']);
  });

  it('breaks a streak when a day falls short of the target', () => {
    const logs = [
      { dayKey: '2026-03-08', count: 8 },
      { dayKey: '2026-03-09', count: 2 },
      { dayKey: '2026-03-10', count: 8 },
    ];
    const result = calculateStreak(qualifyingDayKeys(logs, 8), TODAY);
    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
  });
});
