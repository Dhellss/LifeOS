import { describe, expect, it } from 'vitest';
import type { TaskStatus } from '@prisma/client';

import {
  EMPTY_PROJECT_PROGRESS,
  calculateProjectProgress,
  taskCompletionRate,
} from '@/lib/progress';

const tasks = (...statuses: TaskStatus[]) => statuses.map((status) => ({ status }));

describe('calculateProjectProgress', () => {
  it('reports zero progress for a project with no tasks', () => {
    expect(calculateProjectProgress([])).toEqual(EMPTY_PROJECT_PROGRESS);
  });

  it('counts each status bucket', () => {
    const progress = calculateProjectProgress(
      tasks('DONE', 'DONE', 'IN_PROGRESS', 'TODO', 'ARCHIVED'),
    );
    expect(progress.completed).toBe(2);
    expect(progress.inProgress).toBe(1);
    expect(progress.todo).toBe(1);
    expect(progress.archived).toBe(1);
  });

  it('excludes archived tasks from the denominator', () => {
    // 2 done out of 4 countable tasks; the archived one is ignored entirely.
    const progress = calculateProjectProgress(
      tasks('DONE', 'DONE', 'TODO', 'IN_PROGRESS', 'ARCHIVED'),
    );
    expect(progress.total).toBe(4);
    expect(progress.percent).toBe(50);
  });

  it('reports 100% when every countable task is done', () => {
    expect(calculateProjectProgress(tasks('DONE', 'DONE')).percent).toBe(100);
  });

  it('reports 0% when a project holds only archived tasks', () => {
    const progress = calculateProjectProgress(tasks('ARCHIVED', 'ARCHIVED'));
    expect(progress.total).toBe(0);
    expect(progress.percent).toBe(0);
  });

  it('rounds to the nearest whole percent', () => {
    // 1 of 3 == 33.33%
    expect(calculateProjectProgress(tasks('DONE', 'TODO', 'TODO')).percent).toBe(33);
    // 2 of 3 == 66.67%
    expect(calculateProjectProgress(tasks('DONE', 'DONE', 'TODO')).percent).toBe(67);
  });
});

describe('taskCompletionRate', () => {
  it('matches the project progress percentage', () => {
    const list = tasks('DONE', 'TODO', 'TODO', 'ARCHIVED');
    expect(taskCompletionRate(list)).toBe(calculateProjectProgress(list).percent);
  });

  it('is zero for an empty list', () => {
    expect(taskCompletionRate([])).toBe(0);
  });
});
