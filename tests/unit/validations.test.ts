import { describe, expect, it } from 'vitest';

import { loginSchema, registerSchema } from '@/lib/validations/auth';
import { calendarEventCreateSchema, calendarEventUpdateSchema } from '@/lib/validations/calendar';
import { workoutCreateSchema } from '@/lib/validations/fitness';
import { habitCheckinSchema, habitCreateSchema } from '@/lib/validations/habit';
import { journalEntryCreateSchema } from '@/lib/validations/journal';
import { projectCreateSchema } from '@/lib/validations/project';
import { studySessionCreateSchema } from '@/lib/validations/study';
import { preferencesUpdateSchema } from '@/lib/validations/settings';
import { taskCreateSchema, taskFilterSchema, taskUpdateSchema } from '@/lib/validations/task';

/** First error message for a given field path. */
function fieldError(
  result: { success: false; error: { issues: { path: (string | number)[]; message: string }[] } },
  field: string,
) {
  return result.error.issues.find((issue) => issue.path.join('.') === field)?.message;
}

describe('taskCreateSchema', () => {
  it('accepts a minimal task and applies defaults', () => {
    const parsed = taskCreateSchema.parse({ title: 'Write tests' });
    expect(parsed).toMatchObject({ title: 'Write tests', status: 'TODO', priority: 'MEDIUM' });
    expect(parsed.dueDate).toBeUndefined();
    expect(parsed.projectId).toBeUndefined();
  });

  it('trims the title and rejects a blank one', () => {
    expect(taskCreateSchema.parse({ title: '  Spaced  ' }).title).toBe('Spaced');

    const result = taskCreateSchema.safeParse({ title: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldError(result, 'title')).toBe('Title is required.');
  });

  it('rejects an unknown status or priority', () => {
    expect(taskCreateSchema.safeParse({ title: 'x', status: 'WAITING' }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: 'x', priority: 'CRITICAL' }).success).toBe(false);
  });

  it('coerces a date string into a Date', () => {
    const parsed = taskCreateSchema.parse({ title: 'x', dueDate: '2026-04-01' });
    expect(parsed.dueDate).toBeInstanceOf(Date);
    expect(parsed.dueDate?.toISOString().slice(0, 10)).toBe('2026-04-01');
  });

  it('rejects an unparseable date', () => {
    const result = taskCreateSchema.safeParse({ title: 'x', dueDate: 'not-a-date' });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldError(result, 'dueDate')).toBe('Enter a valid date.');
  });

  it('normalises an empty description and projectId to undefined', () => {
    const parsed = taskCreateSchema.parse({ title: 'x', description: '', projectId: '' });
    expect(parsed.description).toBeUndefined();
    expect(parsed.projectId).toBeUndefined();
  });

  it('enforces the title length cap', () => {
    expect(taskCreateSchema.safeParse({ title: 'a'.repeat(201) }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: 'a'.repeat(200) }).success).toBe(true);
  });
});

