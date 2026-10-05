import { z } from 'zod';

export const preferencesUpdateSchema = z.object({
  timezone: z.string().trim().min(1, 'Pick a timezone.').max(64).optional(),
  weekStartsOn: z.coerce.number().int().min(0).max(1).optional(),
  dailyTaskGoal: z.coerce
    .number()
    .int('Goal must be a whole number.')
    .min(1, 'Goal must be at least 1.')
    .max(50, 'Goal cannot exceed 50.')
    .optional(),
  weeklyStudyGoal: z.coerce
    .number()
    .int('Goal must be a whole number of minutes.')
    .min(0, 'Goal cannot be negative.')
    .max(10_080, 'Goal cannot exceed one week of minutes.')
    .optional(),
  weeklyWorkoutGoal: z.coerce
    .number()
    .int('Goal must be a whole number.')
    .min(0, 'Goal cannot be negative.')
    .max(21, 'Goal cannot exceed 21 workouts per week.')
    .optional(),
});

export type PreferencesUpdateInput = z.infer<typeof preferencesUpdateSchema>;
