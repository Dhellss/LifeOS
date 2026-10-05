import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';

/** Monday-first week, matching the default `UserPreferences.weekStartsOn`. */
export const WEEK_STARTS_ON = 1 as const;

export type DayKey = string; // `yyyy-MM-dd`

/**
 * Canonical key for a calendar day in the server's local timezone.
 * Used for grouping analytics rows and for habit log identity.
 */
export function toDayKey(date: Date): DayKey {
  return format(date, 'yyyy-MM-dd');
}

/**
 * A `@db.Date` column round-trips through Prisma as a UTC-midnight `Date`.
 * Reading it back with local getters can shift the day for negative offsets,
 * so date-only values are always formatted from their UTC parts.
 */
export function toUtcDayKey(date: Date): DayKey {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Normalise any instant to UTC midnight for storage in a `@db.Date` column. */
export function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
}

/** Parse a `yyyy-MM-dd` string into UTC midnight. Throws on malformed input. */
export function parseDayKey(key: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error(`Invalid day key: ${key}`);
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

export interface DateRange {
  start: Date;
  end: Date;
}

export function dayRange(reference: Date = new Date()): DateRange {
  return { start: startOfDay(reference), end: endOfDay(reference) };
}

export function weekRange(reference: Date = new Date()): DateRange {
  return {
    start: startOfWeek(reference, { weekStartsOn: WEEK_STARTS_ON }),
    end: endOfWeek(reference, { weekStartsOn: WEEK_STARTS_ON }),
  };
}

export function monthRange(reference: Date = new Date()): DateRange {
  return { start: startOfMonth(reference), end: endOfMonth(reference) };
}

/** Inclusive range covering the last `days` calendar days, ending today. */
export function trailingDayRange(days: number, reference: Date = new Date()): DateRange {
  if (days < 1) throw new Error('days must be >= 1');
  return { start: startOfDay(subDays(reference, days - 1)), end: endOfDay(reference) };
}

/** Every day key in a range, ascending. Useful for zero-filling charts. */
export function dayKeysInRange(range: DateRange): DayKey[] {
  return eachDayOfInterval({ start: range.start, end: range.end }).map(toDayKey);
}

/**
 * `2026-03-14` -> `14 Mar`, for compact chart axis ticks and tooltip labels.
 *
 * Lives here rather than beside the chart components because the Study,
 * Fitness and Analytics pages are Server Components that build their chart
 * labels before handing the data to the client: a `'use client'` module's
 * functions cannot be called from the server.
 *
 * Takes `unknown` because Recharts types tick and label values as `ReactNode`.
 */
export function formatDayTick(value: unknown): string {
  const dayKey = typeof value === 'string' ? value : String(value ?? '');
  const [year, month, day] = dayKey.split('-');
  if (!year || !month || !day) return dayKey;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return dayKey;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * The 6x7 grid (42 cells) that a month calendar view renders, including the
 * leading/trailing days from adjacent months.
 */
export function monthGridDays(reference: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(reference), { weekStartsOn: WEEK_STARTS_ON });
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
};
