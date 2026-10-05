import { z } from 'zod';

import { dateInput, optionalText, requiredText } from './common';

export const workoutExerciseSchema = z.object({
  name: requiredText('Exercise name', 120),
  sets: z.coerce
    .number()
    .int('Sets must be a whole number.')
    .min(1, 'At least one set is required.')
    .max(100, 'Sets cannot exceed 100.')
    .default(1),
  reps: z.coerce
    .number()
    .int('Reps must be a whole number.')
    .min(1, 'Reps must be at least 1.')
    .max(1000, 'Reps cannot exceed 1000.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  weight: z.coerce
    .number()
    .min(0, 'Weight cannot be negative.')
    .max(1000, 'Weight cannot exceed 1000 kg.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  durationSeconds: z.coerce
    .number()
    .int('Duration must be a whole number of seconds.')
    .min(1, 'Duration must be at least 1 second.')
    .max(86_400, 'Duration cannot exceed 24 hours.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  notes: optionalText(500),
});

export const workoutCreateSchema = z.object({
  name: requiredText('Workout name', 120),
  workoutDate: dateInput,
  durationMinutes: z.coerce
    .number()
    .int('Duration must be a whole number of minutes.')
    .min(1, 'Duration must be at least 1 minute.')
    .max(1440, 'Duration cannot exceed 24 hours.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  notes: optionalText(2000),
  exercises: z
    .array(workoutExerciseSchema)
    .max(40, 'A workout can hold at most 40 exercises.')
    .default([]),
});

export const workoutUpdateSchema = workoutCreateSchema.partial();

export type WorkoutExerciseInput = z.infer<typeof workoutExerciseSchema>;
export type WorkoutCreateInput = z.infer<typeof workoutCreateSchema>;
export type WorkoutUpdateInput = z.infer<typeof workoutUpdateSchema>;
