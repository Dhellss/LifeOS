import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/db';
import { XP_RULES } from '@/lib/xp';
import { listAchievements } from '@/lib/services/achievements';
import { checkInHabit, createHabit, getHabit } from '@/lib/services/habits';
import { createJournalEntry } from '@/lib/services/journal';
import { completeProject, createProject, getProject } from '@/lib/services/projects';
import { createStudySession } from '@/lib/services/study';
import { createTask, toggleTaskCompletion, updateTask } from '@/lib/services/tasks';
import { getTotalXP } from '@/lib/services/xp';

import { createTestUser, dayKeyOffset, deleteTestUsers } from './helpers';

/**
 * XP earned from one source only.
 *
 * Totals are deliberately not used for per-rule assertions: unlocking an
 * achievement is itself XP-bearing, so a fresh user's first completed task
 * yields task XP *and* an achievement bonus. Filtering by type keeps each
 * assertion about the rule under test.
 */
async function xpFromType(
  userId: string,
  type:
    | 'TASK_COMPLETED'
    | 'PROJECT_COMPLETED'
    | 'HABIT_CHECKIN'
    | 'STUDY_SESSION'
    | 'WORKOUT_LOGGED'
    | 'JOURNAL_ENTRY'
    | 'ACHIEVEMENT_UNLOCKED',
) {
  const result = await prisma.xPEvent.aggregate({
    where: { userId, type },
    _sum: { points: true },
  });
  return result._sum.points ?? 0;
}

/**
 * Business rules that depend on the database: XP idempotency (backed by the
 * unique `(userId, dedupeKey)` index), one habit log per day, derived
 * `completedAt` timestamps and derived project progress.
 */
