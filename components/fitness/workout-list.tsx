'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Dumbbell, Pencil, Trash2 } from 'lucide-react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { WorkoutDialog } from '@/components/fitness/workout-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api-client';
import { cn, formatMinutes } from '@/lib/utils';
import type { WorkoutWithExercises } from '@/lib/services/fitness';

export interface WorkoutListProps {
  workouts: WorkoutWithExercises[];
  emptyAction?: React.ReactNode;
}

export function WorkoutList({ workouts, emptyAction }: WorkoutListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  async function handleDelete(workout: WorkoutWithExercises) {
    try {
      await api.delete(`/api/fitness/${workout.id}`);
      toast({ title: 'Workout deleted', variant: 'success' });
      startTransition(() => router.refresh());
    } catch (error) {
      toast({
        title: 'Could not delete the workout',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  if (workouts.length === 0) {
    return (
      <EmptyState
        icon={Dumbbell}
        title="No workouts logged"
        description="Record a session with its exercises to build up your weekly count and history."
        action={emptyAction}
      />
    );
  }

  return (
    <ul className={cn('space-y-3 transition-opacity', isPending && 'opacity-60')}>
      {workouts.map((workout) => (
        <li key={workout.id} className="rounded-lg border border-border bg-card">
          <div className="flex items-start gap-3 border-b border-border px-4 py-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-chart-2/15 text-chart-2">
              <Dumbbell className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{workout.name}</p>
                {workout.durationMinutes ? (
                  <Badge variant="muted">
                    <Clock className="h-3 w-3" />
                    {formatMinutes(workout.durationMinutes)}
                  </Badge>
                ) : null}
                <Badge variant="outline">
                  {workout.exercises.length} exercise{workout.exercises.length === 1 ? '' : 's'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(workout.workoutDate).toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
              {workout.notes ? (
                <p className="text-xs text-muted-foreground">{workout.notes}</p>
              ) : null}
            </div>

            <WorkoutDialog
              workout={{
                id: workout.id,
                name: workout.name,
                workoutDate: workout.workoutDate,
                durationMinutes: workout.durationMinutes,
                notes: workout.notes,
                exercises: workout.exercises.map((exercise) => ({
                  name: exercise.name,
                  sets: exercise.sets,
                  reps: exercise.reps,
                  weight: exercise.weight,
                  notes: exercise.notes,
                })),
              }}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${workout.name}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
              }
            />

            <ConfirmDialog
              title="Delete this workout?"
              description={`"${workout.name}" and its exercises will be permanently removed.`}
              confirmLabel="Delete workout"
              onConfirm={() => handleDelete(workout)}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${workout.name}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              }
            />
          </div>

          {workout.exercises.length > 0 ? (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Exercises in {workout.name}</caption>
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-2 text-left font-medium">
                      Exercise
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Sets
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Reps
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Weight
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {workout.exercises.map((exercise) => (
                    <tr key={exercise.id} className="border-t border-border/60">
                      <td className="px-4 py-2">
                        {exercise.name}
                        {exercise.notes ? (
                          <span className="block text-xs text-muted-foreground">
                            {exercise.notes}
                          </span>
                        ) : null}
                      </td>
                      <td className="tabular px-3 py-2 text-right">{exercise.sets}</td>
                      <td className="tabular px-3 py-2 text-right">{exercise.reps ?? '—'}</td>
                      <td className="tabular px-4 py-2 text-right">
                        {exercise.weight === null ? '—' : `${exercise.weight} kg`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
