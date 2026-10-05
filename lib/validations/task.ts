import { z } from 'zod';

import { cuidSchema, optionalDateInput, optionalText, requiredText } from './common';

export const taskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED']);
export const taskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const taskCreateSchema = z.object({
  title: requiredText('Title', 200),
  description: optionalText(2000),
  status: taskStatusSchema.default('TODO'),
  priority: taskPrioritySchema.default('MEDIUM'),
  dueDate: optionalDateInput,
  projectId: cuidSchema.optional().or(z.literal('').transform(() => undefined)),
});

/** Every field optional so the UI can PATCH a single attribute. */
export const taskUpdateSchema = z
  .object({
    title: requiredText('Title', 200).optional(),
    description: optionalText(2000),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    dueDate: optionalDateInput,
    projectId: cuidSchema
      .nullable()
      .optional()
      .transform((value) => (value === '' ? null : value)),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Provide at least one field to update.',
  });

export const taskFilterSchema = z.object({
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  projectId: cuidSchema.optional(),
  search: z.string().trim().max(200).optional(),
  /** `dueDate` sorts undated tasks last; `priority` sorts URGENT first. */
  sort: z.enum(['dueDate', 'priority', 'createdAt', 'title']).default('dueDate'),
  direction: z.enum(['asc', 'desc']).default('asc'),
  includeArchived: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .default(false)
    .transform((value) => value === true || value === 'true'),
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskFilterInput = z.infer<typeof taskFilterSchema>;
