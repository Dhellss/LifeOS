import { describe, expect, it } from 'vitest';

import {
  compact,
  eventFormSchema,
  habitFormSchema,
  journalFormSchema,
  preferencesFormSchema,
  profileFormSchema,
  projectFormSchema,
  studyFormSchema,
  taskFormSchema,
  workoutFormSchema,
} from '@/lib/validations/forms';

/**
 * Client-side form schemas.
 *
 * These keep every field in its raw `<input>` representation, so the tests
 * assert on strings rather than coerced values. The server re-validates the
 * same payload with the transforming schemas in `lib/validations/*`; what
 * matters here is that the form rejects what the server would reject, so the
 * user sees the error inline instead of as a 422.
 */

const validTask = {
  title: 'Write the report',
  description: '',
  status: 'TODO' as const,
  priority: 'MEDIUM' as const,
  dueDate: '',
  projectId: '',
};

describe('taskFormSchema', () => {
  it('accepts a minimal task', () => {
    expect(taskFormSchema.safeParse(validTask).success).toBe(true);
  });

  it('rejects a blank title', () => {
    const result = taskFormSchema.safeParse({ ...validTask, title: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe('Title is required.');
  });

  it('accepts an empty due date but rejects an unparseable one', () => {
    expect(taskFormSchema.safeParse({ ...validTask, dueDate: '' }).success).toBe(true);
    expect(taskFormSchema.safeParse({ ...validTask, dueDate: '2026-04-01' }).success).toBe(true);
    expect(taskFormSchema.safeParse({ ...validTask, dueDate: 'tomorrow' }).success).toBe(false);
  });

  it('rejects an unknown status or priority', () => {
    expect(taskFormSchema.safeParse({ ...validTask, status: 'WAITING' }).success).toBe(false);
    expect(taskFormSchema.safeParse({ ...validTask, priority: 'CRITICAL' }).success).toBe(false);
  });
});

describe('projectFormSchema', () => {
  const base = {
    name: 'Thesis',
    description: '',
    status: 'ACTIVE' as const,
    color: '',
    startDate: '',
    targetDate: '',
  };

  it('accepts a project with no dates', () => {
    expect(projectFormSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a target date before the start date', () => {
    const result = projectFormSchema.safeParse({
      ...base,
      startDate: '2026-05-01',
      targetDate: '2026-04-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['targetDate']);
    }
  });

  it('accepts equal dates, and a target date with no start date', () => {
    expect(
      projectFormSchema.safeParse({ ...base, startDate: '2026-05-01', targetDate: '2026-05-01' })
        .success,
    ).toBe(true);
    expect(projectFormSchema.safeParse({ ...base, targetDate: '2026-05-01' }).success).toBe(true);
  });
});

describe('habitFormSchema', () => {
  const base = {
    name: 'Read',
    description: '',
    frequency: 'DAILY' as const,
    targetCount: '1',
    color: '',
  };

  it('accepts a whole-number target', () => {
    expect(habitFormSchema.safeParse(base).success).toBe(true);
    expect(habitFormSchema.safeParse({ ...base, targetCount: '8' }).success).toBe(true);
  });

  it('rejects a non-numeric, zero, fractional or oversized target', () => {
    for (const targetCount of ['many', '0', '2.5', '51', '-3', '']) {
      expect(
        habitFormSchema.safeParse({ ...base, targetCount }).success,
        `targetCount=${targetCount}`,
      ).toBe(false);
    }
  });
});

describe('studyFormSchema', () => {
  const base = {
    subject: 'Compilers',
    topic: '',
    durationMinutes: '45',
    notes: '',
    sessionDate: '2026-03-10',
  };

  it('accepts a valid session', () => {
    expect(studyFormSchema.safeParse(base).success).toBe(true);
  });

  it('requires a subject and a date', () => {
    expect(studyFormSchema.safeParse({ ...base, subject: '  ' }).success).toBe(false);
    expect(studyFormSchema.safeParse({ ...base, sessionDate: '' }).success).toBe(false);
  });

  it('rejects a non-positive or oversized duration', () => {
    for (const durationMinutes of ['0', '-10', '1441', 'sixty', '']) {
      expect(
        studyFormSchema.safeParse({ ...base, durationMinutes }).success,
        `duration=${durationMinutes}`,
      ).toBe(false);
    }
  });
});

describe('workoutFormSchema', () => {
  const exercise = { name: 'Bench press', sets: '3', reps: '8', weight: '60', notes: '' };
  const base = {
    name: 'Upper body push',
    workoutDate: '2026-03-10',
    durationMinutes: '',
    notes: '',
    exercises: [exercise],
  };

  it('accepts a workout with an exercise', () => {
    expect(workoutFormSchema.safeParse(base).success).toBe(true);
  });

  it('accepts blank optional numeric fields', () => {
    expect(
      workoutFormSchema.safeParse({
        ...base,
        durationMinutes: '',
        exercises: [{ ...exercise, reps: '', weight: '' }],
      }).success,
    ).toBe(true);
  });

  it('rejects a negative weight and a blank exercise name', () => {
    expect(
      workoutFormSchema.safeParse({ ...base, exercises: [{ ...exercise, weight: '-5' }] }).success,
    ).toBe(false);
    expect(
      workoutFormSchema.safeParse({ ...base, exercises: [{ ...exercise, name: '' }] }).success,
    ).toBe(false);
  });

  it('caps the exercise list', () => {
    const many = Array.from({ length: 41 }, () => exercise);
    expect(workoutFormSchema.safeParse({ ...base, exercises: many }).success).toBe(false);
  });
});

describe('eventFormSchema', () => {
  const base = {
    title: 'Lecture',
    description: '',
    type: 'STUDY' as const,
    startTime: '2026-03-10T10:00',
    endTime: '',
    location: '',
    allDay: false,
  };

  it('accepts an event with no end time', () => {
    expect(eventFormSchema.safeParse(base).success).toBe(true);
  });

  it('rejects an end time before the start time', () => {
    const result = eventFormSchema.safeParse({ ...base, endTime: '2026-03-10T09:00' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['endTime']);
  });

  it('accepts an end time equal to the start time', () => {
    expect(eventFormSchema.safeParse({ ...base, endTime: '2026-03-10T10:00' }).success).toBe(true);
  });

  it('requires a start time', () => {
    expect(eventFormSchema.safeParse({ ...base, startTime: '' }).success).toBe(false);
  });
});

describe('journalFormSchema', () => {
  const base = { title: '', content: 'A good day.', mood: '' as const, entryDate: '2026-03-10' };

  it('accepts an entry with no title and no mood', () => {
    expect(journalFormSchema.safeParse(base).success).toBe(true);
  });

  it('treats the empty string as "no mood" and rejects an unknown one', () => {
    expect(journalFormSchema.safeParse({ ...base, mood: 'GREAT' }).success).toBe(true);
    expect(journalFormSchema.safeParse({ ...base, mood: 'ECSTATIC' }).success).toBe(false);
  });

  it('rejects whitespace-only content', () => {
    const result = journalFormSchema.safeParse({ ...base, content: '   \n  ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Write something before saving.');
    }
  });

  it('enforces the content cap', () => {
    expect(journalFormSchema.safeParse({ ...base, content: 'a'.repeat(20_001) }).success).toBe(
      false,
    );
  });
});

describe('preferencesFormSchema', () => {
  const base = {
    timezone: 'Europe/Berlin',
    weekStartsOn: '1' as const,
    dailyTaskGoal: '5',
    weeklyStudyGoal: '600',
    weeklyWorkoutGoal: '3',
  };

  it('accepts valid preferences', () => {
    expect(preferencesFormSchema.safeParse(base).success).toBe(true);
  });

  it('only allows Sunday or Monday as the week start', () => {
    expect(preferencesFormSchema.safeParse({ ...base, weekStartsOn: '0' }).success).toBe(true);
    expect(preferencesFormSchema.safeParse({ ...base, weekStartsOn: '3' }).success).toBe(false);
  });

  it('rejects out-of-range goals', () => {
    expect(preferencesFormSchema.safeParse({ ...base, dailyTaskGoal: '51' }).success).toBe(false);
    expect(preferencesFormSchema.safeParse({ ...base, weeklyWorkoutGoal: '22' }).success).toBe(
      false,
    );
    expect(preferencesFormSchema.safeParse({ ...base, weeklyStudyGoal: '0' }).success).toBe(false);
  });

  it('requires a timezone', () => {
    expect(preferencesFormSchema.safeParse({ ...base, timezone: '  ' }).success).toBe(false);
  });
});

describe('profileFormSchema', () => {
  it('requires at least two characters', () => {
    expect(profileFormSchema.safeParse({ name: 'Ada' }).success).toBe(true);
    expect(profileFormSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(profileFormSchema.safeParse({ name: 'a'.repeat(81) }).success).toBe(false);
  });
});

describe('compact', () => {
  it('drops empty strings and undefined values', () => {
    expect(compact({ a: 'x', b: '', c: undefined, d: 0, e: false })).toEqual({
      a: 'x',
      d: 0,
      e: false,
    });
  });

  it('returns an empty object when everything is blank', () => {
    expect(compact({ a: '', b: undefined })).toEqual({});
  });
});
