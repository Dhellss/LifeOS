import { z } from 'zod';

import { dateInput, durationMinutesSchema, optionalText, requiredText } from './common';

export const studySessionCreateSchema = z.object({
  subject: requiredText('Subject', 120),
  topic: optionalText(200),
  durationMinutes: durationMinutesSchema,
  notes: optionalText(2000),
  sessionDate: dateInput,
});

export const studySessionUpdateSchema = studySessionCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Provide at least one field to update.',
  });

export const studyFilterSchema = z.object({
  subject: z.string().trim().max(120).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type StudySessionCreateInput = z.infer<typeof studySessionCreateSchema>;
export type StudySessionUpdateInput = z.infer<typeof studySessionUpdateSchema>;
