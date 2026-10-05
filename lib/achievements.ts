/**
 * Achievement catalogue.
 *
 * Definitions live in code (they are product content, not user data) while
 * unlocked state is persisted in `UserAchievement`. Each definition declares
 * the metric it watches and the threshold that unlocks it, so the evaluator in
 * `lib/services/achievements.ts` stays a single generic loop.
 */

export const ACHIEVEMENT_METRICS = [
  'tasksCompleted',
  'projectsCompleted',
  'longestHabitStreak',
  'studySessions',
  'studyMinutes',
  'workouts',
  'journalEntries',
  'longestJournalStreak',
  'level',
] as const;

export type AchievementMetric = (typeof ACHIEVEMENT_METRICS)[number];

export type AchievementCategory =
  'tasks' | 'projects' | 'habits' | 'study' | 'fitness' | 'journal' | 'progression';

export interface AchievementDefinition {
  key: string;
  title: string;
  description: string;
  category: AchievementCategory;
  /** Lucide icon name, resolved by the achievements UI. */
  icon: string;
  metric: AchievementMetric;
  threshold: number;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    key: 'FIRST_TASK_COMPLETED',
    title: 'First Blood',
    description: 'Complete your very first task.',
    category: 'tasks',
    icon: 'CheckCircle2',
    metric: 'tasksCompleted',
    threshold: 1,
  },
  {
    key: 'TEN_TASKS_COMPLETED',
    title: 'Getting Things Done',
    description: 'Complete 10 tasks.',
    category: 'tasks',
    icon: 'ListChecks',
    metric: 'tasksCompleted',
    threshold: 10,
  },
  {
    key: 'FIFTY_TASKS_COMPLETED',
    title: 'Task Machine',
    description: 'Complete 50 tasks.',
    category: 'tasks',
    icon: 'Zap',
    metric: 'tasksCompleted',
    threshold: 50,
  },
  {
    key: 'PROJECT_COMPLETED',
    title: 'Shipped It',
    description: 'Mark a project as completed.',
    category: 'projects',
    icon: 'Rocket',
    metric: 'projectsCompleted',
    threshold: 1,
  },
  {
    key: 'THREE_PROJECTS_COMPLETED',
    title: 'Serial Shipper',
    description: 'Complete 3 projects.',
    category: 'projects',
    icon: 'Trophy',
    metric: 'projectsCompleted',
    threshold: 3,
  },
  {
    key: 'THREE_DAY_HABIT_STREAK',
    title: 'Momentum',
    description: 'Keep a habit going for 3 days in a row.',
    category: 'habits',
    icon: 'Flame',
    metric: 'longestHabitStreak',
    threshold: 3,
  },
  {
    key: 'SEVEN_DAY_HABIT_STREAK',
    title: 'Week Warrior',
    description: 'Keep a habit going for 7 days in a row.',
    category: 'habits',
    icon: 'Flame',
    metric: 'longestHabitStreak',
    threshold: 7,
  },
  {
    key: 'THIRTY_DAY_HABIT_STREAK',
    title: 'Unbreakable',
    description: 'Keep a habit going for 30 days in a row.',
    category: 'habits',
    icon: 'ShieldCheck',
    metric: 'longestHabitStreak',
    threshold: 30,
  },
  {
    key: 'FIRST_STUDY_SESSION',
    title: 'Open Book',
    description: 'Log your first study session.',
    category: 'study',
    icon: 'BookOpen',
    metric: 'studySessions',
    threshold: 1,
  },
  {
    key: 'TEN_STUDY_HOURS',
    title: 'Deep Work',
    description: 'Accumulate 10 hours of study time.',
    category: 'study',
    icon: 'GraduationCap',
    metric: 'studyMinutes',
    threshold: 600,
  },
  {
    key: 'FIFTY_STUDY_HOURS',
    title: 'Scholar',
    description: 'Accumulate 50 hours of study time.',
    category: 'study',
    icon: 'Library',
    metric: 'studyMinutes',
    threshold: 3000,
  },
  {
    key: 'FIRST_WORKOUT',
    title: 'Day One',
    description: 'Log your first workout.',
    category: 'fitness',
    icon: 'Dumbbell',
    metric: 'workouts',
    threshold: 1,
  },
  {
    key: 'TWENTY_WORKOUTS',
    title: 'Consistent Athlete',
    description: 'Log 20 workouts.',
    category: 'fitness',
    icon: 'HeartPulse',
    metric: 'workouts',
    threshold: 20,
  },
  {
    key: 'FIRST_JOURNAL_ENTRY',
    title: 'Dear Diary',
    description: 'Write your first journal entry.',
    category: 'journal',
    icon: 'NotebookPen',
    metric: 'journalEntries',
    threshold: 1,
  },
  {
    key: 'JOURNAL_STREAK_7',
    title: 'Reflective',
    description: 'Journal 7 days in a row.',
    category: 'journal',
    icon: 'Sparkles',
    metric: 'longestJournalStreak',
    threshold: 7,
  },
  {
    key: 'LEVEL_5_REACHED',
    title: 'Level 5',
    description: 'Reach level 5.',
    category: 'progression',
    icon: 'Star',
    metric: 'level',
    threshold: 5,
  },
  {
    key: 'LEVEL_10_REACHED',
    title: 'Level 10',
    description: 'Reach level 10.',
    category: 'progression',
    icon: 'Crown',
    metric: 'level',
    threshold: 10,
  },
] as const;

export const ACHIEVEMENT_MAP: ReadonlyMap<string, AchievementDefinition> = new Map(
  ACHIEVEMENTS.map((achievement) => [achievement.key, achievement]),
);

export function getAchievement(key: string): AchievementDefinition | undefined {
  return ACHIEVEMENT_MAP.get(key);
}

/** Snapshot of every metric the catalogue can test against. */
export type AchievementStats = Record<AchievementMetric, number>;

export const EMPTY_ACHIEVEMENT_STATS: AchievementStats = {
  tasksCompleted: 0,
  projectsCompleted: 0,
  longestHabitStreak: 0,
  studySessions: 0,
  studyMinutes: 0,
  workouts: 0,
  journalEntries: 0,
  longestJournalStreak: 0,
  level: 1,
};

/**
 * Pure evaluator: given a stats snapshot and the keys already unlocked, return
 * the definitions that should now be unlocked (in catalogue order).
 */
export function evaluateAchievements(
  stats: AchievementStats,
  alreadyUnlocked: Iterable<string>,
): AchievementDefinition[] {
  const unlocked = new Set(alreadyUnlocked);
  return ACHIEVEMENTS.filter(
    (achievement) =>
      !unlocked.has(achievement.key) && stats[achievement.metric] >= achievement.threshold,
  );
}

/** Progress toward a single achievement, 0-100. */
export function achievementProgress(
  achievement: AchievementDefinition,
  stats: AchievementStats,
): number {
  if (achievement.threshold <= 0) return 100;
  const value = stats[achievement.metric];
  return Math.min(100, Math.round((value / achievement.threshold) * 100));
}
