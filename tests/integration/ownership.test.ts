import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NotFoundError } from '@/lib/errors';
import { createEvent, deleteEvent, getEvent, updateEvent } from '@/lib/services/calendar';
import { createWorkout, deleteWorkout, getWorkout, updateWorkout } from '@/lib/services/fitness';
import {
  checkInHabit,
  createHabit,
  deleteHabit,
  getHabit,
  updateHabit,
} from '@/lib/services/habits';
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  listJournalEntries,
  updateJournalEntry,
} from '@/lib/services/journal';
import { createProject, deleteProject, getProject, updateProject } from '@/lib/services/projects';
import {
  createStudySession,
  deleteStudySession,
  getStudySession,
  updateStudySession,
} from '@/lib/services/study';
import { createTask, deleteTask, getTask, listTasks, updateTask } from '@/lib/services/tasks';

import { createTestUser, dayKeyOffset, deleteTestUsers } from './helpers';

/**
 * Cross-user isolation.
 *
 * Every service call takes the acting user's id and scopes its query by it, so
 * a valid id belonging to someone else must be indistinguishable from one that
 * does not exist.
 */
describe('cross-user data isolation', () => {
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    alice = await createTestUser('alice');
    bob = await createTestUser('bob');
  });

  afterAll(async () => {
    await deleteTestUsers(alice, bob);
  });

  it("hides another user's task from read, update and delete", async () => {
    const task = await createTask(alice, { title: "Alice's secret task" });

    await expect(getTask(bob, task.id)).rejects.toThrow(NotFoundError);
    await expect(updateTask(bob, task.id, { title: 'Hijacked' })).rejects.toThrow(NotFoundError);
    await expect(deleteTask(bob, task.id)).rejects.toThrow(NotFoundError);

    // The record is untouched and still reachable by its owner.
    const stillThere = await getTask(alice, task.id);
    expect(stillThere.title).toBe("Alice's secret task");
  });

  it("never lists another user's tasks", async () => {
    await createTask(alice, { title: 'Alice task A' });
    await createTask(bob, { title: 'Bob task B' });

    const aliceTasks = await listTasks(alice);
    const bobTasks = await listTasks(bob);

    expect(aliceTasks.every((task) => task.userId === alice)).toBe(true);
    expect(bobTasks.every((task) => task.userId === bob)).toBe(true);
    expect(aliceTasks.map((task) => task.title)).not.toContain('Bob task B');
  });

  it("refuses to attach a task to another user's project", async () => {
    const bobProject = await createProject(bob, { name: "Bob's project" });

    await expect(createTask(alice, { title: 'Sneaky', projectId: bobProject.id })).rejects.toThrow(
      NotFoundError,
    );

    const aliceTask = await createTask(alice, { title: 'Legit' });
    await expect(updateTask(alice, aliceTask.id, { projectId: bobProject.id })).rejects.toThrow(
      NotFoundError,
    );
  });

  it("hides another user's project", async () => {
    const project = await createProject(alice, { name: 'Private project' });
    await expect(getProject(bob, project.id)).rejects.toThrow(NotFoundError);
    await expect(updateProject(bob, project.id, { name: 'Taken' })).rejects.toThrow(NotFoundError);
    await expect(deleteProject(bob, project.id)).rejects.toThrow(NotFoundError);
  });

  it("hides another user's habit and refuses a foreign check-in", async () => {
    const habit = await createHabit(alice, { name: 'Private habit' });

    await expect(getHabit(bob, habit.id)).rejects.toThrow(NotFoundError);
    await expect(updateHabit(bob, habit.id, { name: 'Taken' })).rejects.toThrow(NotFoundError);
    await expect(deleteHabit(bob, habit.id)).rejects.toThrow(NotFoundError);
    await expect(
      checkInHabit(bob, { habitId: habit.id, date: dayKeyOffset(0), count: 1 }),
    ).rejects.toThrow(NotFoundError);
  });

  it("hides another user's study session", async () => {
    const { session } = await createStudySession(alice, {
      subject: 'Private study',
      durationMinutes: 30,
      sessionDate: new Date().toISOString(),
    });

    await expect(getStudySession(bob, session.id)).rejects.toThrow(NotFoundError);
    await expect(updateStudySession(bob, session.id, { subject: 'Taken' })).rejects.toThrow(
      NotFoundError,
    );
    await expect(deleteStudySession(bob, session.id)).rejects.toThrow(NotFoundError);
  });

  it("hides another user's workout", async () => {
    const { workout } = await createWorkout(alice, {
      name: 'Private workout',
      workoutDate: new Date().toISOString(),
      exercises: [{ name: 'Squat', sets: 3, reps: 5 }],
    });

    await expect(getWorkout(bob, workout.id)).rejects.toThrow(NotFoundError);
    await expect(updateWorkout(bob, workout.id, { name: 'Taken' })).rejects.toThrow(NotFoundError);
    await expect(deleteWorkout(bob, workout.id)).rejects.toThrow(NotFoundError);
  });

  it("hides another user's calendar event", async () => {
    const event = await createEvent(alice, {
      title: 'Private event',
      startTime: new Date().toISOString(),
    });

    await expect(getEvent(bob, event.id)).rejects.toThrow(NotFoundError);
    await expect(updateEvent(bob, event.id, { title: 'Taken' })).rejects.toThrow(NotFoundError);
    await expect(deleteEvent(bob, event.id)).rejects.toThrow(NotFoundError);
  });

  it("hides another user's journal entry from reads and search", async () => {
    const { entry } = await createJournalEntry(alice, {
      content: 'A deeply private thought',
      entryDate: new Date().toISOString(),
    });

    await expect(getJournalEntry(bob, entry.id)).rejects.toThrow(NotFoundError);
    await expect(updateJournalEntry(bob, entry.id, { content: 'Taken' })).rejects.toThrow(
      NotFoundError,
    );
    await expect(deleteJournalEntry(bob, entry.id)).rejects.toThrow(NotFoundError);

    const bobSearch = await listJournalEntries(bob, { search: 'deeply private' });
    expect(bobSearch).toHaveLength(0);

    const aliceSearch = await listJournalEntries(alice, { search: 'deeply private' });
    expect(aliceSearch).toHaveLength(1);
  });
});
