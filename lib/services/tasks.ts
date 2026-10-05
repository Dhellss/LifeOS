import type { Prisma, Task, TaskStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import {
  taskCreateSchema,
  taskFilterSchema,
  taskUpdateSchema,
  type TaskCreateInput,
  type TaskFilterInput,
  type TaskUpdateInput,
} from '@/lib/validations/task';
import { taskCompletedAward } from '@/lib/xp';

import { syncAchievements } from './achievements';
import { parseOrThrow } from './validate';
import { awardXP } from './xp';

/**
 * Task service.
 *
 * Every query is scoped by `userId`, so a caller can never read or mutate
 * another user's rows even when handed a valid foreign id.
 */

export type TaskWithProject = Task & {
  project: { id: string; name: string; color: string | null } | null;
};

const projectSelect = { select: { id: true, name: true, color: true } } as const;

function buildOrderBy(filter: TaskFilterInput): Prisma.TaskOrderByWithRelationInput[] {
  const { sort, direction } = filter;
  if (sort === 'dueDate') {
    // Undated tasks sort last regardless of direction.
    return [{ dueDate: { sort: direction, nulls: 'last' } }, { createdAt: 'desc' }];
  }
  if (sort === 'priority') {
    // The enum is declared LOW -> URGENT, so descending puts URGENT first.
    return [
      { priority: direction === 'asc' ? 'desc' : 'asc' },
      { dueDate: { sort: 'asc', nulls: 'last' } },
    ];
  }
  return [{ [sort]: direction } as Prisma.TaskOrderByWithRelationInput];
}

function buildWhere(userId: string, filter: TaskFilterInput): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = { userId };

  if (filter.status) {
    where.status = filter.status;
  } else if (!filter.includeArchived) {
    where.status = { not: 'ARCHIVED' };
  }

  if (filter.priority) where.priority = filter.priority;
  if (filter.projectId) where.projectId = filter.projectId;
  if (filter.search) {
    where.OR = [
      { title: { contains: filter.search, mode: 'insensitive' } },
      { description: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

export async function listTasks(
  userId: string,
  rawFilter: unknown = {},
): Promise<TaskWithProject[]> {
  const filter = parseOrThrow(taskFilterSchema, rawFilter);
  return prisma.task.findMany({
    where: buildWhere(userId, filter),
    orderBy: buildOrderBy(filter),
    include: { project: projectSelect },
  });
}

export async function getTask(userId: string, taskId: string): Promise<TaskWithProject> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    include: { project: projectSelect },
  });
  if (!task) throw new NotFoundError('Task');
  return task;
}

/** Guard that a referenced project belongs to the same user. */
async function assertProjectOwnership(userId: string, projectId: string | null | undefined) {
  if (!projectId) return;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw new NotFoundError('Project');
}

export async function createTask(userId: string, input: unknown): Promise<TaskWithProject> {
  const data = parseOrThrow(taskCreateSchema, input) satisfies TaskCreateInput;
  await assertProjectOwnership(userId, data.projectId);

  const isDone = data.status === 'DONE';
  const task = await prisma.task.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate,
      projectId: data.projectId,
      completedAt: isDone ? new Date() : null,
    },
    include: { project: projectSelect },
  });

  if (isDone) await rewardCompletion(userId, task);
  return task;
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: unknown,
): Promise<TaskWithProject> {
  const data = parseOrThrow(taskUpdateSchema, input) satisfies TaskUpdateInput;
  const existing = await getTask(userId, taskId);

  if (data.projectId !== undefined) await assertProjectOwnership(userId, data.projectId);

  const nextStatus: TaskStatus = data.status ?? existing.status;
  const completedAt = resolveCompletedAt(existing.status, nextStatus, existing.completedAt);

  const task = await prisma.task.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate,
      projectId: data.projectId,
      completedAt,
    },
    include: { project: projectSelect },
  });

  if (nextStatus === 'DONE' && existing.status !== 'DONE') {
    await rewardCompletion(userId, task);
  }
  return task;
}

/**
 * Convenience wrapper used by the task list's checkbox. Toggling a done task
 * back to TODO clears `completedAt` but never revokes XP already granted — the
 * `dedupeKey` guarantees re-completing it does not grant XP twice.
 */
export async function toggleTaskCompletion(
  userId: string,
  taskId: string,
): Promise<TaskWithProject> {
  const existing = await getTask(userId, taskId);
  return updateTask(userId, taskId, { status: existing.status === 'DONE' ? 'TODO' : 'DONE' });
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  const existing = await getTask(userId, taskId);
  await prisma.task.delete({ where: { id: existing.id } });
}

// ---------------------------------------------------------------------------
// Dashboard + analytics reads
// ---------------------------------------------------------------------------

export async function getTasksDueBetween(
  userId: string,
  range: { start: Date; end: Date },
): Promise<TaskWithProject[]> {
  return prisma.task.findMany({
    where: {
      userId,
      status: { notIn: ['ARCHIVED'] },
      dueDate: { gte: range.start, lte: range.end },
    },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    include: { project: projectSelect },
  });
}

export async function getOverdueTasks(userId: string, before: Date): Promise<TaskWithProject[]> {
  return prisma.task.findMany({
    where: {
      userId,
      status: { notIn: ['DONE', 'ARCHIVED'] },
      dueDate: { lt: before },
    },
    orderBy: [{ dueDate: 'asc' }],
    include: { project: projectSelect },
  });
}

export interface TaskStats {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  archived: number;
  completionRate: number;
  overdue: number;
}

export async function getTaskStats(userId: string): Promise<TaskStats> {
  const [grouped, overdue] = await Promise.all([
    prisma.task.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),
    prisma.task.count({
      where: {
        userId,
        status: { notIn: ['DONE', 'ARCHIVED'] },
        dueDate: { lt: new Date() },
      },
    }),
  ]);

  const counts = new Map(grouped.map((row) => [row.status, row._count._all]));
  const todo = counts.get('TODO') ?? 0;
  const inProgress = counts.get('IN_PROGRESS') ?? 0;
  const done = counts.get('DONE') ?? 0;
  const archived = counts.get('ARCHIVED') ?? 0;
  const countable = todo + inProgress + done;

  return {
    total: countable + archived,
    todo,
    inProgress,
    done,
    archived,
    completionRate: countable === 0 ? 0 : Math.round((done / countable) * 100),
    overdue,
  };
}

export async function getCompletedTasksBetween(
  userId: string,
  range: { start: Date; end: Date },
): Promise<{ completedAt: Date | null; priority: string }[]> {
  return prisma.task.findMany({
    where: { userId, status: 'DONE', completedAt: { gte: range.start, lte: range.end } },
    orderBy: { completedAt: 'asc' },
    select: { completedAt: true, priority: true },
  });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * `completedAt` is derived from the status transition rather than trusted from
 * the client: entering DONE stamps it, leaving DONE clears it, and staying in
 * DONE preserves the original timestamp.
 */
function resolveCompletedAt(
  previous: TaskStatus,
  next: TaskStatus,
  current: Date | null,
): Date | null {
  if (next === 'DONE') return previous === 'DONE' ? current : new Date();
  return null;
}

async function rewardCompletion(userId: string, task: Task): Promise<void> {
  await awardXP(userId, taskCompletedAward(task));
  await syncAchievements(userId);
}
