import { describe, expect, it } from 'vitest';

import {
  ACHIEVEMENTS,
  ACHIEVEMENT_MAP,
  EMPTY_ACHIEVEMENT_STATS,
  achievementProgress,
  evaluateAchievements,
  getAchievement,
  type AchievementStats,
} from '@/lib/achievements';

function statsWith(overrides: Partial<AchievementStats>): AchievementStats {
  return { ...EMPTY_ACHIEVEMENT_STATS, ...overrides };
}

describe('achievement catalogue', () => {
  it('has unique keys', () => {
    const keys = ACHIEVEMENTS.map((achievement) => achievement.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has a positive threshold for every entry', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.threshold).toBeGreaterThan(0);
    }
  });

  it('is indexed by key', () => {
    expect(ACHIEVEMENT_MAP.size).toBe(ACHIEVEMENTS.length);
    expect(getAchievement('FIRST_TASK_COMPLETED')?.metric).toBe('tasksCompleted');
    expect(getAchievement('NOT_A_REAL_KEY')).toBeUndefined();
  });
});

describe('evaluateAchievements', () => {
  it('unlocks nothing for a brand-new account', () => {
    expect(evaluateAchievements(EMPTY_ACHIEVEMENT_STATS, [])).toEqual([]);
  });

  it('unlocks an achievement once its threshold is met', () => {
    const earned = evaluateAchievements(statsWith({ tasksCompleted: 1 }), []);
    expect(earned.map((achievement) => achievement.key)).toContain('FIRST_TASK_COMPLETED');
  });

  it('unlocks every tier crossed at once', () => {
    const earned = evaluateAchievements(statsWith({ tasksCompleted: 50 }), []);
    expect(earned.map((achievement) => achievement.key)).toEqual([
      'FIRST_TASK_COMPLETED',
      'TEN_TASKS_COMPLETED',
      'FIFTY_TASKS_COMPLETED',
    ]);
  });

  it('skips achievements that are already unlocked', () => {
    const earned = evaluateAchievements(statsWith({ tasksCompleted: 50 }), [
      'FIRST_TASK_COMPLETED',
      'TEN_TASKS_COMPLETED',
    ]);
    expect(earned.map((achievement) => achievement.key)).toEqual(['FIFTY_TASKS_COMPLETED']);
  });

  it('does not unlock an achievement one short of its threshold', () => {
    const earned = evaluateAchievements(statsWith({ longestHabitStreak: 6 }), []);
    const keys = earned.map((achievement) => achievement.key);
    expect(keys).toContain('THREE_DAY_HABIT_STREAK');
    expect(keys).not.toContain('SEVEN_DAY_HABIT_STREAK');
  });

  it('converts study minutes into the hour-based milestones', () => {
    const keys = evaluateAchievements(statsWith({ studySessions: 12, studyMinutes: 600 }), []).map(
      (achievement) => achievement.key,
    );
    expect(keys).toContain('FIRST_STUDY_SESSION');
    expect(keys).toContain('TEN_STUDY_HOURS');
    expect(keys).not.toContain('FIFTY_STUDY_HOURS');
  });

  it('uses level for progression achievements', () => {
    expect(evaluateAchievements(statsWith({ level: 5 }), []).map((a) => a.key)).toEqual([
      'LEVEL_5_REACHED',
    ]);
    expect(
      evaluateAchievements(statsWith({ level: 10 }), ['LEVEL_5_REACHED']).map((a) => a.key),
    ).toEqual(['LEVEL_10_REACHED']);
  });

  it('returns definitions in catalogue order', () => {
    const everything = statsWith({
      tasksCompleted: 999,
      projectsCompleted: 999,
      longestHabitStreak: 999,
      studySessions: 999,
      studyMinutes: 999_999,
      workouts: 999,
      journalEntries: 999,
      longestJournalStreak: 999,
      level: 999,
    });
    const earned = evaluateAchievements(everything, []);
    expect(earned).toHaveLength(ACHIEVEMENTS.length);
    expect(earned.map((a) => a.key)).toEqual(ACHIEVEMENTS.map((a) => a.key));
  });
});

describe('achievementProgress', () => {
  it('reports partial progress toward a threshold', () => {
    const achievement = getAchievement('TEN_TASKS_COMPLETED')!;
    expect(achievementProgress(achievement, statsWith({ tasksCompleted: 3 }))).toBe(30);
  });

  it('caps progress at 100', () => {
    const achievement = getAchievement('FIRST_TASK_COMPLETED')!;
    expect(achievementProgress(achievement, statsWith({ tasksCompleted: 42 }))).toBe(100);
  });

  it('reports 0 for an untouched metric', () => {
    const achievement = getAchievement('FIRST_WORKOUT')!;
    expect(achievementProgress(achievement, EMPTY_ACHIEVEMENT_STATS)).toBe(0);
  });
});
