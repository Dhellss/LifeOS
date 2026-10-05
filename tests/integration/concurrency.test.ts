import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/db';
import { getPreferences, updatePreferences } from '@/lib/services/preferences';
import { createTask, updateTask } from '@/lib/services/tasks';
import { getTotalXP } from '@/lib/services/xp';
import { XP_RULES } from '@/lib/xp';

import { createTestUser, deleteTestUsers } from './helpers';

/**
 * Races that a single-threaded test would never catch.
 *
 * Both cases below were real bugs. Lazily creating the preferences row with
 * `upsert` turned a fresh account's first dashboard load into a 500 whenever
 * two of its parallel reads both found the row missing; and XP awards have to
 * survive the same action arriving twice at once.
 */
describe('concurrent writes', () => {
  let userId: string;

  beforeEach(async () => {
    userId = await createTestUser('race');
  });

  afterEach(async () => {
    await deleteTestUsers(userId);
  });

  it('creates the preferences row exactly once under concurrent reads', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => getPreferences(userId)));

    // Every caller gets the defaults, and none of them throws.
    for (const preferences of results) {
      expect(preferences.dailyTaskGoal).toBe(5);
      expect(preferences.weekStartsOn).toBe(1);
    }

    expect(await prisma.userPreferences.count({ where: { userId } })).toBe(1);
  });

  it('survives a read racing an update on a user with no preferences row', async () => {
    const [, updated] = await Promise.all([
      getPreferences(userId),
      updatePreferences(userId, { dailyTaskGoal: 9 }),
      getPreferences(userId),
    ]);

    expect(updated.dailyTaskGoal).toBe(9);
    expect(await prisma.userPreferences.count({ where: { userId } })).toBe(1);
    expect((await getPreferences(userId)).dailyTaskGoal).toBe(9);
  });

  it('awards XP once when the same completion arrives concurrently', async () => {
    const task = await createTask(userId, { title: 'Raced to completion' });

    // Four simultaneous requests all marking the same task done.
    await Promise.all(
      Array.from({ length: 4 }, () => updateTask(userId, task.id, { status: 'DONE' })),
    );

    expect(await prisma.xPEvent.count({ where: { userId, type: 'TASK_COMPLETED' } })).toBe(1);
    expect(
      await prisma.xPEvent.aggregate({
        where: { userId, type: 'TASK_COMPLETED' },
        _sum: { points: true },
      }),
    ).toMatchObject({ _sum: { points: XP_RULES.TASK_COMPLETED } });
  });

  it('unlocks an achievement once when actions arrive concurrently', async () => {
    await Promise.all([
      createTask(userId, { title: 'A', status: 'DONE' }),
      createTask(userId, { title: 'B', status: 'DONE' }),
      createTask(userId, { title: 'C', status: 'DONE' }),
    ]);

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

    // Three task completions plus one achievement bonus.
    expect(await getTotalXP(userId)).toBe(
      XP_RULES.TASK_COMPLETED * 3 + XP_RULES.ACHIEVEMENT_UNLOCKED,
    );
  });
});
