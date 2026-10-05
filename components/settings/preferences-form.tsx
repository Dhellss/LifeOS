'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { Field } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';
import { preferencesFormSchema, type PreferencesFormValues } from '@/lib/validations/forms';
import type { Preferences } from '@/lib/services/preferences';

/** A short, stable list rather than the full IANA database. */
const TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Warsaw',
  'Africa/Lagos',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
] as const;

export function PreferencesForm({ preferences }: { preferences: Preferences }) {
  const router = useRouter();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues: {
      timezone: preferences.timezone,
      weekStartsOn: preferences.weekStartsOn === 0 ? '0' : '1',
      dailyTaskGoal: String(preferences.dailyTaskGoal),
      weeklyStudyGoal: String(preferences.weeklyStudyGoal),
      weeklyWorkoutGoal: String(preferences.weeklyWorkoutGoal),
    },
  });

  async function onSubmit(values: PreferencesFormValues) {
    try {
      await api.patch('/api/settings', {
        timezone: values.timezone,
        weekStartsOn: Number(values.weekStartsOn),
        dailyTaskGoal: Number(values.dailyTaskGoal),
        weeklyStudyGoal: Number(values.weeklyStudyGoal),
        weeklyWorkoutGoal: Number(values.weeklyWorkoutGoal),
      });
      toast({ title: 'Preferences saved', variant: 'success' });
      router.refresh();
    } catch (error) {
      applyServerErrors(error, setError);
      toast({
        title: 'Could not save your preferences',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Goals and locale</CardTitle>
        <CardDescription>
          These values drive the goal hints on your dashboard and the study and fitness pages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Timezone" error={errors.timezone?.message}>
              <Select
                value={watch('timezone')}
                onValueChange={(value) => setValue('timezone', value, { shouldDirty: true })}
              >
                <SelectTrigger aria-label="Timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Week starts on" error={errors.weekStartsOn?.message}>
              <Select
                value={watch('weekStartsOn')}
                onValueChange={(value) =>
                  setValue('weekStartsOn', value as '0' | '1', { shouldDirty: true })
                }
              >
                <SelectTrigger aria-label="Week starts on">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="0">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Daily task goal"
              htmlFor="daily-task-goal"
              error={errors.dailyTaskGoal?.message}
              required
            >
              <Input id="daily-task-goal" inputMode="numeric" {...register('dailyTaskGoal')} />
            </Field>

            <Field
              label="Weekly study goal (minutes)"
              htmlFor="weekly-study-goal"
              error={errors.weeklyStudyGoal?.message}
              required
            >
              <Input id="weekly-study-goal" inputMode="numeric" {...register('weeklyStudyGoal')} />
            </Field>

            <Field
              label="Weekly workout goal"
              htmlFor="weekly-workout-goal"
              error={errors.weeklyWorkoutGoal?.message}
              required
            >
              <Input
                id="weekly-workout-goal"
                inputMode="numeric"
                {...register('weeklyWorkoutGoal')}
              />
            </Field>
          </div>

          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save preferences
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