describe('taskUpdateSchema', () => {
  it('accepts a single-field patch', () => {
    expect(taskUpdateSchema.parse({ status: 'DONE' })).toMatchObject({ status: 'DONE' });
  });

  it('rejects an empty patch', () => {
    expect(taskUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('allows clearing the project with null', () => {
    expect(taskUpdateSchema.parse({ projectId: null }).projectId).toBeNull();
  });
});

describe('taskFilterSchema', () => {
  it('defaults to due-date ascending', () => {
    expect(taskFilterSchema.parse({})).toMatchObject({
      sort: 'dueDate',
      direction: 'asc',
      includeArchived: false,
    });
  });

  it('parses the archived flag from a query string value', () => {
    expect(taskFilterSchema.parse({ includeArchived: 'true' }).includeArchived).toBe(true);
    expect(taskFilterSchema.parse({ includeArchived: 'false' }).includeArchived).toBe(false);
  });
});

describe('projectCreateSchema', () => {
  it('rejects a target date before the start date', () => {
    const result = projectCreateSchema.safeParse({
      name: 'Thesis',
      startDate: '2026-05-01',
      targetDate: '2026-04-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldError(result, 'targetDate')).toBe(
        'The target date cannot be before the start date.',
      );
    }
  });

  it('accepts equal start and target dates', () => {
    expect(
      projectCreateSchema.safeParse({
        name: 'Thesis',
        startDate: '2026-05-01',
        targetDate: '2026-05-01',
      }).success,
    ).toBe(true);
  });

  it('accepts a target date with no start date', () => {
    expect(projectCreateSchema.safeParse({ name: 'x', targetDate: '2026-05-01' }).success).toBe(
      true,
    );
  });

  it('rejects a malformed colour', () => {
    expect(projectCreateSchema.safeParse({ name: 'x', color: 'blue' }).success).toBe(false);
    expect(projectCreateSchema.safeParse({ name: 'x', color: '#6366f1' }).success).toBe(true);
  });
});

describe('habit schemas', () => {
  it('defaults a habit to a daily target of one', () => {
    expect(habitCreateSchema.parse({ name: 'Read' })).toMatchObject({
      frequency: 'DAILY',
      targetCount: 1,
    });
  });

  it('rejects a non-positive target', () => {
    expect(habitCreateSchema.safeParse({ name: 'Read', targetCount: 0 }).success).toBe(false);
    expect(habitCreateSchema.safeParse({ name: 'Read', targetCount: 51 }).success).toBe(false);
  });

  it('coerces a string target from a form post', () => {
    expect(habitCreateSchema.parse({ name: 'Water', targetCount: '8' }).targetCount).toBe(8);
  });

  it('requires a yyyy-MM-dd date for a check-in', () => {
    expect(habitCheckinSchema.safeParse({ habitId: 'h1', date: '2026-03-10' }).success).toBe(true);
    expect(habitCheckinSchema.safeParse({ habitId: 'h1', date: '10/03/2026' }).success).toBe(false);
    expect(
      habitCheckinSchema.safeParse({ habitId: 'h1', date: '2026-03-10T08:00:00Z' }).success,
    ).toBe(false);
  });

  it('allows count zero so a check-in can be removed', () => {
    expect(habitCheckinSchema.parse({ habitId: 'h1', date: '2026-03-10', count: 0 }).count).toBe(0);
  });
});

describe('studySessionCreateSchema', () => {
  it('requires a positive whole-minute duration', () => {
    const base = { subject: 'Maths', sessionDate: '2026-03-10' };
    expect(studySessionCreateSchema.safeParse({ ...base, durationMinutes: 45 }).success).toBe(true);
    expect(studySessionCreateSchema.safeParse({ ...base, durationMinutes: 0 }).success).toBe(false);
    expect(studySessionCreateSchema.safeParse({ ...base, durationMinutes: -5 }).success).toBe(
      false,
    );
    expect(studySessionCreateSchema.safeParse({ ...base, durationMinutes: 12.5 }).success).toBe(
      false,
    );
  });

  it('caps a session at 24 hours', () => {
    const base = { subject: 'Maths', sessionDate: '2026-03-10' };
    expect(studySessionCreateSchema.safeParse({ ...base, durationMinutes: 1440 }).success).toBe(
      true,
    );
    expect(studySessionCreateSchema.safeParse({ ...base, durationMinutes: 1441 }).success).toBe(
      false,
    );
  });

  it('requires a subject', () => {
    expect(
      studySessionCreateSchema.safeParse({
        subject: '  ',
        durationMinutes: 30,
        sessionDate: '2026-03-10',
      }).success,
    ).toBe(false);
  });
});

describe('workoutCreateSchema', () => {
  it('accepts a workout with no exercises', () => {
    const parsed = workoutCreateSchema.parse({ name: 'Rest day walk', workoutDate: '2026-03-10' });
    expect(parsed.exercises).toEqual([]);
  });

  it('defaults exercise sets to one', () => {
    const parsed = workoutCreateSchema.parse({
      name: 'Push',
      workoutDate: '2026-03-10',
      exercises: [{ name: 'Bench press' }],
    });
    expect(parsed.exercises[0]).toMatchObject({ name: 'Bench press', sets: 1 });
  });

  it('rejects a negative weight', () => {
    expect(
      workoutCreateSchema.safeParse({
        name: 'Push',
        workoutDate: '2026-03-10',
        exercises: [{ name: 'Bench press', sets: 3, weight: -10 }],
      }).success,
    ).toBe(false);
  });

  it('rejects an exercise with no name', () => {
    expect(
      workoutCreateSchema.safeParse({
        name: 'Push',
        workoutDate: '2026-03-10',
        exercises: [{ name: '', sets: 3 }],
      }).success,
    ).toBe(false);
  });
});

describe('calendar event schemas', () => {
  const base = { title: 'Lecture', startTime: '2026-03-10T10:00:00Z' };

  it('rejects an end time before the start time', () => {
    const result = calendarEventCreateSchema.safeParse({
      ...base,
      endTime: '2026-03-10T09:00:00Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldError(result, 'endTime')).toBe('The end time cannot be before the start time.');
    }
  });

  it('accepts an end time equal to the start time', () => {
    expect(
      calendarEventCreateSchema.safeParse({ ...base, endTime: '2026-03-10T10:00:00Z' }).success,
    ).toBe(true);
  });

  it('accepts an event with no end time', () => {
    expect(calendarEventCreateSchema.safeParse(base).success).toBe(true);
  });

  it('defaults the type to OTHER and allDay to false', () => {
    const parsed = calendarEventCreateSchema.parse(base);
    expect(parsed.type).toBe('OTHER');
    expect(parsed.allDay).toBe(false);
  });

  it('allows a partial update that only moves the end time', () => {
    expect(calendarEventUpdateSchema.safeParse({ endTime: '2026-03-10T12:00:00Z' }).success).toBe(
      true,
    );
  });
});

describe('journalEntryCreateSchema', () => {
  it('rejects empty or whitespace-only content', () => {
    const result = journalEntryCreateSchema.safeParse({ content: '   ', entryDate: '2026-03-10' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldError(result, 'content')).toBe('Write something before saving.');
    }
  });

  it('accepts content with an optional mood and no title', () => {
    const parsed = journalEntryCreateSchema.parse({
      content: 'A good day.',
      mood: 'GREAT',
      entryDate: '2026-03-10',
    });
    expect(parsed).toMatchObject({ content: 'A good day.', mood: 'GREAT' });
    expect(parsed.title).toBeUndefined();
  });

  it('rejects an unknown mood', () => {
    expect(
      journalEntryCreateSchema.safeParse({
        content: 'x',
        mood: 'ECSTATIC',
        entryDate: '2026-03-10',
      }).success,
    ).toBe(false);
  });

  it('enforces the content length cap', () => {
    expect(
      journalEntryCreateSchema.safeParse({
        content: 'a'.repeat(20_001),
        entryDate: '2026-03-10',
      }).success,
    ).toBe(false);
  });
});

describe('auth schemas', () => {
  it('lowercases and trims the email', () => {
    expect(loginSchema.parse({ email: '  Ada@Example.COM ', password: 'secret' }).email).toBe(
      'ada@example.com',
    );
  });

  it('rejects a mismatched password confirmation', () => {
    const result = registerSchema.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'longenough1',
      confirmPassword: 'different11',
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(fieldError(result, 'confirmPassword')).toBe('Passwords do not match.');
  });

  it('enforces a minimum password length', () => {
    const result = registerSchema.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldError(result, 'password')).toBe('Password must be at least 8 characters long.');
    }
  });

  it('accepts a valid registration', () => {
    expect(
      registerSchema.safeParse({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'analytical-engine',
        confirmPassword: 'analytical-engine',
      }).success,
    ).toBe(true);
  });
});

describe('preferencesUpdateSchema', () => {
  it('accepts a partial update', () => {
    expect(preferencesUpdateSchema.parse({ dailyTaskGoal: 7 })).toEqual({ dailyTaskGoal: 7 });
    expect(preferencesUpdateSchema.parse({})).toEqual({});
  });

  it('coerces string values from a form post', () => {
    const parsed = preferencesUpdateSchema.parse({
      weekStartsOn: '0',
      dailyTaskGoal: '8',
      weeklyStudyGoal: '900',
      weeklyWorkoutGoal: '4',
    });
    expect(parsed).toEqual({
      weekStartsOn: 0,
      dailyTaskGoal: 8,
      weeklyStudyGoal: 900,
      weeklyWorkoutGoal: 4,
    });
  });

  it('only allows Sunday or Monday as the week start', () => {
    expect(preferencesUpdateSchema.safeParse({ weekStartsOn: 1 }).success).toBe(true);
    expect(preferencesUpdateSchema.safeParse({ weekStartsOn: 2 }).success).toBe(false);
    expect(preferencesUpdateSchema.safeParse({ weekStartsOn: -1 }).success).toBe(false);
  });

  it('bounds each goal', () => {
    expect(preferencesUpdateSchema.safeParse({ dailyTaskGoal: 0 }).success).toBe(false);
    expect(preferencesUpdateSchema.safeParse({ dailyTaskGoal: 51 }).success).toBe(false);
    // A weekly study goal of 0 is allowed: it means "no goal set".
    expect(preferencesUpdateSchema.safeParse({ weeklyStudyGoal: 0 }).success).toBe(true);
    expect(preferencesUpdateSchema.safeParse({ weeklyStudyGoal: 10_081 }).success).toBe(false);
    expect(preferencesUpdateSchema.safeParse({ weeklyWorkoutGoal: 22 }).success).toBe(false);
  });

  it('rejects a fractional goal', () => {
    expect(preferencesUpdateSchema.safeParse({ dailyTaskGoal: 4.5 }).success).toBe(false);
  });
});
