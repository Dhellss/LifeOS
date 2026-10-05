/**
 * Seed script: builds one realistic demo account.
 *
 * Everything is written to PostgreSQL through Prisma — the UI reads these rows
 * like any other user's data, so the demo dashboard exercises the same code
 * paths as a real account.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

import {
  habitCheckinAward,
  journalEntryAward,
  projectCompletedAward,
  studySessionAward,
  taskCompletedAward,
  workoutAward,
} from '../lib/xp';

const prisma = new PrismaClient();

const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL ?? 'demo@lifeos.app';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'demo-password-123';
const DEMO_NAME = 'Demo Student';

/** Deterministic PRNG so repeated seeds produce the same demo dataset. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
const random = makeRandom(20_261_004);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

const TODAY = new Date();
TODAY.setHours(12, 0, 0, 0);

function daysAgo(days: number, hour = 12): Date {
  const date = new Date(TODAY);
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function dateOnly(days: number): Date {
  const date = daysAgo(days);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function dayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, '0')}-${`${date.getUTCDate()}`.padStart(2, '0')}`;
}

async function main() {
  console.log('→ Seeding LifeOS demo data');

  // A fresh start keeps the demo dataset reproducible. Cascades remove the
  // user's owned rows, so only the user row needs deleting.
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const user = await prisma.user.create({
    data: {
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      emailVerified: true,
      createdAt: daysAgo(120),
      accounts: {
        create: {
          // Hashed with Better Auth's own helper so the seeded demo account
          // signs in through the normal login form.
          accountId: DEMO_EMAIL,
          providerId: 'credential',
          password: await hashPassword(DEMO_PASSWORD),
        },
      },
      preferences: {
        create: {
          timezone: 'Europe/Berlin',
          weekStartsOn: 1,
          dailyTaskGoal: 5,
          weeklyStudyGoal: 720,
          weeklyWorkoutGoal: 4,
        },
      },
    },
  });
  console.log(`  user: ${user.email}`);

  const xpEvents: Prisma.XPEventCreateManyInput[] = [];
  const award = (
    event: {
      type: Prisma.XPEventCreateManyInput['type'];
      points: number;
      reason: string;
      dedupeKey: string;
    },
    createdAt: Date,
  ) => {
    xpEvents.push({ ...event, userId: user.id, createdAt });
  };

  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------
  const projectSpecs = [
    {
      name: 'Distributed Systems coursework',
      description: 'Raft implementation, written report and the final presentation.',
      status: 'ACTIVE' as const,
      color: '#6366f1',
      startDate: daysAgo(45),
      targetDate: daysAgo(-20),
    },
    {
      name: 'Portfolio site rebuild',
      description:
        'Rewrite the personal site with proper case studies and a CMS-free content flow.',
      status: 'ACTIVE' as const,
      color: '#14b8a6',
      startDate: daysAgo(30),
      targetDate: daysAgo(-10),
    },
    {
      name: 'Internship applications',
      description: 'CV refresh, cover letter templates and a tracked shortlist of 20 companies.',
      status: 'PAUSED' as const,
      color: '#f59e0b',
      startDate: daysAgo(60),
      targetDate: daysAgo(-40),
    },
    {
      name: 'Compilers reading group',
      description: 'Worked through the dragon book chapters 1-6 with weekly notes.',
      status: 'COMPLETED' as const,
      color: '#a855f7',
      startDate: daysAgo(110),
      targetDate: daysAgo(25),
      completedAt: daysAgo(22),
    },
  ];

  const projects = [];
  for (const spec of projectSpecs) {
    const project = await prisma.project.create({
      data: { ...spec, userId: user.id, createdAt: spec.startDate },
    });
    projects.push(project);
    if (project.completedAt) {
      award(projectCompletedAward(project), project.completedAt);
    }
  }
  console.log(`  projects: ${projects.length}`);

  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------
  const taskSpecs: {
    title: string;
    description?: string;
    status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    dueIn?: number;
    completedDaysAgo?: number;
    project?: number;
  }[] = [
    {
      title: 'Implement Raft leader election',
      description: 'Terms, timeouts and vote tallying.',
      status: 'DONE',
      priority: 'HIGH',
      dueIn: -12,
      completedDaysAgo: 13,
      project: 0,
    },
    {
      title: 'Implement Raft log replication',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueIn: 3,
      project: 0,
    },
    {
      title: 'Write the coursework report intro',
      status: 'TODO',
      priority: 'MEDIUM',
      dueIn: 6,
      project: 0,
    },
    {
      title: 'Benchmark the cluster under partition',
      status: 'TODO',
      priority: 'URGENT',
      dueIn: 1,
      project: 0,
    },
    {
      title: 'Prepare the 10-minute presentation',
      status: 'TODO',
      priority: 'MEDIUM',
      dueIn: 18,
      project: 0,
    },
    {
      title: 'Design the case-study layout',
      status: 'DONE',
      priority: 'MEDIUM',
      dueIn: -8,
      completedDaysAgo: 9,
      project: 1,
    },
    {
      title: 'Migrate the blog posts to MDX',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      dueIn: 2,
      project: 1,
    },
    {
      title: 'Add an accessibility pass',
      description: 'Keyboard traps, contrast, focus order.',
      status: 'TODO',
      priority: 'HIGH',
      dueIn: 5,
      project: 1,
    },
    {
      title: 'Set up CI for the site',
      status: 'DONE',
      priority: 'LOW',
      dueIn: -4,
      completedDaysAgo: 5,
      project: 1,
    },
    {
      title: 'Rewrite the CV summary',
      status: 'DONE',
      priority: 'HIGH',
      dueIn: -30,
      completedDaysAgo: 31,
      project: 2,
    },
    {
      title: 'Shortlist 20 target companies',
      status: 'DONE',
      priority: 'MEDIUM',
      dueIn: -26,
      completedDaysAgo: 27,
      project: 2,
    },
    {
      title: 'Draft the cover letter template',
      status: 'TODO',
      priority: 'MEDIUM',
      dueIn: 14,
      project: 2,
    },
    {
      title: 'Summarise dragon book ch. 5',
      status: 'DONE',
      priority: 'MEDIUM',
      dueIn: -28,
      completedDaysAgo: 29,
      project: 3,
    },
    {
      title: 'Summarise dragon book ch. 6',
      status: 'DONE',
      priority: 'MEDIUM',
      dueIn: -24,
      completedDaysAgo: 24,
      project: 3,
    },
    { title: 'Renew the library loan', status: 'TODO', priority: 'LOW', dueIn: 9 },
    { title: 'Book the dentist appointment', status: 'TODO', priority: 'MEDIUM', dueIn: 0 },
    {
      title: 'Reply to the lab group thread',
      status: 'DONE',
      priority: 'URGENT',
      dueIn: -1,
      completedDaysAgo: 1,
    },
    { title: 'Plan next week in LifeOS', status: 'TODO', priority: 'LOW', dueIn: 0 },
    {
      title: 'Back up the thesis folder',
      status: 'DONE',
      priority: 'HIGH',
      dueIn: -2,
      completedDaysAgo: 2,
    },
    { title: 'Cancel the unused subscription', status: 'ARCHIVED', priority: 'LOW' },
    {
      title: 'Read the Kafka internals post',
      status: 'DONE',
      priority: 'LOW',
      dueIn: -6,
      completedDaysAgo: 6,
    },
    {
      title: 'Fix the flaky integration test',
      status: 'DONE',
      priority: 'URGENT',
      dueIn: -3,
      completedDaysAgo: 3,
      project: 1,
    },
    { title: 'Order the new keyboard', status: 'TODO', priority: 'LOW', dueIn: 21 },
    {
      title: 'Review pull request #142',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueIn: 1,
      project: 1,
    },
  ];

  let taskCount = 0;
  for (const spec of taskSpecs) {
    const completedAt =
      spec.status === 'DONE' ? daysAgo(spec.completedDaysAgo ?? 1, randomInt(9, 21)) : null;
    const task = await prisma.task.create({
      data: {
        userId: user.id,
        projectId: spec.project === undefined ? null : projects[spec.project]!.id,
        title: spec.title,
        description: spec.description,
        status: spec.status,
        priority: spec.priority,
        dueDate: spec.dueIn === undefined ? null : daysAgo(-spec.dueIn, 17),
        completedAt,
        createdAt: daysAgo((spec.completedDaysAgo ?? 0) + randomInt(2, 10)),
      },
    });
    taskCount += 1;
    if (completedAt) award(taskCompletedAward(task), completedAt);
  }
  console.log(`  tasks: ${taskCount}`);

  // -------------------------------------------------------------------------
  // Habits + logs
  // -------------------------------------------------------------------------
  const habitSpecs = [
    {
      name: 'Morning reading',
      description: '30 pages before anything else.',
      targetCount: 1,
      color: '#6366f1',
      reliability: 0.86,
    },
    { name: 'Drink 2L of water', targetCount: 8, color: '#0ea5e9', reliability: 0.72 },
    { name: 'Stretch for 10 minutes', targetCount: 1, color: '#14b8a6', reliability: 0.64 },
    {
      name: 'Review flashcards',
      description: 'Spaced repetition deck for the current module.',
      targetCount: 1,
      color: '#f59e0b',
      reliability: 0.9,
    },
    { name: 'No screens after 23:00', targetCount: 1, color: '#a855f7', reliability: 0.55 },
  ];

  let habitLogCount = 0;
  for (const spec of habitSpecs) {
    const habit = await prisma.habit.create({
      data: {
        userId: user.id,
        name: spec.name,
        description: spec.description,
        frequency: 'DAILY',
        targetCount: spec.targetCount,
        color: spec.color,
        createdAt: daysAgo(70),
      },
    });

    for (let offset = 69; offset >= 0; offset -= 1) {
      // Keep the most recent days intact so the demo shows a live streak.
      const hit = offset <= 2 ? true : random() < spec.reliability;
      if (!hit) continue;

      const count =
        spec.targetCount === 1
          ? 1
          : random() < 0.75
            ? spec.targetCount
            : randomInt(Math.ceil(spec.targetCount / 2), spec.targetCount - 1);

      const date = dateOnly(offset);
      await prisma.habitLog.create({
        data: { habitId: habit.id, userId: user.id, date, count },
      });
      habitLogCount += 1;

      if (count >= habit.targetCount) {
        award(
          habitCheckinAward({ habitId: habit.id, dayKey: dayKey(date), habitName: habit.name }),
          daysAgo(offset, 8),
        );
      }
    }
  }
  console.log(`  habits: ${habitSpecs.length} (${habitLogCount} check-ins)`);

  // -------------------------------------------------------------------------
  // Study sessions
  // -------------------------------------------------------------------------
  const SUBJECTS = [
    {
      subject: 'Distributed Systems',
      topics: ['Raft', 'Consistency models', 'Gossip protocols', 'CAP in practice'],
    },
    { subject: 'Compilers', topics: ['LR parsing', 'SSA form', 'Register allocation'] },
    { subject: 'Linear Algebra', topics: ['Eigenvalues', 'SVD', 'Least squares'] },
    { subject: 'TypeScript', topics: ['Conditional types', 'Variance', 'Declaration merging'] },
    { subject: 'German', topics: ['Dativ practice', 'Listening drills', 'Verb prefixes'] },
  ] as const;

  let studyCount = 0;
  for (let offset = 60; offset >= 0; offset -= 1) {
    const sessionsToday = random() < 0.62 ? randomInt(1, 2) : 0;
    for (let index = 0; index < sessionsToday; index += 1) {
      const entry = pick(SUBJECTS);
      const session = await prisma.studySession.create({
        data: {
          userId: user.id,
          subject: entry.subject,
          topic: pick(entry.topics),
          durationMinutes: pick([25, 30, 45, 50, 60, 75, 90] as const),
          notes:
            random() < 0.4
              ? 'Took notes in Obsidian; revisit the parts that were still shaky.'
              : null,
          sessionDate: daysAgo(offset, randomInt(9, 21)),
          createdAt: daysAgo(offset, randomInt(9, 21)),
        },
      });
      studyCount += 1;
      award(studySessionAward(session), session.sessionDate);
    }
  }
  console.log(`  study sessions: ${studyCount}`);

  // -------------------------------------------------------------------------
  // Workouts + exercises
  // -------------------------------------------------------------------------
  const WORKOUT_TEMPLATES = [
    {
      name: 'Upper body push',
      exercises: [
        { name: 'Bench press', sets: 4, reps: 8, weight: 60 },
        { name: 'Overhead press', sets: 3, reps: 10, weight: 35 },
        { name: 'Incline dumbbell press', sets: 3, reps: 12, weight: 20 },
        { name: 'Triceps pushdown', sets: 3, reps: 15, weight: 25 },
      ],
    },
    {
      name: 'Lower body',
      exercises: [
        { name: 'Back squat', sets: 5, reps: 5, weight: 85 },
        { name: 'Romanian deadlift', sets: 3, reps: 10, weight: 70 },
        { name: 'Leg press', sets: 3, reps: 12, weight: 120 },
        { name: 'Calf raise', sets: 4, reps: 15, weight: 40 },
      ],
    },
    {
      name: 'Pull day',
      exercises: [
        { name: 'Deadlift', sets: 4, reps: 5, weight: 110 },
        { name: 'Pull-up', sets: 4, reps: 8, weight: null },
        { name: 'Barbell row', sets: 3, reps: 10, weight: 55 },
        { name: 'Face pull', sets: 3, reps: 15, weight: 20 },
      ],
    },
    {
      name: 'Easy run',
      exercises: [{ name: '5k steady run', sets: 1, reps: null, weight: null }],
    },
  ] as const;

  let workoutCount = 0;
  for (let offset = 60; offset >= 0; offset -= 1) {
    if (random() > 0.45) continue;
    const template = pick(WORKOUT_TEMPLATES);
    const workoutDate = daysAgo(offset, randomInt(7, 20));

    const workout = await prisma.workout.create({
      data: {
        userId: user.id,
        name: template.name,
        workoutDate,
        durationMinutes: template.name === 'Easy run' ? randomInt(26, 34) : randomInt(45, 80),
        notes: random() < 0.3 ? 'Felt strong; added a little weight on the main lift.' : null,
        createdAt: workoutDate,
        exercises: {
          create: template.exercises.map((exercise, index) => ({
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            // Small progressive overload as the dates get more recent.
            weight:
              exercise.weight === null
                ? null
                : Math.round((exercise.weight + (60 - offset) * 0.15) * 2) / 2,
            position: index,
          })),
        },
      },
    });
    workoutCount += 1;
    award(workoutAward(workout), workoutDate);
  }
  console.log(`  workouts: ${workoutCount}`);

  // -------------------------------------------------------------------------
  // Calendar events
  // -------------------------------------------------------------------------
  const eventSpecs: Prisma.CalendarEventCreateManyInput[] = [];
  const RECURRING = [
    {
      title: 'Distributed Systems lecture',
      type: 'STUDY' as const,
      weekday: 1,
      hour: 10,
      duration: 90,
      location: 'Hall C',
    },
    {
      title: 'Compilers lab',
      type: 'STUDY' as const,
      weekday: 3,
      hour: 14,
      duration: 120,
      location: 'Lab 2.14',
    },
    {
      title: 'Gym — pull day',
      type: 'FITNESS' as const,
      weekday: 2,
      hour: 18,
      duration: 75,
      location: 'Campus gym',
    },
    {
      title: 'Gym — leg day',
      type: 'FITNESS' as const,
      weekday: 5,
      hour: 18,
      duration: 75,
      location: 'Campus gym',
    },
    {
      title: 'Weekly review',
      type: 'PERSONAL' as const,
      weekday: 0,
      hour: 20,
      duration: 45,
      location: null,
    },
  ];

  for (let offset = 28; offset >= -28; offset -= 1) {
    const date = daysAgo(offset);
    const weekday = date.getDay();
    for (const slot of RECURRING) {
      if (slot.weekday !== weekday) continue;
      const startTime = daysAgo(offset, slot.hour);
      eventSpecs.push({
        userId: user.id,
        title: slot.title,
        type: slot.type,
        startTime,
        endTime: new Date(startTime.getTime() + slot.duration * 60_000),
        location: slot.location,
        allDay: false,
      });
    }
  }

  eventSpecs.push(
    {
      userId: user.id,
      title: 'Coursework submission deadline',
      description: 'Upload the report and the code archive to the portal.',
      type: 'PROJECT',
      startTime: daysAgo(-20, 23),
      allDay: true,
    },
    {
      userId: user.id,
      title: 'Internship interview — Northwind',
      description: 'Systems design round. Revisit consistency trade-offs.',
      type: 'PERSONAL',
      startTime: daysAgo(-6, 11),
      endTime: daysAgo(-6, 12),
      location: 'Video call',
    },
    {
      userId: user.id,
      title: 'Reading group wrap-up dinner',
      type: 'PERSONAL',
      startTime: daysAgo(-3, 19),
      endTime: daysAgo(-3, 22),
      location: 'Trattoria Bella',
    },
    {
      userId: user.id,
      title: 'Dentist',
      type: 'OTHER',
      startTime: daysAgo(-2, 9),
      endTime: daysAgo(-2, 10),
    },
  );

  await prisma.calendarEvent.createMany({ data: eventSpecs });
  console.log(`  calendar events: ${eventSpecs.length}`);

  // -------------------------------------------------------------------------
  // Journal entries
  // -------------------------------------------------------------------------
  const JOURNAL_SEEDS = [
    {
      title: 'Leader election finally clicked',
      mood: 'GREAT' as const,
      content:
        'Spent the morning drawing out the term transitions by hand and the Raft paper suddenly made sense. The bug was that I was resetting the election timer on the wrong branch. Writing the state machine out as a table before coding would have saved two days.',
    },
    {
      title: 'Slow day',
      mood: 'LOW' as const,
      content:
        'Low energy, poor sleep. Did the minimum: flashcards and a short stretch. Logging it anyway because skipping the log is how the streak dies.',
    },
    {
      title: 'Portfolio direction',
      mood: 'GOOD' as const,
      content:
        'Decided the site should lead with three deep case studies rather than a long project list. Depth over breadth — the same argument I keep making about coursework.',
    },
    {
      title: 'Interview prep notes',
      mood: 'NEUTRAL' as const,
      content:
        'Ran through consistency models out loud. I can explain linearizability but I fumble causal consistency. Need a crisper example — probably the comment-reply ordering one.',
    },
    {
      title: 'Good training week',
      mood: 'GREAT' as const,
      content:
        'Four sessions, squat up to 85kg for five. Sleep has been better since cutting screens after eleven, which the habit tracker now shows plainly.',
    },
    {
      title: 'Scope creep',
      mood: 'LOW' as const,
      content:
        'Caught myself redesigning the site navigation instead of migrating the posts. Moved the design idea to a separate task and went back to the actual blocker.',
    },
    {
      title: 'Reading group finished',
      mood: 'GOOD' as const,
      content:
        'Closed out the dragon book project. Six chapters, weekly notes, and a much better intuition for parsing. Keeping the notes as the basis for a blog post.',
    },
    {
      title: 'Flaky test fixed',
      mood: 'GOOD' as const,
      content:
        'The integration test was racing on a shared fixture. Isolating the database per test made it deterministic. Obvious in retrospect, as always.',
    },
    {
      title: 'Planning the next month',
      mood: 'NEUTRAL' as const,
      content:
        'Coursework first, applications second, site third. Writing the order down so I stop context-switching between all three every afternoon.',
    },
    {
      title: 'Tired but on track',
      mood: 'NEUTRAL' as const,
      content:
        'Study hours are holding around twelve a week, which is enough. The habit I keep dropping is stretching — moving it to right after the gym instead of the morning.',
    },
  ];

  const journalOffsets = [0, 1, 2, 4, 6, 9, 13, 18, 24, 31];
  for (const [index, offset] of journalOffsets.entries()) {
    const seed = JOURNAL_SEEDS[index]!;
    const entryDate = dateOnly(offset);
    const entry = await prisma.journalEntry.create({
      data: {
        userId: user.id,
        title: seed.title,
        content: seed.content,
        mood: seed.mood,
        entryDate,
        createdAt: daysAgo(offset, 22),
      },
    });
    award(journalEntryAward({ id: entry.id, dayKey: dayKey(entryDate) }), daysAgo(offset, 22));
  }
  console.log(`  journal entries: ${journalOffsets.length}`);

  // -------------------------------------------------------------------------
  // XP + achievements
  // -------------------------------------------------------------------------
  await prisma.xPEvent.createMany({ data: xpEvents, skipDuplicates: true });
  const totalXP = xpEvents.reduce((sum, event) => sum + event.points, 0);
  console.log(`  xp events: ${xpEvents.length} (${totalXP} XP)`);

  // Evaluate the real achievement rules against the seeded data rather than
  // hard-coding which badges the demo account has.
  const { syncAchievements } = await import('../lib/services/achievements');
  const unlocked = await syncAchievements(user.id);
  console.log(`  achievements unlocked: ${unlocked.length}`);

  console.log('\n✓ Seed complete');
  console.log(`  Sign in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('✗ Seed failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
