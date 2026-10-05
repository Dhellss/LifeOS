import { z } from 'zod';

import { dateInput, optionalDateInput, optionalText, requiredText } from './common';

export const calendarEventTypeSchema = z.enum([
  'TASK',
  'STUDY',
  'FITNESS',
  'PERSONAL',
  'PROJECT',
  'OTHER',
]);

const eventShape = {
  title: requiredText('Title', 200),
  description: optionalText(2000),
  startTime: dateInput,
  endTime: optionalDateInput,
  type: calendarEventTypeSchema.default('OTHER'),
  location: optionalText(200),
  allDay: z.boolean().default(false),
};

/** An event may not end before it starts. */
const endsAfterStart = (data: { startTime?: Date; endTime?: Date }) =>
  !data.startTime || !data.endTime || data.endTime >= data.startTime;

export const calendarEventCreateSchema = z.object(eventShape).refine(endsAfterStart, {
  message: 'The end time cannot be before the start time.',
  path: ['endTime'],
});

export const calendarEventUpdateSchema = z
  .object({
    title: requiredText('Title', 200).optional(),
    description: optionalText(2000),
    startTime: optionalDateInput,
    endTime: optionalDateInput,
    type: calendarEventTypeSchema.optional(),
    location: optionalText(200),
    allDay: z.boolean().optional(),
  })
  .refine(endsAfterStart, {
    message: 'The end time cannot be before the start time.',
    path: ['endTime'],
  });

export const calendarRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: calendarEventTypeSchema.optional(),
});

export type CalendarEventCreateInput = z.infer<typeof calendarEventCreateSchema>;
export type CalendarEventUpdateInput = z.infer<typeof calendarEventUpdateSchema>;
