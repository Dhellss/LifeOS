import { describe, expect, it } from 'vitest';

import {
  XP_PER_LEVEL,
  XP_RULES,
  achievementAward,
  habitCheckinAward,
  journalEntryAward,
  levelFromXP,
  levelProgress,
  projectCompletedAward,
  studySessionAward,
  studySessionXP,
  taskCompletedAward,
  taskCompletionXP,
  workoutAward,
  xpForLevel,
} from '@/lib/xp';

describe('levelFromXP', () => {
  it('starts everyone at level 1', () => {
    expect(levelFromXP(0)).toBe(1);
    expect(levelFromXP(1)).toBe(1);
    expect(levelFromXP(99)).toBe(1);
  });

  it('advances one level per 100 XP', () => {
    expect(levelFromXP(100)).toBe(2);
    expect(levelFromXP(199)).toBe(2);
    expect(levelFromXP(200)).toBe(3);
    expect(levelFromXP(1_000)).toBe(11);
  });

  it('never returns a level below 1 for invalid input', () => {
    expect(levelFromXP(-50)).toBe(1);
    expect(levelFromXP(Number.NaN)).toBe(1);
    expect(levelFromXP(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('xpForLevel', () => {
  it('is the inverse of levelFromXP at each boundary', () => {
    for (let level = 1; level <= 20; level += 1) {
      const threshold = xpForLevel(level);
      expect(levelFromXP(threshold)).toBe(level);
      if (level > 1) expect(levelFromXP(threshold - 1)).toBe(level - 1);
    }
  });

  it('clamps non-positive levels to the level 1 threshold', () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(-3)).toBe(0);
  });
});

describe('levelProgress', () => {
  it('reports progress inside the current level', () => {
    expect(levelProgress(0)).toEqual({
      level: 1,
      totalXP: 0,
      xpIntoLevel: 0,
      xpForNextLevel: XP_PER_LEVEL,
      xpRemaining: 100,
      progressPercent: 0,
    });
  });

  it('reports a partially completed level', () => {
    const progress = levelProgress(265);
    expect(progress.level).toBe(3);
    expect(progress.xpIntoLevel).toBe(65);
    expect(progress.xpRemaining).toBe(35);
    expect(progress.progressPercent).toBe(65);
  });

  it('treats a fresh level as 0% progress rather than 100%', () => {
    const progress = levelProgress(300);
    expect(progress.level).toBe(4);
    expect(progress.xpIntoLevel).toBe(0);
    expect(progress.progressPercent).toBe(0);
  });

  it('floors fractional and negative totals', () => {
    expect(levelProgress(150.9).xpIntoLevel).toBe(50);
    expect(levelProgress(-10).totalXP).toBe(0);
    expect(levelProgress(Number.NaN).level).toBe(1);
  });
});

describe('taskCompletionXP', () => {
  it('awards the urgent bonus only for URGENT tasks', () => {
    expect(taskCompletionXP('URGENT')).toBe(XP_RULES.URGENT_TASK_COMPLETED);
    expect(taskCompletionXP('HIGH')).toBe(XP_RULES.TASK_COMPLETED);
    expect(taskCompletionXP('MEDIUM')).toBe(XP_RULES.TASK_COMPLETED);
    expect(taskCompletionXP('LOW')).toBe(XP_RULES.TASK_COMPLETED);
  });
});

describe('studySessionXP', () => {
  it('awards 1 XP per full 10 minutes', () => {
    expect(studySessionXP(60)).toBe(6);
    expect(studySessionXP(95)).toBe(9);
    expect(studySessionXP(120)).toBe(12);
  });

  it('applies the minimum award to short sessions', () => {
    expect(studySessionXP(1)).toBe(XP_RULES.STUDY_MINIMUM);
    expect(studySessionXP(10)).toBe(XP_RULES.STUDY_MINIMUM);
    expect(studySessionXP(49)).toBe(XP_RULES.STUDY_MINIMUM);
    // 50 minutes earns exactly the minimum, 60 is the first to exceed it.
    expect(studySessionXP(50)).toBe(5);
    expect(studySessionXP(51)).toBe(5);
  });

  it('awards nothing for non-positive or invalid durations', () => {
    expect(studySessionXP(0)).toBe(0);
    expect(studySessionXP(-30)).toBe(0);
    expect(studySessionXP(Number.NaN)).toBe(0);
  });
});

describe('award builders', () => {
  it('derives a stable dedupe key per task', () => {
    const award = taskCompletedAward({ id: 'task_1', title: 'Ship it', priority: 'URGENT' });
    expect(award).toMatchObject({
      type: 'TASK_COMPLETED',
      points: 20,
      dedupeKey: 'TASK_COMPLETED:task_1',
    });
    expect(award.reason).toContain('Ship it');
  });

  it('derives the same key for the same task regardless of priority changes', () => {
    const first = taskCompletedAward({ id: 'task_1', title: 'A', priority: 'LOW' });
    const second = taskCompletedAward({ id: 'task_1', title: 'A renamed', priority: 'URGENT' });
    expect(first.dedupeKey).toBe(second.dedupeKey);
  });

  it('keys habit check-ins by habit and day so one per day is rewarded', () => {
    const monday = habitCheckinAward({
      habitId: 'habit_1',
      dayKey: '2026-03-02',
      habitName: 'Read',
    });
    const tuesday = habitCheckinAward({
      habitId: 'habit_1',
      dayKey: '2026-03-03',
      habitName: 'Read',
    });
    expect(monday.dedupeKey).toBe('HABIT_CHECKIN:habit_1:2026-03-02');
    expect(monday.dedupeKey).not.toBe(tuesday.dedupeKey);
    expect(monday.points).toBe(XP_RULES.HABIT_CHECKIN);
  });

  it('builds project, study, workout, journal and achievement awards', () => {
    expect(projectCompletedAward({ id: 'p1', name: 'Site' })).toMatchObject({
      type: 'PROJECT_COMPLETED',
      points: XP_RULES.PROJECT_COMPLETED,
      dedupeKey: 'PROJECT_COMPLETED:p1',
    });
    expect(studySessionAward({ id: 's1', subject: 'Maths', durationMinutes: 90 })).toMatchObject({
      type: 'STUDY_SESSION',
      points: 9,
      dedupeKey: 'STUDY_SESSION:s1',
    });
    expect(workoutAward({ id: 'w1', name: 'Legs' })).toMatchObject({
      type: 'WORKOUT_LOGGED',
      points: XP_RULES.WORKOUT_LOGGED,
      dedupeKey: 'WORKOUT_LOGGED:w1',
    });
    expect(journalEntryAward({ id: 'j1', dayKey: '2026-03-02' })).toMatchObject({
      type: 'JOURNAL_ENTRY',
      points: XP_RULES.JOURNAL_ENTRY,
      dedupeKey: 'JOURNAL_ENTRY:j1',
    });
    expect(achievementAward({ key: 'FIRST_TASK_COMPLETED', title: 'First Blood' })).toMatchObject({
      type: 'ACHIEVEMENT_UNLOCKED',
      points: XP_RULES.ACHIEVEMENT_UNLOCKED,
      dedupeKey: 'ACHIEVEMENT:FIRST_TASK_COMPLETED',
    });
  });
});
