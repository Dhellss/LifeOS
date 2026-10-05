# Database

PostgreSQL schema reference. The source of truth is
[`prisma/schema.prisma`](../prisma/schema.prisma); this document explains the shape and the
invariants behind it.

## Contents

- [Overview](#overview)
- [Entity relationships](#entity-relationships)
- [Enums](#enums)
- [Auth tables](#auth-tables)
- [Domain tables](#domain-tables)
- [Gamification tables](#gamification-tables)
- [Constraints and what they protect](#constraints-and-what-they-protect)
- [Indexes](#indexes)
- [Timestamps vs dates](#timestamps-vs-dates)
- [Migrations](#migrations)
- [Seed data](#seed-data)
- [Useful queries](#useful-queries)

---

## Overview

Fifteen tables: four for authentication, one for preferences, and ten for the domain.

Three rules hold throughout:

1. **Every domain row is owned by exactly one user.** Each table carries `userId` with
   `ON DELETE CASCADE`, so ownership is enforceable with one `where` clause and deleting an
   account removes everything it owns.
2. **IDs are CUIDs.** Collision-resistant, sortable by creation time, and safe in a URL — a
   project detail page is `/projects/clx…` with no sequential ids to enumerate.
3. **Nothing derivable is stored.** No `taskCount`, no `progressPercent`, no `totalXP` column.
   See [Derived state](ARCHITECTURE.md#derived-state).

Prisma model names are PascalCase; the SQL tables are snake_case via `@@map`.

## Entity relationships

```
                            ┌──────────┐
                            │   user   │
                            └────┬─────┘
       ┌─────────────┬───────────┼───────────┬─────────────┬──────────────┐
       │             │           │           │             │              │
  ┌────▼────┐  ┌─────▼────┐ ┌────▼─────┐ ┌───▼──────┐ ┌────▼─────┐ ┌──────▼────────┐
  │ session │  │ account  │ │  user_   │ │ project  │ │  habit   │ │ study_session │
  └─────────┘  └──────────┘ │preferences│└────┬─────┘ └────┬─────┘ └───────────────┘
                            └──────────┘      │            │
                                         (SET NULL)   (CASCADE)
                                              │            │
                                         ┌────▼─────┐ ┌────▼──────┐
                                         │   task   │ │ habit_log │
                                         └──────────┘ └───────────┘
       ┌─────────────┬──────────────┬──────────────┬──────────────────┐
       │             │              │              │                  │
  ┌────▼────┐  ┌─────▼──────┐  ┌────▼──────┐  ┌────▼─────┐  ┌─────────▼────────┐
  │ workout │  │  calendar_ │  │  journal_ │  │ xp_event │  │ user_achievement │
  └────┬────┘  │   event    │  │   entry   │  └──────────┘  └──────────────────┘
       │       └────────────┘  └───────────┘
  (CASCADE)
       │
┌──────▼───────────┐
│ workout_exercise │
└──────────────────┘
```

Only two relations are not a direct child of `user`:

- `task.projectId` → `project.id`, **nullable**, `ON DELETE SET NULL`. Deleting a project keeps
  its tasks and unlinks them; the work survives the container.
- `workout_exercise.workoutId` → `workout.id`, **required**, `ON DELETE CASCADE`. An exercise
  has no meaning without its workout.

## Enums

| Enum | Values | Notes |
| --- | --- | --- |
| `TaskStatus` | `TODO`, `IN_PROGRESS`, `DONE`, `ARCHIVED` | `ARCHIVED` is excluded from progress and completion-rate denominators. |
| `TaskPriority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` | Declared low→high, so `ORDER BY priority DESC` puts `URGENT` first. |
| `ProjectStatus` | `ACTIVE`, `PAUSED`, `COMPLETED`, `ARCHIVED` | Only `ACTIVE` and `PAUSED` projects appear in the task form's picker. |
| `HabitFrequency` | `DAILY`, `WEEKLY` | |
| `CalendarEventType` | `TASK`, `STUDY`, `FITNESS`, `PERSONAL`, `PROJECT`, `OTHER` | Each maps to a chart colour token. |
| `Mood` | `GREAT`, `GOOD`, `NEUTRAL`, `LOW`, `BAD` | Nullable on `journal_entry`. |
| `XPEventType` | `TASK_COMPLETED`, `PROJECT_COMPLETED`, `HABIT_CHECKIN`, `STUDY_SESSION`, `WORKOUT_LOGGED`, `JOURNAL_ENTRY`, `ACHIEVEMENT_UNLOCKED` | Drives the "XP by source" breakdown. |

Enum values are validated by Zod before reaching the database, so an invalid value produces a
422 with a field message rather than a Postgres type error.

## Auth tables

### `user`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` PK | CUID |
| `name` | `text` | Required by Better Auth's signup |
| `email` | `text` UNIQUE | |
| `emailVerified` | `boolean` | Default `false`; verification flow not enabled |
| `image` | `text?` | Avatar URL |
| `createdAt` / `updatedAt` | `timestamp` | |

### `session`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` PK | |
| `token` | `text` UNIQUE | The value carried by the session cookie |
| `expiresAt` | `timestamp` | 30-day lifetime, refreshed at most once a day |
| `ipAddress` / `userAgent` | `text?` | Recorded by Better Auth |
| `userId` | `text` FK → `user` | `ON DELETE CASCADE` |

Sessions live in the database, so signing out — or deleting the row — invalidates immediately.

### `account`

Holds credentials and would hold OAuth tokens if social providers were enabled.

| Column | Type | Notes |
| --- | --- | --- |
| `providerId` | `text` | `credential` for email + password |
| `accountId` | `text` | The email, for the credential provider |
| `password` | `text?` | **scrypt hash**, never plaintext |
| `accessToken`, `refreshToken`, `idToken`, `scope`, `*ExpiresAt` | | Unused until OAuth is added |

`@@unique([providerId, accountId])` — one credential record per identity per provider.

### `verification`

Short-lived tokens for email verification and password reset. Present because Better Auth
expects it; no flow currently writes to it.

### `user_preferences`

One row per user, created lazily on first read by `getPreferences`.

| Column | Type | Default | Purpose |
| --- | --- | --- | --- |
| `userId` | `text` UNIQUE FK | | 1:1 with `user` |
| `timezone` | `text` | `UTC` | IANA name |
| `weekStartsOn` | `int` | `1` | 0 = Sunday, 1 = Monday |
| `dailyTaskGoal` | `int` | `5` | Dashboard goal hint |
| `weeklyStudyGoal` | `int` | `600` | Minutes per week |
| `weeklyWorkoutGoal` | `int` | `3` | Sessions per week |

## Domain tables

### `project`

| Column | Type | Notes |
| --- | --- | --- |
| `name` | `text` | 1–120 chars after trimming |
| `description` | `text?` | ≤2000 chars |
| `status` | `ProjectStatus` | Default `ACTIVE` |
| `color` | `text?` | `#rrggbb` |
| `startDate`, `targetDate` | `timestamp?` | `targetDate >= startDate` enforced in the service |
| `completedAt` | `timestamp?` | Set when status becomes `COMPLETED`, cleared when it leaves |

### `task`

| Column | Type | Notes |
| --- | --- | --- |
| `projectId` | `text?` FK → `project` | `ON DELETE SET NULL` |
| `title` | `text` | 1–200 chars after trimming |
| `description` | `text?` | ≤2000 chars |
| `status` | `TaskStatus` | Default `TODO` |
| `priority` | `TaskPriority` | Default `MEDIUM` |
| `dueDate` | `timestamp?` | |
| `completedAt` | `timestamp?` | **Derived from the status transition, never from the request body** |

### `habit`

| Column | Type | Notes |
| --- | --- | --- |
| `name` | `text` | 1–120 chars |
| `frequency` | `HabitFrequency` | Default `DAILY` |
| `targetCount` | `int` | Default `1`, range 1–50. A day counts toward a streak only at or above this |
| `isActive` | `boolean` | Default `true`; archiving sets it `false` rather than deleting |

### `habit_log`

| Column | Type | Notes |
| --- | --- | --- |
| `habitId` | `text` FK → `habit` | `ON DELETE CASCADE` |
| `date` | **`date`** | UTC midnight — one row per calendar day |
| `count` | `int` | Default `1`. Writing `0` deletes the row |
| `note` | `text?` | |

`@@unique([habitId, date])` is what makes "one check-in per habit per day" a database
guarantee rather than an application convention. Check-in is an upsert against this key.

### `study_session`

| Column | Type | Notes |
| --- | --- | --- |
| `subject` | `text` | 1–120 chars; also used as the grouping key for the breakdown |
| `topic` | `text?` | ≤200 chars |
| `durationMinutes` | `int` | 1–1440 |
| `sessionDate` | `timestamp` | |

### `workout` / `workout_exercise`

| `workout` column | Type | Notes |
| --- | --- | --- |
| `name` | `text` | |
| `workoutDate` | `timestamp` | |
| `durationMinutes` | `int?` | 1–1440 |

| `workout_exercise` column | Type | Notes |
| --- | --- | --- |
| `sets` | `int` | Default `1`, 1–100 |
| `reps` | `int?` | 1–1000 |
| `weight` | `double?` | Kilograms, 0–1000 |
| `durationSeconds` | `int?` | For timed exercises (planks, runs) |
| `position` | `int` | Display order; assigned from the form's row index |

Updating a workout replaces its whole exercise list inside a transaction, which maps cleanly
onto the repeatable form rows without client-side diffing.

### `calendar_event`

| Column | Type | Notes |
| --- | --- | --- |
| `startTime` | `timestamp` | |
| `endTime` | `timestamp?` | Must be `>= startTime`, checked on create *and* on partial update |
| `type` | `CalendarEventType` | Default `OTHER` |
| `allDay` | `boolean` | Hides the time in the UI |
| `location` | `text?` | |

### `journal_entry`

| Column | Type | Notes |
| --- | --- | --- |
| `title` | `text?` | Optional |
| `content` | `text` | 1–20,000 chars; whitespace-only is rejected |
| `mood` | `Mood?` | |
| `entryDate` | **`date`** | Not unique — several entries per day are allowed |

## Gamification tables

### `xp_event`

An append-only ledger. The user's total is `SUM(points)`; level is derived from that.

| Column | Type | Notes |
| --- | --- | --- |
| `type` | `XPEventType` | |
| `points` | `int` | |
| `reason` | `text` | Human-readable, shown in the activity feed |
| `dedupeKey` | `text` | Stable identity of the rewarded action |

`@@unique([userId, dedupeKey])` is the core integrity guarantee of the XP system. See
[The XP and achievement engine](ARCHITECTURE.md#the-xp-and-achievement-engine).

Rows are never updated or deleted. Un-completing a task does not refund XP — the ledger records
what happened, and the act of completing it did happen.

### `user_achievement`

| Column | Type | Notes |
| --- | --- | --- |
| `achievementKey` | `text` | Matches a key in `lib/achievements.ts` |
| `unlockedAt` | `timestamp` | |

`@@unique([userId, achievementKey])` — an achievement unlocks at most once.

Definitions (title, description, icon, metric, threshold) live in code because they are product
content; only the unlock *event* is user data. Adding an achievement needs no migration.

## Constraints and what they protect

| Constraint | Protects against |
| --- | --- |
| `user.email` UNIQUE | Duplicate registrations |
| `session.token` UNIQUE | Session-token collision |
| `account (providerId, accountId)` UNIQUE | Two credential records for one identity |
| `habit_log (habitId, date)` UNIQUE | More than one check-in per habit per day |
| `xp_event (userId, dedupeKey)` UNIQUE | Double-awarding XP for the same action, including under concurrent requests |
| `user_achievement (userId, achievementKey)` UNIQUE | Unlocking the same achievement twice |
| `user_preferences.userId` UNIQUE | Two preference rows for one user |
| `userId` FK + CASCADE on all domain tables | Orphaned rows after account deletion |
| `task.projectId` FK + SET NULL | Losing tasks when a project is deleted |
| `workout_exercise.workoutId` FK + CASCADE | Orphaned exercise rows |

Two of these are load-bearing for business rules rather than mere hygiene — the `habit_log` and
`xp_event` unique indexes — and both are covered directly by integration tests.

## Indexes

Every index matches a query the app actually issues:

| Table | Index | Serves |
| --- | --- | --- |
| `task` | `(userId, status)` | status filter, status counts |
| `task` | `(userId, dueDate)` | due-today, overdue, due-date sort |
| `task` | `(userId, completedAt)` | completion trend, tasks-completed-per-day |
| `task` | `(projectId)` | project detail, progress derivation |
| `project` | `(userId, status)` | status filter, active-project cards |
| `project` | `(userId, createdAt)` | default listing order |
| `habit` | `(userId, isActive)` | active habit list |
| `habit_log` | `(userId, date)` | completion-by-day analytics |
| `study_session` | `(userId, sessionDate)` | day/week/month totals, trend |
| `study_session` | `(userId, subject)` | subject breakdown |
| `workout` | `(userId, workoutDate)` | weekly counts, frequency chart |
| `workout_exercise` | `(workoutId)` | exercise rows per workout |
| `calendar_event` | `(userId, startTime)` | month window, agenda, upcoming |
| `journal_entry` | `(userId, entryDate)` | listing, streak, entries-per-day |
| `xp_event` | `(userId, createdAt)` | XP trend, recent activity |
| `session` / `account` | `(userId)` | session lookup, credential lookup |

Free-text search on tasks and journal entries uses `ILIKE` via Prisma's
`contains` + `mode: 'insensitive'`. At a personal-dataset scale this is fine; a multi-tenant
deployment would want a `tsvector` column with a GIN index instead.

## Migrations

```bash
npm run db:migrate            # create + apply a migration from schema changes (dev)
npm run db:migrate:deploy     # apply pending migrations only (production, CI)
npm run db:generate           # regenerate the typed client
npm run db:push               # apply without a migration file (prototyping only)
npm run db:reset              # drop, re-migrate, re-seed - DESTROYS DATA
npm run db:studio             # browse the data
```

Migration files live in `prisma/migrations/` and are committed. Workflow for a schema change:

1. Edit `prisma/schema.prisma`.
2. `npx prisma format && npx prisma validate`.
3. `npm run db:migrate -- --name describe_the_change`.
4. Review the generated SQL — Prisma will warn about destructive operations.
5. Commit the schema and the migration directory together.
6. Apply to the test database too: `DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy`.

In production, `docker/entrypoint.sh` runs `prisma migrate deploy` before the server starts, so
a container deploy needs no separate migration step.

## Seed data

`npm run db:seed` runs [`prisma/seed.ts`](../prisma/seed.ts), creating one demo account with
roughly two months of plausible history:

| | Count |
| --- | --- |
| Projects | 4 (active, paused and completed) |
| Tasks | 24 across all four statuses and priorities, most linked to a project |
| Habits | 5, including a multi-count one, with ~260 check-ins over 70 days |
| Study sessions | ~55 across 5 subjects over 60 days |
| Workouts | ~32 from 4 templates, with progressive overload on the weights |
| Calendar events | ~45 — a recurring weekly timetable plus one-off deadlines |
| Journal entries | 10 with varied moods, spread to produce a live streak |
| XP events | ~360, generated by the **real award builders** |
| Achievements | Unlocked by running the **real `syncAchievements`** against the seeded rows |

Two details worth noting:

- The generator uses a **seeded PRNG**, so repeated runs produce the same dataset. Screenshots
  stay stable between seeds.
- XP and achievements are not hard-coded. The seed calls `taskCompletedAward`,
  `habitCheckinAward` and friends, then `syncAchievements`, so the demo account's level and
  badges are whatever the real rules produce from the real rows. If the XP rules change, the
  seed's output changes with them.

The seed deletes and recreates the demo user by email, so it is safe to re-run — and must
never be pointed at a production database.

## Useful queries

Sanity checks against a live database (`psql $DATABASE_URL`).

```sql
-- Row counts per table for one user.
SELECT 'task' AS table, COUNT(*) FROM task WHERE "userId" = $1
UNION ALL SELECT 'habit_log', COUNT(*) FROM habit_log WHERE "userId" = $1
UNION ALL SELECT 'xp_event', COUNT(*) FROM xp_event WHERE "userId" = $1;

-- Total XP and derived level.
SELECT SUM(points) AS total_xp,
       FLOOR(SUM(points) / 100.0) + 1 AS level
FROM xp_event WHERE "userId" = $1;

-- Confirm the dedupe index is doing its job: this must return no rows.
SELECT "userId", "dedupeKey", COUNT(*)
FROM xp_event GROUP BY 1, 2 HAVING COUNT(*) > 1;

-- Project progress, computed the same way the app does.
SELECT p.name,
       COUNT(*) FILTER (WHERE t.status = 'DONE')                       AS done,
       COUNT(*) FILTER (WHERE t.status <> 'ARCHIVED')                  AS countable,
       ROUND(100.0 * COUNT(*) FILTER (WHERE t.status = 'DONE')
             / NULLIF(COUNT(*) FILTER (WHERE t.status <> 'ARCHIVED'), 0)) AS percent
FROM project p LEFT JOIN task t ON t."projectId" = p.id
WHERE p."userId" = $1 GROUP BY p.id, p.name ORDER BY p.name;

-- Study minutes per subject.
SELECT subject, SUM("durationMinutes") AS minutes, COUNT(*) AS sessions
FROM study_session WHERE "userId" = $1 GROUP BY subject ORDER BY minutes DESC;

-- Habit days that met their target.
SELECT h.name, COUNT(*) AS qualifying_days
FROM habit h JOIN habit_log l ON l."habitId" = h.id
WHERE h."userId" = $1 AND l.count >= h."targetCount"
GROUP BY h.id, h.name ORDER BY qualifying_days DESC;
```
