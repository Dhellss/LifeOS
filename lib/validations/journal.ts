import { z } from 'zod';

import { dateInput, optionalText } from './common';

export const moodSchema = z.enum(['GREAT', 'GOOD', 'NEUTRAL', 'LOW', 'BAD']);

export const journalEntryCreateSchema = z.object({
  title: optionalText(200),
  content: z
    .string({ required_error: 'Write something before saving.' })
    .trim()
    .min(1, 'Write something before saving.')
    .max(20_000, 'Entries are limited to 20,000 characters.'),
  mood: moodSchema.optional().or(z.literal('').transform(() => undefined)),
  entryDate: dateInput,
});

export const journalEntryUpdateSchema = journalEntryCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Provide at least one field to update.',
  });

export const journalFilterSchema = z.object({
  search: z.string().trim().max(200).optional(),
  mood: moodSchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type JournalEntryCreateInput = z.infer<typeof journalEntryCreateSchema>;
export type JournalEntryUpdateInput = z.infer<typeof journalEntryUpdateSchema>;
export type JournalFilterInput = z.infer<typeof journalFilterSchema>;
