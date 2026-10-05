import { z } from 'zod';

/**
 * Client-side form schemas.
 *
 * These mirror the server schemas in shape but keep every field in its raw
 * `<input>` representation (strings for dates and numbers). The server remains
 * the authority: route handlers re-validate the same payload with the
 * transforming schemas in this directory, so a crafted request can never skip
 * a rule that the form enforces.
 */

const title = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

const optional = (max = 2000) => z.string().trim().max(max, 'This field is too long.');

const dateString = z
  .string()
  .min(1, 'Pick a date.')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Enter a valid date.');

const optionalDateString = z
  .string()
  .refine(
    (value) => value === '' || !Number.isNaN(new Date(value).getTime()),
    'Enter a valid date.',
  );

const positiveIntString = (label: string, max: number) =>
  z
    .string()
    .min(1, `${label} is required.`)
    .refine((value) => /^\d+$/.test(value.trim()), `${label} must be a whole number.`)
    .refine((value) => Number(value) > 0, `${label} must be greater than zero.`)
    .refine((value) => Number(value) <= max, `${label} cannot exceed ${max}.`);

const optionalNumberString = (label: string, max: number) =>
  z
    .string()
    .refine(
      (value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0),
      `${label} must be a positive number.`,
    )
    .refine((value) => value === '' || Number(value) <= max, `${label} cannot exceed ${max}.`);

// ---------------------------------------------------------------------------

export const taskFormSchema = z.object({
  title: title('Title'),
  description: optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  dueDate: optionalDateString,
  projectId: z.string(),
});
export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const projectFormSchema = z
  .object({
    name: title('Project name', 120),
    description: optional(),
    status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']),
    color: z.string(),
    startDate: optionalDateString,
    targetDate: optionalDateString,
  })
  .refine(
    (data) =>
      data.startDate === '' ||
      data.targetDate === '' ||
      new Date(data.targetDate) >= new Date(data.startDate),
    { message: 'The target date cannot be before the start date.', path: ['targetDate'] },
  );
export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const habitFormSchema = z.object({
  name: title('Habit name', 120),
  description: optional(1000),
  frequency: z.enum(['DAILY', 'WEEKLY']),
  targetCount: positiveIntString('Target', 50),
  color: z.string(),
});
export type HabitFormValues = z.infer<typeof habitFormSchema>;

export const studyFormSchema = z.object({
  subject: title('Subject', 120),
  topic: optional(200),
  durationMinutes: positiveIntString('Duration', 1440),
  notes: optional(),
  sessionDate: dateString,
});
export type StudyFormValues = z.infer<typeof studyFormSchema>;

export const workoutExerciseFormSchema = z.object({
  name: title('Exercise name', 120),
  sets: positiveIntString('Sets', 100),
  reps: optionalNumberString('Reps', 1000),
  weight: optionalNumberString('Weight', 1000),
  notes: optional(500),
});
export type WorkoutExerciseFormValues = z.infer<typeof workoutExerciseFormSchema>;

export const workoutFormSchema = z.object({
  name: title('Workout name', 120),
  workoutDate: dateString,
  durationMinutes: optionalNumberString('Duration', 1440),
  notes: optional(),
  exercises: z.array(workoutExerciseFormSchema).max(40, 'A workout can hold at most 40 exercises.'),
});
export type WorkoutFormValues = z.infer<typeof workoutFormSchema>;

export const eventFormSchema = z
  .object({
    title: title('Title'),
    description: optional(),
    type: z.enum(['TASK', 'STUDY', 'FITNESS', 'PERSONAL', 'PROJECT', 'OTHER']),
    startTime: dateString,
    endTime: optionalDateString,
    location: optional(200),
    allDay: z.boolean(),
  })
  .refine((data) => data.endTime === '' || new Date(data.endTime) >= new Date(data.startTime), {
    message: 'The end time cannot be before the start time.',
    path: ['endTime'],
  });
export type EventFormValues = z.infer<typeof eventFormSchema>;

export const journalFormSchema = z.object({
  title: optional(200),
  content: z
    .string()
    .trim()
    .min(1, 'Write something before saving.')
    .max(20_000, 'Entries are limited to 20,000 characters.'),
  mood: z.enum(['', 'GREAT', 'GOOD', 'NEUTRAL', 'LOW', 'BAD']),
  entryDate: dateString,
});
export type JournalFormValues = z.infer<typeof journalFormSchema>;

export const preferencesFormSchema = z.object({
  timezone: z.string().trim().min(1, 'Pick a timezone.'),
  weekStartsOn: z.enum(['0', '1']),
  dailyTaskGoal: positiveIntString('Daily task goal', 50),
  weeklyStudyGoal: positiveIntString('Weekly study goal', 10_080),
  weeklyWorkoutGoal: positiveIntString('Weekly workout goal', 21),
});
export type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;

export const profileFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(80, 'Name is too long.'),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

/** Strip empty strings so the API receives `undefined` instead of `""`. */
export function compact<T extends Record<string, unknown>>(values: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === '' || value === undefined) continue;
    result[key] = value;
  }
  return result as Partial<T>;
}