describe('XP and business rules', () => {
  let userId: string;

  beforeEach(async () => {
    userId = await createTestUser('xp');
  });

  afterEach(async () => {
    await deleteTestUsers(userId);
  });

  it('awards XP once when a task is completed', async () => {
    const task = await createTask(userId, { title: 'Finish the report', priority: 'HIGH' });
    expect(await getTotalXP(userId)).toBe(0);

    await updateTask(userId, task.id, { status: 'DONE' });
    expect(await xpFromType(userId, 'TASK_COMPLETED')).toBe(XP_RULES.TASK_COMPLETED);
  });

  it('awards the urgent bonus for urgent tasks', async () => {
    const task = await createTask(userId, { title: 'Hotfix', priority: 'URGENT' });
    await updateTask(userId, task.id, { status: 'DONE' });
    expect(await xpFromType(userId, 'TASK_COMPLETED')).toBe(XP_RULES.URGENT_TASK_COMPLETED);
  });

  it('does not award XP again when a completed task is re-completed', async () => {
    const task = await createTask(userId, { title: 'Toggle me' });

    await toggleTaskCompletion(userId, task.id); // -> DONE, awards XP
    const afterFirst = await getTotalXP(userId);
    expect(await xpFromType(userId, 'TASK_COMPLETED')).toBe(XP_RULES.TASK_COMPLETED);

    await toggleTaskCompletion(userId, task.id); // -> TODO
    await toggleTaskCompletion(userId, task.id); // -> DONE again
    await toggleTaskCompletion(userId, task.id); // -> TODO
    await toggleTaskCompletion(userId, task.id); // -> DONE again

    expect(await getTotalXP(userId)).toBe(afterFirst);
    expect(await prisma.xPEvent.count({ where: { userId, type: 'TASK_COMPLETED' } })).toBe(1);
  });

  it('awards XP for a task created directly in the DONE state', async () => {
    await createTask(userId, { title: 'Already done', status: 'DONE' });
    expect(await xpFromType(userId, 'TASK_COMPLETED')).toBe(XP_RULES.TASK_COMPLETED);
  });

  it('derives completedAt from the status transition', async () => {
    const task = await createTask(userId, { title: 'Timestamped' });
    expect(task.completedAt).toBeNull();

    const done = await updateTask(userId, task.id, { status: 'DONE' });
    expect(done.completedAt).toBeInstanceOf(Date);

    // Editing another field must not move the original completion timestamp.
    const renamed = await updateTask(userId, task.id, { title: 'Timestamped (edited)' });
    expect(renamed.completedAt?.getTime()).toBe(done.completedAt?.getTime());

    const reopened = await updateTask(userId, task.id, { status: 'TODO' });
    expect(reopened.completedAt).toBeNull();
  });

  it('scales study XP by duration and never rewards an edit', async () => {
    const { session, xpAwarded } = await createStudySession(userId, {
      subject: 'Compilers',
      durationMinutes: 90,
      sessionDate: new Date().toISOString(),
    });
    expect(xpAwarded).toBe(9);
    expect(await xpFromType(userId, 'STUDY_SESSION')).toBe(9);

    // Editing the duration must not retroactively change the award.
    const { updateStudySession } = await import('@/lib/services/study');
    await updateStudySession(userId, session.id, { durationMinutes: 600 });
    expect(await xpFromType(userId, 'STUDY_SESSION')).toBe(9);
  });

  it('applies the study minimum to short sessions', async () => {
    const { xpAwarded } = await createStudySession(userId, {
      subject: 'German',
      durationMinutes: 15,
      sessionDate: new Date().toISOString(),
    });
    expect(xpAwarded).toBe(XP_RULES.STUDY_MINIMUM);
  });

  it('awards habit XP once per day and allows the next day', async () => {
    const habit = await createHabit(userId, { name: 'Read' });

    const first = await checkInHabit(userId, { habitId: habit.id, date: dayKeyOffset(0) });
    expect(first.xpAwarded).toBe(XP_RULES.HABIT_CHECKIN);

    // Re-submitting the same day is idempotent.
    const repeat = await checkInHabit(userId, { habitId: habit.id, date: dayKeyOffset(0) });
    expect(repeat.xpAwarded).toBe(0);

    const yesterday = await checkInHabit(userId, { habitId: habit.id, date: dayKeyOffset(1) });
    expect(yesterday.xpAwarded).toBe(XP_RULES.HABIT_CHECKIN);

    expect(await xpFromType(userId, 'HABIT_CHECKIN')).toBe(XP_RULES.HABIT_CHECKIN * 2);
  });

  it('stores at most one habit log per day', async () => {
    const habit = await createHabit(userId, { name: 'Water', targetCount: 8 });
    const today = dayKeyOffset(0);

    await checkInHabit(userId, { habitId: habit.id, date: today, count: 3 });
    await checkInHabit(userId, { habitId: habit.id, date: today, count: 6 });
    await checkInHabit(userId, { habitId: habit.id, date: today, count: 8 });

    const logs = await prisma.habitLog.findMany({ where: { habitId: habit.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.count).toBe(8);
  });

  it('withholds habit XP until the target count is met', async () => {
    const habit = await createHabit(userId, { name: 'Water', targetCount: 8 });
    const today = dayKeyOffset(0);

    const partial = await checkInHabit(userId, { habitId: habit.id, date: today, count: 4 });
    expect(partial.xpAwarded).toBe(0);
    expect(partial.habit.completedToday).toBe(false);

    const complete = await checkInHabit(userId, { habitId: habit.id, date: today, count: 8 });
    expect(complete.xpAwarded).toBe(XP_RULES.HABIT_CHECKIN);
    expect(complete.habit.completedToday).toBe(true);
  });

  it('removes a check-in when count is zero without refunding XP', async () => {
    const habit = await createHabit(userId, { name: 'Stretch' });
    const today = dayKeyOffset(0);

    await checkInHabit(userId, { habitId: habit.id, date: today, count: 1 });
    const earned = await getTotalXP(userId);

    await checkInHabit(userId, { habitId: habit.id, date: today, count: 0 });
    const after = await getHabit(userId, habit.id);

    expect(after.todayCount).toBe(0);
    expect(after.completedToday).toBe(false);
    // XP already granted is history, not a balance that can be clawed back.
    expect(await getTotalXP(userId)).toBe(earned);
  });

  it('computes a habit streak from consecutive qualifying days', async () => {
    const habit = await createHabit(userId, { name: 'Flashcards' });
    for (const offset of [0, 1, 2, 3]) {
      await checkInHabit(userId, { habitId: habit.id, date: dayKeyOffset(offset) });
    }
    // A gap at offset 4, then an older isolated day.
    await checkInHabit(userId, { habitId: habit.id, date: dayKeyOffset(6) });

    const decorated = await getHabit(userId, habit.id);
    expect(decorated.streak.current).toBe(4);
    expect(decorated.streak.longest).toBe(4);
    expect(decorated.streak.completedToday).toBe(true);
  });

  it('awards project XP once and closes out open tasks on completion', async () => {
    const project = await createProject(userId, { name: 'Ship v1' });
    await createTask(userId, { title: 'Task 1', projectId: project.id });
    await createTask(userId, { title: 'Task 2', projectId: project.id, status: 'IN_PROGRESS' });
    await createTask(userId, { title: 'Task 3', projectId: project.id, status: 'DONE' });

    const completed = await completeProject(userId, project.id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.progress.percent).toBe(100);

    // The two open tasks were closed, so all three now carry task XP.
    expect(await xpFromType(userId, 'TASK_COMPLETED')).toBe(XP_RULES.TASK_COMPLETED * 3);
    expect(await xpFromType(userId, 'PROJECT_COMPLETED')).toBe(XP_RULES.PROJECT_COMPLETED);

    // Completing again must not award a second time.
    const xpAfterFirst = await getTotalXP(userId);
    await completeProject(userId, project.id);
    expect(await getTotalXP(userId)).toBe(xpAfterFirst);
    expect(await prisma.xPEvent.count({ where: { userId, type: 'PROJECT_COMPLETED' } })).toBe(1);
    expect(await prisma.xPEvent.count({ where: { userId, type: 'TASK_COMPLETED' } })).toBe(3);
  });

  it('derives project progress from its tasks rather than storing it', async () => {
    const project = await createProject(userId, { name: 'Derived' });
    await createTask(userId, { title: 'A', projectId: project.id, status: 'DONE' });
    await createTask(userId, { title: 'B', projectId: project.id });
    await createTask(userId, { title: 'C', projectId: project.id });
    await createTask(userId, { title: 'D', projectId: project.id, status: 'ARCHIVED' });

    const detail = await getProject(userId, project.id);
    // 1 of 3 countable tasks; the archived one is excluded.
    expect(detail.progress).toMatchObject({ total: 3, completed: 1, archived: 1, percent: 33 });
  });

  it('keeps tasks when their project is deleted', async () => {
    const project = await createProject(userId, { name: 'Doomed' });
    const task = await createTask(userId, { title: 'Survivor', projectId: project.id });

    const { deleteProject } = await import('@/lib/services/projects');
    await deleteProject(userId, project.id);

    const { getTask } = await import('@/lib/services/tasks');
    const survivor = await getTask(userId, task.id);
    expect(survivor.projectId).toBeNull();
    expect(survivor.title).toBe('Survivor');
  });

  it('awards journal XP per entry', async () => {
    const first = await createJournalEntry(userId, {
      content: 'Entry one',
      entryDate: new Date().toISOString(),
    });
    expect(first.xpAwarded).toBe(XP_RULES.JOURNAL_ENTRY);

    const second = await createJournalEntry(userId, {
      content: 'Entry two, same day',
      entryDate: new Date().toISOString(),
    });
    expect(second.xpAwarded).toBe(XP_RULES.JOURNAL_ENTRY);
  });

  it('unlocks achievements and awards their bonus XP exactly once', async () => {
    const task = await createTask(userId, { title: 'First ever task' });
    await updateTask(userId, task.id, { status: 'DONE' });

    const { achievements, unlockedCount } = await listAchievements(userId);
    const first = achievements.find((a) => a.key === 'FIRST_TASK_COMPLETED');
    expect(first?.unlocked).toBe(true);
    expect(unlockedCount).toBeGreaterThanOrEqual(1);

    // Task XP plus the achievement bonus: unlocking is itself XP-bearing.
    expect(await getTotalXP(userId)).toBe(XP_RULES.TASK_COMPLETED + XP_RULES.ACHIEVEMENT_UNLOCKED);

    // Completing more tasks must not re-award the same achievement.
    const second = await createTask(userId, { title: 'Second task' });
    await updateTask(userId, second.id, { status: 'DONE' });
    expect(
      await prisma.userAchievement.count({
        where: { userId, achievementKey: 'FIRST_TASK_COMPLETED' },
      }),
    ).toBe(1);
    expect(
      await prisma.xPEvent.count({
        where: { userId, dedupeKey: 'ACHIEVEMENT:FIRST_TASK_COMPLETED' },
      }),
    ).toBe(1);
  });
});
