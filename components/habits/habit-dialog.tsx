'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { ColorPicker } from '@/components/shared/color-picker';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';
import { useDialogState } from '@/lib/use-dialog-state';
import { habitFormSchema, type HabitFormValues } from '@/lib/validations/forms';

export interface HabitDialogHabit {
  id: string;
  name: string;
  description: string | null;
  frequency: HabitFormValues['frequency'];
  targetCount: number;
  color: string | null;
}

export interface HabitDialogProps {
  /** Omit when driving the dialog with `open`/`onOpenChange`. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  habit?: HabitDialogHabit;
}

export function HabitDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  habit,
}: HabitDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useDialogState(controlledOpen, onOpenChange);
  const isEdit = Boolean(habit);

  const defaults: HabitFormValues = {
    name: habit?.name ?? '',
    description: habit?.description ?? '',
    frequency: habit?.frequency ?? 'DAILY',
    targetCount: habit ? String(habit.targetCount) : '1',
    color: habit?.color ?? '',
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<HabitFormValues>({
    resolver: zodResolver(habitFormSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: HabitFormValues) {
    const payload = {
      name: values.name,
      description: values.description || undefined,
      frequency: values.frequency,
      targetCount: Number(values.targetCount),
      color: values.color || undefined,
    };

    try {
      if (isEdit && habit) await api.patch(`/api/habits/${habit.id}`, payload);
      else await api.post('/api/habits', payload);

      toast({ title: isEdit ? 'Habit updated' : 'Habit created', variant: 'success' });
      setOpen(false);
      router.refresh();
    } catch (error) {
      applyServerErrors(error, setError);
      toast({
        title: 'Could not save the habit',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit habit' : 'New habit'}</DialogTitle>
          <DialogDescription>
            A habit tracks one repeatable action. Streaks count days that hit the target.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Name" htmlFor="habit-name" error={errors.name?.message} required>
            <Input
              id="habit-name"
              placeholder="Read for 30 minutes"
              aria-invalid={Boolean(errors.name)}
              {...register('name')}
            />
          </Field>

          <Field
            label="Description"
            htmlFor="habit-description"
            error={errors.description?.message}
          >
            <Textarea
              id="habit-description"
              rows={2}
              placeholder="Why does this habit matter?"
              {...register('description')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Frequency" error={errors.frequency?.message}>
              <Select
                value={watch('frequency')}
                onValueChange={(value) =>
                  setValue('frequency', value as HabitFormValues['frequency'], {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger aria-label="Frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Target per day"
              htmlFor="habit-target"
              error={errors.targetCount?.message}
              hint="Check-ins below the target do not extend a streak."
              required
            >
              <Input
                id="habit-target"
                inputMode="numeric"
                aria-invalid={Boolean(errors.targetCount)}
                {...register('targetCount')}
              />
            </Field>
          </div>

          <Field label="Colour" error={errors.color?.message}>
            <ColorPicker
              value={watch('color')}
              onChange={(value) => setValue('color', value, { shouldDirty: true })}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Save changes' : 'Create habit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
