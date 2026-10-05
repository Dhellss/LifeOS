import { describe, expect, it } from 'vitest';

import {
  WEEK_STARTS_ON,
  dayKeysInRange,
  dayRange,
  formatDayTick,
  monthGridDays,
  monthRange,
  parseDayKey,
  toDayKey,
  toUtcDateOnly,
  toUtcDayKey,
  trailingDayRange,
  weekRange,
} from '@/lib/dates';

describe('toDayKey / parseDayKey', () => {
  it('formats a date as yyyy-MM-dd', () => {
    expect(toDayKey(new Date(2026, 2, 9, 23, 30))).toBe('2026-03-09');
    expect(toDayKey(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('round-trips a key through parse and format', () => {
    for (const key of ['2026-01-01', '2026-02-28', '2028-02-29', '2026-12-31']) {
      expect(toUtcDayKey(parseDayKey(key))).toBe(key);
    }
  });

  it('rejects a malformed key', () => {
    expect(() => parseDayKey('2026-3-9')).toThrow(/Invalid day key/);
    expect(() => parseDayKey('09-03-2026')).toThrow(/Invalid day key/);
    expect(() => parseDayKey('')).toThrow(/Invalid day key/);
  });
});

describe('toUtcDayKey', () => {
  it('reads a UTC-midnight date from its UTC parts', () => {
    // A `@db.Date` column round-trips as UTC midnight; reading it with local
    // getters would shift the day for negative UTC offsets.
    expect(toUtcDayKey(new Date('2026-03-09T00:00:00.000Z'))).toBe('2026-03-09');
    expect(toUtcDayKey(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01');
  });
});

describe('toUtcDateOnly', () => {
  it('normalises any instant to UTC midnight of its local calendar day', () => {
    const normalised = toUtcDateOnly(new Date(2026, 2, 9, 18, 45, 12));
    expect(normalised.toISOString()).toBe('2026-03-09T00:00:00.000Z');
  });

  it('is idempotent', () => {
    const once = toUtcDateOnly(new Date(2026, 2, 9, 7, 0));
    expect(toUtcDateOnly(once).toISOString()).toBe(once.toISOString());
  });
});

describe('weekRange', () => {
  it('starts the week on Monday', () => {
    expect(WEEK_STARTS_ON).toBe(1);
    // 2026-03-11 is a Wednesday.
    const range = weekRange(new Date(2026, 2, 11, 12));
    expect(toDayKey(range.start)).toBe('2026-03-09');
    expect(toDayKey(range.end)).toBe('2026-03-15');
  });

  it('treats Sunday as the end of the preceding week', () => {
    // 2026-03-15 is a Sunday.
    const range = weekRange(new Date(2026, 2, 15, 12));
    expect(toDayKey(range.start)).toBe('2026-03-09');
  });
});

describe('trailingDayRange', () => {
  it('includes today and spans exactly `days` days', () => {
    const reference = new Date(2026, 2, 10, 15);
    const range = trailingDayRange(7, reference);
    expect(toDayKey(range.start)).toBe('2026-03-04');
    expect(toDayKey(range.end)).toBe('2026-03-10');
    expect(dayKeysInRange(range)).toHaveLength(7);
  });

  it('handles a single-day range', () => {
    const range = trailingDayRange(1, new Date(2026, 2, 10, 15));
    expect(dayKeysInRange(range)).toEqual(['2026-03-10']);
  });

  it('rejects a non-positive window', () => {
    expect(() => trailingDayRange(0)).toThrow(/days must be/);
    expect(() => trailingDayRange(-3)).toThrow(/days must be/);
  });
});

describe('monthGridDays', () => {
  it('always returns a full 6x7 grid', () => {
    for (const month of [0, 1, 5, 11]) {
      expect(monthGridDays(new Date(2026, month, 15))).toHaveLength(42);
    }
  });

  it('starts on the Monday on or before the first of the month', () => {
    // 1 March 2026 is a Sunday, so the grid starts on 23 February.
    const days = monthGridDays(new Date(2026, 2, 15));
    expect(toDayKey(days[0]!)).toBe('2026-02-23');
    expect(toDayKey(days[41]!)).toBe('2026-04-05');
  });

  it('produces consecutive days with no gaps', () => {
    const days = monthGridDays(new Date(2026, 2, 15));
    for (let index = 1; index < days.length; index += 1) {
      const diff = days[index]!.getTime() - days[index - 1]!.getTime();
      // Allow for DST transitions, which make a "day" 23 or 25 hours long.
      expect(diff).toBeGreaterThanOrEqual(23 * 60 * 60 * 1000);
      expect(diff).toBeLessThanOrEqual(25 * 60 * 60 * 1000);
    }
  });
});

describe('dayRange', () => {
  it('spans midnight to the last millisecond of the same day', () => {
    const range = dayRange(new Date(2026, 2, 10, 14, 30));
    expect(toDayKey(range.start)).toBe('2026-03-10');
    expect(toDayKey(range.end)).toBe('2026-03-10');
    expect(range.start.getHours()).toBe(0);
    expect(range.end.getHours()).toBe(23);
    expect(range.end.getMilliseconds()).toBe(999);
  });
});

describe('monthRange', () => {
  it('covers the whole calendar month', () => {
    const range = monthRange(new Date(2026, 2, 15));
    expect(toDayKey(range.start)).toBe('2026-03-01');
    expect(toDayKey(range.end)).toBe('2026-03-31');
  });

  it('handles a short month and a leap February', () => {
    expect(toDayKey(monthRange(new Date(2026, 3, 10)).end)).toBe('2026-04-30');
    expect(toDayKey(monthRange(new Date(2026, 1, 10)).end)).toBe('2026-02-28');
    expect(toDayKey(monthRange(new Date(2028, 1, 10)).end)).toBe('2028-02-29');
  });
});

describe('formatDayTick', () => {
  it('shortens a day key for an axis tick', () => {
    // The month name is locale-dependent, so assert on the parts that are not.
    const label = formatDayTick('2026-03-14');
    expect(label).not.toBe('2026-03-14');
    expect(label).toContain('14');
  });

  it('passes through anything that is not a day key', () => {
    expect(formatDayTick('not-a-date')).toBe('not-a-date');
    expect(formatDayTick('2026-13-45')).not.toBe('');
    expect(formatDayTick('')).toBe('');
  });

  it('tolerates the non-string values Recharts may pass', () => {
    expect(formatDayTick(undefined)).toBe('');
    expect(formatDayTick(null)).toBe('');
    expect(formatDayTick(42)).toBe('42');
  });
});
