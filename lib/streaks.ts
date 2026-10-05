import { addDays, parseDayKey, toDayKey, type DayKey } from './dates';

/**
 * Streak calculation over a set of completed day keys.
 *
 * Pure and timezone-agnostic: callers pass `yyyy-MM-dd` keys plus the key for
 * "today", so the same function serves habits, journaling, or any other daily
 * check-in without duplicating the off-by-one logic.
 */

export interface StreakResult {
  /** Days in the streak ending today (or yesterday, which is still "live"). */
  current: number;
  /** Longest run of consecutive days anywhere in the history. */
  longest: number;
  /** True when the streak includes today. */
  completedToday: boolean;
}

export const EMPTY_STREAK: StreakResult = { current: 0, longest: 0, completedToday: false };

/**
 * A streak stays "current" while it ends today or yesterday — a habit is not
 * broken until a full day has been missed.
 */
export function calculateStreak(dayKeys: Iterable<DayKey>, today: DayKey): StreakResult {
  const days = new Set(dayKeys);
  if (days.size === 0) return EMPTY_STREAK;

  const sorted = [...days].sort();
  let longest = 1;
  let run = 1;

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = parseDayKey(sorted[i - 1]!);
    const expected = toDayKey(addDays(previous, 1));
    if (sorted[i] === expected) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
  }

  const completedToday = days.has(today);
  const todayDate = parseDayKey(today);
  const yesterday = toDayKey(addDays(todayDate, -1));

  // Walk backwards from the most recent live anchor to size the current streak.
  let anchor: DayKey | null = null;
  if (completedToday) anchor = today;
  else if (days.has(yesterday)) anchor = yesterday;

  let current = 0;
  if (anchor) {
    let cursor = parseDayKey(anchor);
    while (days.has(toDayKey(cursor))) {
      current += 1;
      cursor = addDays(cursor, -1);
    }
  }

  return { current, longest, completedToday };
}

/**
 * A habit log only counts toward a streak once it meets the habit's
 * `targetCount`, so partial check-ins do not keep a streak alive.
 */
export function qualifyingDayKeys(
  logs: readonly { dayKey: DayKey; count: number }[],
  targetCount: number,
): DayKey[] {
  const target = Math.max(1, targetCount);
  return logs.filter((log) => log.count >= target).map((log) => log.dayKey);
}
