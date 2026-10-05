import { z } from 'zod';

import {
  cuidSchema,
  dayKeySchema,
  optionalHexColorSchema,
  optionalText,
  requiredText,
} from './common';

export const habitFrequencySchema = z.enum(['DAILY', 'WEEKLY']);

export const habitCreateSchema = z.object({
  name: requiredText('Habit name', 120),
  description: optionalText(1000),
  frequency: habitFrequencySchema.default('DAILY'),
  targetCount: z.coerce
    .number()
    .int('Target must be a whole number.')
    .min(1, 'Target must be at least 1.')
    .max(50, 'Target cannot exceed 50.')
    .default(1),
  color: optionalHexColorSchema,
});

export const habitUpdateSchema = habitCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const habitCheckinSchema = z.object({
  habitId: cuidSchema,
  date: dayKeySchema,
  count: z.coerce
    .number()
    .int('Count must be a whole number.')
    .min(0, 'Count cannot be negative.')
    .max(50, 'Count cannot exceed 50.')
    .default(1),
  note: optionalText(500),
});

export type HabitCreateInput = z.infer<typeof habitCreateSchema>;
export type HabitUpdateInput = z.infer<typeof habitUpdateSchema>;
export type HabitCheckinInput = z.infer<typeof habitCheckinSchema>;
