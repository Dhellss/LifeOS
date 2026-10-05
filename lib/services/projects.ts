import type { Prisma, Project, Task } from '@prisma/client';

import { prisma } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { calculateProjectProgress, type ProjectProgress } from '@/lib/progress';
import {
  projectCreateSchema,
  projectFilterSchema,
  projectUpdateSchema,
} from '@/lib/validations/project';
import { projectCompletedAward, taskCompletedAward } from '@/lib/xp';

import { syncAchievements } from './achievements';
import { parseOrThrow } from './validate';
import { awardXP } from './xp';

/**
 * Project service.
 *
 * Progress is always derived from the project's tasks (see `lib/progress.ts`)
 * rather than stored, so it cannot drift out of sync with the task table.
 */

export interface ProjectWithProgress extends Project {
  progress: ProjectProgress;
  taskCount: number;
}

export type ProjectDetail = ProjectWithProgress & {
  tasks: Task[];
};

const progressTaskSelect = { select: { status: true } } as const;

function withProgress(
  project: Project & { tasks: { status: Task['status'] }[] },
): ProjectWithProgress {
  const { tasks, ...rest } = project;
  return { ...rest, progress: calculateProjectProgress(tasks), taskCount: tasks.length };
}

export async function listProjects(
  userId: string,
  rawFilter: unknown = {},
): Promise<ProjectWithProgress[]> {
  const filter = parseOrThrow(projectFilterSchema, rawFilter);

  const where: Prisma.ProjectWhereInput = { userId };
  if (filter.status) where.status = filter.status;
  if (filter.search) {
    where.OR = [
      { name: { contains: filter.search, mode: 'insensitive' } },
      { description: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.ProjectOrderByWithRelationInput =
    filter.sort === 'targetDate'
      ? { targetDate: { sort: filter.direction, nulls: 'last' } }
      : ({ [filter.sort]: filter.direction } as Prisma.ProjectOrderByWithRelationInput);

  const projects = await prisma.project.findMany({
    where,
    orderBy,
    include: { tasks: progressTaskSelect },
  });

  return projects.map(withProgress);
}

export async function getProject(userId: string, projectId: string): Promise<ProjectDetail> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: {
      tasks: {
        orderBy: [{ status: 'asc' }, { dueDate: { sort: 'asc', nulls: 'last' } }],
      },
    },
  });
  if (!project) throw new NotFoundError('Project');

  return {
    ...withProgress({ ...project, tasks: project.tasks }),
    tasks: project.tasks,
  };
}

export async function createProject(userId: string, input: unknown): Promise<ProjectWithProgress> {
  const data = parseOrThrow(projectCreateSchema, input);
  const isCompleted = data.status === 'COMPLETED';

  const project = await prisma.project.create({
    data: {
      userId,
      name: data.name,
      description: data.description,
      status: data.status,
      color: data.color,
      startDate: data.startDate,
      targetDate: data.targetDate,
      completedAt: isCompleted ? new Date() : null,
    },
    include: { tasks: progressTaskSelect },
  });

  if (isCompleted) await rewardCompletion(userId, project);
  return withProgress(project);
}

export async function updateProject(
  userId: string,
  projectId: string,
  input: unknown,
): Promise<ProjectWithProgress> {
  const data = parseOrThrow(projectUpdateSchema, input);
  const existing = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!existing) throw new NotFoundError('Project');

  // Guard the combined start/target window against partial updates.
  const startDate = data.startDate ?? existing.startDate;
  const targetDate = data.targetDate ?? existing.targetDate;
  if (startDate && targetDate && targetDate < startDate) {
    throw new ValidationError('The target date cannot be before the start date.', {
      targetDate: ['The target date cannot be before the start date.'],
    });
  }

  const nextStatus = data.status ?? existing.status;
  const completedAt = nextStatus === 'COMPLETED' ? (existing.completedAt ?? new Date()) : null;

  const project = await prisma.project.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      description: data.description,
      status: data.status,
      color: data.color,
      startDate: data.startDate,
      targetDate: data.targetDate,
      completedAt,
    },
    include: { tasks: progressTaskSelect },
  });

  if (nextStatus === 'COMPLETED' && existing.status !== 'COMPLETED') {
    await rewardCompletion(userId, project);
  }
  return withProgress(project);
}

/**
 * Completing a project also closes out its open tasks, so progress and the
 * dashboard's "today" list stay coherent.
 *
 * Each task closed this way earns its normal completion XP — closing a task
 * through the project shortcut is still completing it. The dedupe key means a
 * task that was already done is not rewarded twice.
 */
export async function completeProject(
  userId: string,
  projectId: string,
): Promise<ProjectWithProgress> {
  const existing = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!existing) throw new NotFoundError('Project');

  const openTasks = await prisma.task.findMany({
    where: { projectId: existing.id, userId, status: { in: ['TODO', 'IN_PROGRESS'] } },
    select: { id: true, title: true, priority: true },
  });

  const now = new Date();
  await prisma.$transaction([
    prisma.task.updateMany({
      where: { id: { in: openTasks.map((task) => task.id) } },
      data: { status: 'DONE', completedAt: now },
    }),
    prisma.project.update({
      where: { id: existing.id },
      data: { status: 'COMPLETED', completedAt: existing.completedAt ?? now },
    }),
  ]);

  for (const task of openTasks) {
    await awardXP(userId, taskCompletedAward(task));
  }
  await awardXP(userId, projectCompletedAward(existing));
  await syncAchievements(userId);

  const project = await prisma.project.findFirstOrThrow({
    where: { id: existing.id },
    include: { tasks: progressTaskSelect },
  });
  return withProgress(project);
}

export async function archiveProject(
  userId: string,
  projectId: string,
): Promise<ProjectWithProgress> {
  return updateProject(userId, projectId, { status: 'ARCHIVED' });
}

/** Deleting a project detaches its tasks (`onDelete: SetNull`) rather than deleting them. */
export async function deleteProject(userId: string, projectId: string): Promise<void> {
  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Project');
  await prisma.project.delete({ where: { id: existing.id } });
}

export interface ProjectStats {
  total: number;
  active: number;
  paused: number;
  completed: number;
  archived: number;
}

export async function getProjectStats(userId: string): Promise<ProjectStats> {
  const grouped = await prisma.project.groupBy({
    by: ['status'],
    where: { userId },
    _count: { _all: true },
  });
  const counts = new Map(grouped.map((row) => [row.status, row._count._all]));
  const active = counts.get('ACTIVE') ?? 0;
  const paused = counts.get('PAUSED') ?? 0;
  const completed = counts.get('COMPLETED') ?? 0;
  const archived = counts.get('ARCHIVED') ?? 0;
  return { total: active + paused + completed + archived, active, paused, completed, archived };
}

/** Active projects with progress, for the dashboard card. */
export async function getActiveProjects(userId: string, limit = 4): Promise<ProjectWithProgress[]> {
  const projects = await prisma.project.findMany({
    where: { userId, status: 'ACTIVE' },
    orderBy: [{ targetDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: limit,
    include: { tasks: progressTaskSelect },
  });
  return projects.map(withProgress);
}

/** Minimal `{ id, name, color }` list for the task form's project picker. */
export async function getProjectOptions(userId: string) {
  return prisma.project.findMany({
    where: { userId, status: { in: ['ACTIVE', 'PAUSED'] } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, color: true },
  });
}

async function rewardCompletion(userId: string, project: Project): Promise<void> {
  await awardXP(userId, projectCompletedAward(project));
  await syncAchievements(userId);
}
