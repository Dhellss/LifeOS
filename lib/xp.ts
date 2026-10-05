import type { TaskPriority, XPEventType } from '@prisma/client';

/**
 * XP + levelling rules.
 *
 * This module is intentionally pure: no database, no I/O. Every award that the
 * services hand to `lib/services/xp.ts` is produced here, which keeps the
 * reward curve in one place and makes it exhaustively unit-testable.
 */

export const XP_PER_LEVEL = 100;

export const XP_RULES = {
  TASK_COMPLETED: 10,
  URGENT_TASK_COMPLETED: 20,
  PROJECT_COMPLETED: 100,
  HABIT_CHECKIN: 15,
  /** Study awards 1 XP per 10 minutes, floored, with a minimum. */
  STUDY_PER_10_MINUTES: 1,
  STUDY_MINIMUM: 5,
  WORKOUT_LOGGED: 25,
  JOURNAL_ENTRY: 10,
  ACHIEVEMENT_UNLOCKED: 50,
} as const;

export interface XPAward {
  type: XPEventType;
  points: number;
  reason: string;
  /**
   * Stable identity of the rewarded action. Persisted with a unique constraint
   * on `(userId, dedupeKey)` so replaying an action never double-awards XP.
   */
  dedupeKey: string;
}

// ---------------------------------------------------------------------------
// Levelling
// ---------------------------------------------------------------------------

/** `level = floor(totalXP / 100) + 1`, clamped so level is always >= 1. */
export function levelFromXP(totalXP: number): number {
  if (!Number.isFinite(totalXP) || totalXP <= 0) return 1;
  return Math.floor(totalXP / XP_PER_LEVEL) + 1;
}

/** Total XP required to have reached `level`. Level 1 starts at 0 XP. */
export function xpForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return (safeLevel - 1) * XP_PER_LEVEL;
}

export interface LevelProgress {
  level: number;
  totalXP: number;
  /** XP accumulated inside the current level. */
  xpIntoLevel: number;
  /** XP needed to advance from the current level to the next. */
  xpForNextLevel: number;
  /** XP still required to level up. */
  xpRemaining: number;
  /** Progress through the current level, 0-100. */
  progressPercent: number;
}

export function levelProgress(totalXP: number): LevelProgress {
  const safeTotal = Number.isFinite(totalXP) ? Math.max(0, Math.floor(totalXP)) : 0;
  const level = levelFromXP(safeTotal);
  const xpIntoLevel = safeTotal - xpForLevel(level);
  return {
    level,
    totalXP: safeTotal,
    xpIntoLevel,
    xpForNextLevel: XP_PER_LEVEL,
    xpRemaining: XP_PER_LEVEL - xpIntoLevel,
    progressPercent: Math.round((xpIntoLevel / XP_PER_LEVEL) * 100),
  };
}

// ---------------------------------------------------------------------------
// Award builders
// ---------------------------------------------------------------------------

export function taskCompletionXP(priority: TaskPriority): number {
  return priority === 'URGENT' ? XP_RULES.URGENT_TASK_COMPLETED : XP_RULES.TASK_COMPLETED;
}

/** 1 XP per full 10 minutes studied, never below `STUDY_MINIMUM`. */
export function studySessionXP(durationMinutes: number): number {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0;
  const earned = Math.floor(durationMinutes / 10) * XP_RULES.STUDY_PER_10_MINUTES;
  return Math.max(XP_RULES.STUDY_MINIMUM, earned);
}

export function taskCompletedAward(task: {
  id: string;
  title: string;
  priority: TaskPriority;
}): XPAward {
  return {
    type: 'TASK_COMPLETED',
    points: taskCompletionXP(task.priority),
    reason: `Completed task "${task.title}"`,
    dedupeKey: `TASK_COMPLETED:${task.id}`,
  };
}

export function projectCompletedAward(project: { id: string; name: string }): XPAward {
  return {
    type: 'PROJECT_COMPLETED',
    points: XP_RULES.PROJECT_COMPLETED,
    reason: `Completed project "${project.name}"`,
    dedupeKey: `PROJECT_COMPLETED:${project.id}`,
  };
}

export function habitCheckinAward(log: {
  habitId: string;
  dayKey: string;
  habitName: string;
}): XPAward {
  return {
    type: 'HABIT_CHECKIN',
    points: XP_RULES.HABIT_CHECKIN,
    reason: `Checked in on "${log.habitName}"`,
    dedupeKey: `HABIT_CHECKIN:${log.habitId}:${log.dayKey}`,
  };
}

export function studySessionAward(session: {
  id: string;
  subject: string;
  durationMinutes: number;
}): XPAward {
  return {
    type: 'STUDY_SESSION',
    points: studySessionXP(session.durationMinutes),
    reason: `Studied ${session.durationMinutes} min of ${session.subject}`,
    dedupeKey: `STUDY_SESSION:${session.id}`,
  };
}

export function workoutAward(workout: { id: string; name: string }): XPAward {
  return {
    type: 'WORKOUT_LOGGED',
    points: XP_RULES.WORKOUT_LOGGED,
    reason: `Logged workout "${workout.name}"`,
    dedupeKey: `WORKOUT_LOGGED:${workout.id}`,
  };
}

export function journalEntryAward(entry: { id: string; dayKey: string }): XPAward {
  return {
    type: 'JOURNAL_ENTRY',
    points: XP_RULES.JOURNAL_ENTRY,
    reason: `Journaled on ${entry.dayKey}`,
    dedupeKey: `JOURNAL_ENTRY:${entry.id}`,
  };
}

export function achievementAward(achievement: { key: string; title: string }): XPAward {
  return {
    type: 'ACHIEVEMENT_UNLOCKED',
    points: XP_RULES.ACHIEVEMENT_UNLOCKED,
    reason: `Unlocked achievement "${achievement.title}"`,
    dedupeKey: `ACHIEVEMENT:${achievement.key}`,
  };
}
