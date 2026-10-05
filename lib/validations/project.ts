import { z } from 'zod';

import { optionalDateInput, optionalHexColorSchema, optionalText, requiredText } from './common';

export const projectStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']);

const projectShape = {
  name: requiredText('Project name', 120),
  description: optionalText(2000),
  status: projectStatusSchema.default('ACTIVE'),
  color: optionalHexColorSchema,
  startDate: optionalDateInput,
  targetDate: optionalDateInput,
};

export const projectCreateSchema = z
  .object(projectShape)
  .refine((data) => !data.startDate || !data.targetDate || data.targetDate >= data.startDate, {
    message: 'The target date cannot be before the start date.',
    path: ['targetDate'],
  });

export const projectUpdateSchema = z
  .object({
    name: requiredText('Project name', 120).optional(),
    description: optionalText(2000),
    status: projectStatusSchema.optional(),
    color: optionalHexColorSchema,
    startDate: optionalDateInput,
    targetDate: optionalDateInput,
  })
  .refine((data) => !data.startDate || !data.targetDate || data.targetDate >= data.startDate, {
    message: 'The target date cannot be before the start date.',
    path: ['targetDate'],
  });

export const projectFilterSchema = z.object({
  status: projectStatusSchema.optional(),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(['createdAt', 'name', 'targetDate']).default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type ProjectFilterInput = z.infer<typeof projectFilterSchema>;
