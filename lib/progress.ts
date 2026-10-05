import type { TaskStatus } from '@prisma/client';

/**
 * Project progress derivation.
 *
 * Progress is always computed from the project's tasks rather than stored, so
 * it can never drift out of sync with the task table.
 */

export interface TaskProgressInput {
  status: TaskStatus;
}

export interface ProjectProgress {
  /** Tasks that count toward progress (everything except ARCHIVED). */
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  /** Archived tasks, excluded from the percentage. */
  archived: number;
  /** 0-100. A project with no countable tasks reports 0. */
  percent: number;
}

export const EMPTY_PROJECT_PROGRESS: ProjectProgress = {
  total: 0,
  completed: 0,
  inProgress: 0,
  todo: 0,
  archived: 0,
  percent: 0,
};

export function calculateProjectProgress(tasks: readonly TaskProgressInput[]): ProjectProgress {
  let completed = 0;
  let inProgress = 0;
  let todo = 0;
  let archived = 0;

  for (const task of tasks) {
    switch (task.status) {
      case 'DONE':
        completed += 1;
        break;
      case 'IN_PROGRESS':
        inProgress += 1;
        break;
      case 'TODO':
        todo += 1;
        break;
      case 'ARCHIVED':
        archived += 1;
        break;
    }
  }

  const total = completed + inProgress + todo;
  return {
    total,
    completed,
    inProgress,
    todo,
    archived,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

/** Completion rate across a task collection, 0-100. */
export function taskCompletionRate(tasks: readonly TaskProgressInput[]): number {
  return calculateProjectProgress(tasks).percent;
}
