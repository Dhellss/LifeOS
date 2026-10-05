'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';

import { Field } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';
import { useDialogState } from '@/lib/use-dialog-state';
import { workoutFormSchema, type WorkoutFormValues } from '@/lib/validations/forms';

export interface WorkoutDialogWorkout {
  id: string;
  name: string;
  workoutDate: string | Date;
  durationMinutes: number | null;
  notes: string | null;
  exercises: {
    name: string;
    sets: number;
    reps: number | null;
    weight: number | null;
    notes: string | null;
  }[];
}

export interface WorkoutDialogProps {
  /** Omit when driving the dialog with `open`/`onOpenChange`. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  workout?: WorkoutDialogWorkout;
}

const EMPTY_EXERCISE = { name: '', sets: '3', reps: '10', weight: '', notes: '' };

export function WorkoutDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  workout,
}: WorkoutDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useDialogState(controlledOpen, onOpenChange);
  const isEdit = Boolean(workout);

  const defaults: WorkoutFormValues = {
    name: workout?.name ?? '',
    workoutDate: workout
      ? new Date(workout.workoutDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    durationMinutes: workout?.durationMinutes ? String(workout.durationMinutes) : '',
    notes: workout?.notes ?? '',
    exercises: workout?.exercises.map((exercise) => ({
      name: exercise.name,
      sets: String(exercise.sets),
      reps: exercise.reps === null ? '' : String(exercise.reps),
      weight: exercise.weight === null ? '' : String(exercise.weight),
      notes: exercise.notes ?? '',
    })) ?? [EMPTY_EXERCISE],
  };

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WorkoutFormValues>({
    resolver: zodResolver(workoutFormSchema),
    defaultValues: defaults,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'exercises' });

  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: WorkoutFormValues) {
    const payload = {
      name: values.name,
      workoutDate: values.workoutDate,
      durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : undefined,
      notes: values.notes || undefined,
      exercises: values.exercises
        .filter((exercise) => exercise.name.trim() !== '')
        .map((exercise) => ({
          name: exercise.name,
          sets: Number(exercise.sets),
          reps: exercise.reps ? Number(exercise.reps) : undefined,
          weight: exercise.weight ? Number(exercise.weight) : undefined,
          notes: exercise.notes || undefined,
        })),
    };

    try {
      if (isEdit && workout) {
        await api.patch(`/api/fitness/${workout.id}`, payload);
        toast({ title: 'Workout updated', variant: 'success' });
      } else {
        const result = await api.post<{ xpAwarded: number }>('/api/fitness', payload);
        toast({
          title: 'Workout logged',
          description: result?.xpAwarded ? `+${result.xpAwarded} XP` : undefined,
          variant: 'success',
        });
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      applyServerErrors(error, setError);
      toast({
        title: 'Could not save the workout',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit workout' : 'Log workout'}</DialogTitle>
          <DialogDescription>
            Add the exercises you did. Sets and reps feed your exercise history.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[1fr,9rem,9rem]">
            <Field label="Workout" htmlFor="workout-name" error={errors.name?.message} required>
              <Input
                id="workout-name"
                placeholder="Upper body push"
                aria-invalid={Boolean(errors.name)}
                {...register('name')}
              />
            </Field>
            <Field label="Date" htmlFor="workout-date" error={errors.workoutDate?.message} required>
              <Input id="workout-date" type="date" {...register('workoutDate')} />
            </Field>
            <Field
              label="Duration (min)"
              htmlFor="workout-duration"
              error={errors.durationMinutes?.message}
            >
              <Input id="workout-duration" inputMode="numeric" {...register('durationMinutes')} />
            </Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Exercises</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append(EMPTY_EXERCISE)}
              >
                <Plus className="h-4 w-4" />
                Add exercise
              </Button>
            </div>

            {errors.exercises?.message ? (
              <p className="text-xs text-destructive">{errors.exercises.message}</p>
            ) : null}

            <div className="space-y-2">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr,5rem,5rem,6rem,auto]"
                >
                  <div>
                    <Input
                      placeholder="Exercise name"
                      aria-label={`Exercise ${index + 1} name`}
                      {...register(`exercises.${index}.name`)}
                    />
                    {errors.exercises?.[index]?.name ? (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.exercises[index]?.name?.message}
                      </p>
                    ) : null}
                  </div>
                  <Input
                    inputMode="numeric"
                    placeholder="Sets"
                    aria-label={`Exercise ${index + 1} sets`}
                    {...register(`exercises.${index}.sets`)}
                  />
                  <Input
                    inputMode="numeric"
                    placeholder="Reps"
                    aria-label={`Exercise ${index + 1} reps`}
                    {...register(`exercises.${index}.reps`)}
                  />
                  <Input
                    inputMode="decimal"
                    placeholder="kg"
                    aria-label={`Exercise ${index + 1} weight in kilograms`}
                    {...register(`exercises.${index}.weight`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove exercise ${index + 1}`}
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Field label="Notes" htmlFor="workout-notes" error={errors.notes?.message}>
            <Textarea
              id="workout-notes"
              rows={2}
              placeholder="How did it feel?"
              {...register('notes')}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Save changes' : 'Log workout'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
