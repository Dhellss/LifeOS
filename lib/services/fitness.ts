import type { Prisma, Workout, WorkoutExercise } from '@prisma/client';

import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { toDayKey, trailingDayRange, weekRange, type DayKey } from '@/lib/dates';
import { workoutCreateSchema, workoutUpdateSchema } from '@/lib/validations/fitness';
import { workoutAward } from '@/lib/xp';

import { syncAchievements } from './achievements';
import { parseOrThrow } from './validate';
import { awardXP } from './xp';

/**
 * Fitness service.
 *
 * A workout owns its exercise rows; updates replace the whole exercise list
 * inside a transaction so the UI's repeatable form rows map cleanly onto the
 * database without client-side diffing.
 */

export type WorkoutWithExercises = Workout & { exercises: WorkoutExercise[] };

const exerciseInclude = { exercises: { orderBy: { position: 'asc' } } } as const;

export interface WorkoutListFilter {
  from?: Date;
  to?: Date;
  limit?: number;
}

export async function listWorkouts(
  userId: string,
  filter: WorkoutListFilter = {},
): Promise<WorkoutWithExercises[]> {
  const where: Prisma.WorkoutWhereInput = { userId };
  if (filter.from || filter.to) {
    where.workoutDate = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }

  return prisma.workout.findMany({
    where,
    orderBy: [{ workoutDate: 'desc' }, { createdAt: 'desc' }],
    include: exerciseInclude,
    ...(filter.limit ? { take: filter.limit } : {}),
  });
}

export async function getWorkout(userId: string, id: string): Promise<WorkoutWithExercises> {
  const workout = await prisma.workout.findFirst({
    where: { id, userId },
    include: exerciseInclude,
  });
  if (!workout) throw new NotFoundError('Workout');
  return workout;
}

export async function createWorkout(
  userId: string,
  input: unknown,
): Promise<{ workout: WorkoutWithExercises; xpAwarded: number }> {
  const data = parseOrThrow(workoutCreateSchema, input);

  const workout = await prisma.workout.create({
    data: {
      userId,
      name: data.name,
      workoutDate: data.workoutDate,
      durationMinutes: data.durationMinutes,
      notes: data.notes,
      exercises: {
        create: data.exercises.map((exercise, index) => ({
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          weight: exercise.weight,
          durationSeconds: exercise.durationSeconds,
          notes: exercise.notes,
          position: index,
        })),
      },
    },
    include: exerciseInclude,
  });

  const result = await awardXP(userId, workoutAward(workout));
  await syncAchievements(userId);
  return { workout, xpAwarded: result.points };
}

export async function updateWorkout(
  userId: string,
  id: string,
  input: unknown,
): Promise<WorkoutWithExercises> {
  const data = parseOrThrow(workoutUpdateSchema, input);
  const existing = await prisma.workout.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Workout');

  return prisma.$transaction(async (tx) => {
    await tx.workout.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        workoutDate: data.workoutDate,
        durationMinutes: data.durationMinutes,
        notes: data.notes,
      },
    });

    // `exercises: undefined` means "leave them alone"; an array replaces them.
    if (data.exercises) {
      await tx.workoutExercise.deleteMany({ where: { workoutId: existing.id } });
      if (data.exercises.length > 0) {
        await tx.workoutExercise.createMany({
          data: data.exercises.map((exercise, index) => ({
            workoutId: existing.id,
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            weight: exercise.weight,
            durationSeconds: exercise.durationSeconds,
            notes: exercise.notes,
            position: index,
          })),
        });
      }
    }

    return tx.workout.findFirstOrThrow({
      where: { id: existing.id },
      include: exerciseInclude,
    });
  });
}

export async function deleteWorkout(userId: string, id: string): Promise<void> {
  const existing = await prisma.workout.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Workout');
  await prisma.workout.delete({ where: { id: existing.id } });
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

export interface FitnessSummary {
  weekCount: number;
  weekMinutes: number;
  totalCount: number;
  totalMinutes: number;
  averageDurationMinutes: number;
  /** Total `sets * (reps ?? 1)` across every logged exercise. */
  totalVolume: number;
}

export async function getFitnessSummary(userId: string): Promise<FitnessSummary> {
  const week = weekRange();
  const [weekAgg, totalAgg, exercises] = await Promise.all([
    prisma.workout.aggregate({
      where: { userId, workoutDate: { gte: week.start, lte: week.end } },
      _count: { _all: true },
      _sum: { durationMinutes: true },
    }),
    prisma.workout.aggregate({
      where: { userId },
      _count: { _all: true },
      _sum: { durationMinutes: true },
      _avg: { durationMinutes: true },
    }),
    prisma.workoutExercise.findMany({
      where: { workout: { userId } },
      select: { sets: true, reps: true },
    }),
  ]);

  return {
    weekCount: weekAgg._count._all,
    weekMinutes: weekAgg._sum.durationMinutes ?? 0,
    totalCount: totalAgg._count._all,
    totalMinutes: totalAgg._sum.durationMinutes ?? 0,
    averageDurationMinutes: Math.round(totalAgg._avg.durationMinutes ?? 0),
    totalVolume: exercises.reduce((sum, e) => sum + e.sets * (e.reps ?? 1), 0),
  };
}

/** Workouts per ISO week over the trailing `weeks` weeks. */
export async function getWorkoutsByWeek(
  userId: string,
  weeks = 12,
): Promise<{ weekStart: DayKey; count: number; minutes: number }[]> {
  const range = trailingDayRange(weeks * 7);
  const workouts = await prisma.workout.findMany({
    where: { userId, workoutDate: { gte: range.start, lte: range.end } },
    select: { workoutDate: true, durationMinutes: true },
  });

  const buckets = new Map<DayKey, { count: number; minutes: number }>();
  const cursor = startOfWeekLocal(range.start);
  while (cursor <= range.end) {
    buckets.set(toDayKey(cursor), { count: 0, minutes: 0 });
    cursor.setDate(cursor.getDate() + 7);
  }

  for (const workout of workouts) {
    const key = toDayKey(startOfWeekLocal(workout.workoutDate));
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.minutes += workout.durationMinutes ?? 0;
    }
  }

  return [...buckets.entries()].map(([weekStart, bucket]) => ({ weekStart, ...bucket }));
}

/** Per-exercise history: how often it appears and the heaviest weight used. */
export async function getExerciseHistory(
  userId: string,
): Promise<{ name: string; occurrences: number; totalSets: number; maxWeight: number | null }[]> {
  const rows = await prisma.workoutExercise.groupBy({
    by: ['name'],
    where: { workout: { userId } },
    _count: { _all: true },
    _sum: { sets: true },
    _max: { weight: true },
  });

  return rows
    .map((row) => ({
      name: row.name,
      occurrences: row._count._all,
      totalSets: row._sum.sets ?? 0,
      maxWeight: row._max.weight ?? null,
    }))
    .sort((a, b) => b.occurrences - a.occurrences);
}

/** Monday-start week boundary, matching `lib/dates.WEEK_STARTS_ON`. */
function startOfWeekLocal(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}
