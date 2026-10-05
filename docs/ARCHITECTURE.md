# Architecture

How LifeOS is put together, and why. Read this before making a structural change.

## Contents

- [Layers](#layers)
- [Request flows](#request-flows)
- [Authentication and authorization](#authentication-and-authorization)
- [Validation strategy](#validation-strategy)
- [Error handling](#error-handling)
- [Derived state](#derived-state)
- [The XP and achievement engine](#the-xp-and-achievement-engine)
- [Date and timezone handling](#date-and-timezone-handling)
- [UI architecture](#ui-architecture)
- [Performance notes](#performance-notes)
- [Conventions](#conventions)
- [Known limitations](#known-limitations)

---

## Layers

```
┌───────────────────────────────────────────────────────────────────────┐
│ app/(dashboard)/**/page.tsx          Server Components               │
│   • call requireUser() via the segment layout                        │
│   • read through lib/services/*                                      │
│   • pass plain data to client components                             │
├───────────────────────────────────────────────────────────────────────┤
│ components/**                         Client Components              │
│   • forms (React Hook Form + Zod), charts (Recharts), dialogs        │
│   • mutate through lib/api-client.ts -> /api/*                       │
│   • call router.refresh() to re-render the server tree               │
├───────────────────────────────────────────────────────────────────────┤
│ app/api/**/route.ts                   HTTP boundary                  │
│   • requireApiUser() -> 401 when there is no session                 │
│   • readJson() -> hand the payload to a service                      │
│   • wrap the result in { data } or { error } (lib/api-response.ts)   │
├───────────────────────────────────────────────────────────────────────┤
│ lib/services/**                       Business logic                 │
│   • take the acting userId as the first argument                     │
│   • validate input with Zod (parseOrThrow)                           │
│   • scope every query by userId                                      │
│   • own the XP + achievement side effects                            │
├───────────────────────────────────────────────────────────────────────┤
│ lib/{xp,streaks,progress,achievements,dates,utils}.ts   Pure logic   │
│   • no I/O, no database, no React - fully unit-testable              │
├───────────────────────────────────────────────────────────────────────┤
│ lib/db.ts -> Prisma -> PostgreSQL                                    │
└───────────────────────────────────────────────────────────────────────┘
```

The important property is that **each layer only talks to the one below it**. A page never
touches Prisma; a route handler never writes a `where` clause; a service never imports React.

One consequence is easy to get wrong: a Server Component may *render* a Client Component, but it
may not **call a function** exported from a `'use client'` module. Next.js rejects that at
runtime, not at build time, so it surfaces as a 500 on the affected route. Shared pure helpers
therefore live in `lib/` rather than next to the components that use them - `formatDayTick` sits
in `lib/dates.ts` precisely because the Study, Fitness and Analytics pages build their chart
labels server-side before handing the data to a client chart.

## Request flows

### Reading a page

```
GET /tasks?status=TODO
  → app/(dashboard)/layout.tsx    requireUser()  → redirect('/login') if no session
  → app/(dashboard)/tasks/page.tsx
      listTasks(user.id, searchParams)
      getTaskStats(user.id)
      getProjectOptions(user.id)      ← three parallel reads
  → React renders server-side, streams HTML
```

Search params are passed straight into the service, which validates them with
`taskFilterSchema` and applies defaults. A junk `?status=BANANA` produces a 422-equivalent
`ValidationError`, not a silently ignored filter.

### Writing a record

```
Client: TaskDialog submits
  → taskFormSchema (client)         instant feedback, string-shaped values
  → api.post('/api/tasks', payload)
      → requireApiUser()            401 if the session cookie is missing/expired
      → createTask(user.id, body)
          → parseOrThrow(taskCreateSchema, body)      authoritative validation
          → assertProjectOwnership(userId, projectId) 404 if it is someone else's
          → prisma.task.create({ data: { userId, ... } })
          → awardXP(...) if the task was created DONE
          → syncAchievements(userId)
      ← created(task)  →  201 { data: task }
  → toast + router.refresh()         server tree re-renders with the new row
```

`router.refresh()` rather than client-side cache mutation: the dashboard aggregates, the
sidebar's XP bar and the task list all derive from the same database rows, so re-running the
server read is both simpler and guaranteed consistent.

## Authentication and authorization

**Authentication** is Better Auth with the Prisma adapter
([`lib/auth.ts`](../lib/auth.ts)). Credentials are scrypt-hashed into `account.password`;
sessions are rows in `session` referenced by an httpOnly, SameSite=Lax cookie (Secure in
production). The handler is mounted once at `app/api/auth/[...all]/route.ts`.

**Session resolution** lives in [`lib/session.ts`](../lib/session.ts):

| Function | Used by | Behaviour when unauthenticated |
| --- | --- | --- |
| `getCurrentUser()` | landing page, auth layout | returns `null` |
| `requireUser()` | `app/(dashboard)/layout.tsx` | `redirect('/login')` |
| `requireApiUser()` | every route handler | throws `UnauthorizedError` → 401 |

`getCurrentUser` is wrapped in React's `cache()`, so a render pass that asks for the user from
the layout, the page and a nested component hits the session table once.

The `Secure` cookie flag is keyed off `BETTER_AUTH_URL`'s scheme rather than `NODE_ENV`. A
`Secure` cookie is only ever transmitted over https, so marking one on an http origin makes
sign-in fail silently - which is exactly what happens when a production build is smoke-tested
over plain http. **In a real deployment `BETTER_AUTH_URL` must be the https origin**, or sessions
will not be protected in transit.

**Authorization** is ownership scoping, and it lives in the service layer rather than in
middleware or route handlers. Every service function's first parameter is the acting `userId`,
and every query includes it:

```ts
const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
if (!task) throw new NotFoundError('Task');
```

The consequence is deliberate: **"belongs to someone else" and "does not exist" produce the
same 404.** A client cannot use error codes to enumerate other users' record ids.

Cross-references are checked too — `createTask` calls `assertProjectOwnership` before linking a
task to a `projectId`, so a crafted request cannot attach a row to a foreign project.

**Rate limiting.** The auth endpoints are throttled in `lib/auth.ts`: 120 requests per minute
across the surface, and 10 per minute for `/sign-in/email` and `/sign-up/email`, which are the
endpoints worth brute-forcing. The configuration is written out explicitly rather than left to
Better Auth's default (which only switches on when `NODE_ENV === 'production'`), so the limits
are visible and reviewable. `AUTH_RATE_LIMIT_DISABLED=true` turns it off and is set only by
`playwright.config.ts`, because the E2E suite registers an account per test.

`middleware.ts` is deliberately absent. Guarding in the segment layout runs the same check with
full database access and no edge-runtime constraints, and there is only one place to audit.

## Validation strategy

Two schema families, in [`lib/validations/`](../lib/validations/):

| | Client (`forms.ts`) | Server (`task.ts`, `project.ts`, …) |
| --- | --- | --- |
| Shape | every field a `string`/`boolean`, as `<input>` produces | transformed domain values (`Date`, `number`, enums) |
| Purpose | instant inline feedback, typed `useForm` values | the authoritative check |
| Runs in | the browser | the route handler, via `parseOrThrow` |

Keeping them separate avoids the usual friction of feeding a transforming schema to React Hook
Form (where `defaultValues` must then be `Date` objects that no `<input type="date">` can hold),
while preserving the rule that **the server never trusts the client**. Every constraint the form
enforces is enforced again server-side; the form adds no rule the server lacks.

Multi-field invariants are checked on the merged record, not just the submitted patch. For
example, `updateEvent` re-validates `endTime >= startTime` against the stored `startTime`, so a
PATCH that moves only the start time cannot leave an event ending before it begins.
`updateProject` does the same for the start/target window.

`parseOrThrow` ([`lib/services/validate.ts`](../lib/services/validate.ts)) converts a Zod
failure into a `ValidationError` carrying per-field messages, which the HTTP layer renders as a
422 and `applyServerErrors` maps back onto the form fields.

## Error handling

[`lib/errors.ts`](../lib/errors.ts) defines a small hierarchy, each carrying an HTTP status and
a stable code:

| Error | Status | Code |
| --- | --- | --- |
| `ValidationError` | 422 | `VALIDATION_ERROR` (plus `fieldErrors`) |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `ForbiddenError` | 403 | `FORBIDDEN` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| anything else | 500 | `INTERNAL_ERROR` |

`failure()` in [`lib/api-response.ts`](../lib/api-response.ts) maps them. An unrecognised error
is logged server-side and reported as a generic 500 — stack traces, Prisma messages and SQL
never reach the client.

On the UI side, route-level `error.tsx` catches render failures and shows Next.js's error
`digest` as a reference the user can quote, while `global-error.tsx` handles the case where even
the root layout fails.

## Derived state

Nothing that can be computed is stored:

| Value | Derived from | Where |
| --- | --- | --- |
| Project progress | its tasks' statuses | `lib/progress.ts` |
| Task completion rate | the user's task statuses | `lib/progress.ts` |
| Habit streaks | `habit_log` rows meeting `targetCount` | `lib/streaks.ts` |
| Level | `SUM(xp_event.points)` | `lib/xp.ts` |
| All analytics series | aggregate queries | `lib/services/analytics.ts` |

The cost is a few extra reads; the benefit is that no counter can drift out of sync with the
rows it summarises, and there is no cache to invalidate. Progress is computed with
`include: { tasks: { select: { status: true } } }`, so the extra data fetched is one enum column
per task.

`completedAt` is the one timestamp that *is* stored, and it is still derived — from the status
transition, in `resolveCompletedAt`, not from the request body. Entering `DONE` stamps it,
leaving `DONE` clears it, and editing an unrelated field while already `DONE` preserves the
original value.

## The XP and achievement engine

Split into a pure half and a persistent half:

```
lib/xp.ts            pure: rules, level maths, award builders (XPAward objects)
lib/achievements.ts  pure: the 17-entry catalogue + evaluateAchievements()
     │
lib/services/xp.ts            awardXP(), getTotalXP(), getLevelProgress()
lib/services/achievements.ts  collectAchievementStats(), syncAchievements()
```

**Idempotency** is the central requirement: *"marking a completed task as done again should not
give XP again."* It is enforced by the database, not by application bookkeeping. Each award
carries a `dedupeKey` identifying the underlying action:

| Action | Key |
| --- | --- |
| Task completed | `TASK_COMPLETED:<taskId>` |
| Project completed | `PROJECT_COMPLETED:<projectId>` |
| Habit check-in | `HABIT_CHECKIN:<habitId>:<yyyy-MM-dd>` |
| Study session | `STUDY_SESSION:<sessionId>` |
| Workout | `WORKOUT_LOGGED:<workoutId>` |
| Journal entry | `JOURNAL_ENTRY:<entryId>` |
| Achievement | `ACHIEVEMENT:<key>` |

`xp_event` has `@@unique([userId, dedupeKey])`, and `awardXP` inserts via `createMany` with
`skipDuplicates: true`. A replayed action therefore inserts nothing and returns `count: 0` —
an ordinary outcome rather than a caught exception, which also keeps a repeated check-in from
filling the logs with constraint errors. This is race-safe: two concurrent requests for the same
action both attempt the insert, and the index guarantees only one lands.

Note that the key is tied to the *row*, not to its contents. Editing a study session's duration
after the fact does not re-award XP, and does not change the original award. The reward is for
the act, not for the record's current value.

**Achievements** are evaluated after every XP-bearing action. `syncAchievements` recomputes the
user's nine metrics, diffs them against the rows already in `user_achievement`, inserts what is
newly earned with `skipDuplicates`, and awards each unlock's bonus XP. Because unlocking is
itself XP-bearing, a user's first completed task yields 10 (task) + 50 (First Blood) = 60 XP.
Recomputing from scratch rather than incrementing is a deliberate trade: it costs a handful of
`COUNT` queries per mutation but makes the achievement state self-healing — importing, deleting
or back-dating rows can never leave a stale badge.

## Date and timezone handling

The schema distinguishes two kinds of time, and the code has to as well:

- **Instants** — `task.dueDate`, `task.completedAt`, `calendar_event.startTime`,
  `study_session.sessionDate`, `workout.workoutDate`, `xp_event.createdAt`. Stored as
  `TIMESTAMP`, compared with `gte`/`lte` against ranges from `lib/dates.ts`.
- **Calendar days** — `habit_log.date` and `journal_entry.entryDate`. Stored as `DATE`, because
  "did I check in on the 9th" is a question about a day, not an instant.

A `DATE` column round-trips through Prisma as a UTC-midnight `Date`. Reading it with local
getters shifts the day for any negative UTC offset (`2026-03-09T00:00:00Z` is the 8th in New
York), which would silently corrupt streaks. So date-only values always go through
`toUtcDayKey()` on the way out and `toUtcDateOnly()` on the way in, and `lib/dates.ts` keeps the
two helper families clearly named.

Day keys are `yyyy-MM-dd` strings. They sort lexicographically, compare with `===`, work as
`Map` keys and as React keys, and make the streak functions pure and trivially testable.

Weeks start on Monday (`WEEK_STARTS_ON = 1`), matching the `UserPreferences.weekStartsOn`
default.

Two values are rendered client-side on purpose — the top-bar date and the dashboard greeting —
because they must reflect the *viewer's* clock, not the server's. Both render a stable
placeholder during SSR to avoid a hydration mismatch.

## UI architecture

**Theming.** Every colour is an HSL triple in a CSS custom property, declared twice in
`app/globals.css` (`:root` and `.dark`). Tailwind reads them through
`hsl(var(--token))`. No component hard-codes a colour, so adding a theme means adding one block
of variables. `next-themes` toggles the `.dark` class with `disableTransitionOnChange`.

**Component layers.**

| Directory | Contents | Client or server |
| --- | --- | --- |
| `components/ui/` | Radix-based primitives: button, card, dialog, select, dropdown, progress, checkbox, tabs, tooltip, toast, avatar, skeleton | mostly client |
| `components/shared/` | `PageHeader`, `StatCard`, `EmptyState`, `ConfirmDialog`, `Field`, `ColorPicker` | server where possible |
| `components/<module>/` | one dialog + one list/card per module | client (they mutate) |
| `components/analytics/` | `ChartFrame` plus trend, bar and donut charts | client (Recharts) |

**The dialog pattern.** Each module has a single `<XDialog>` that handles both create and edit:
pass a record to edit it, omit it to create. It works uncontrolled (rendering its own `trigger`)
or controlled (`open` + `onOpenChange`), via `useDialogState`. That dual mode is what lets the
top-bar quick-add menu open any module's real create form — the same component, the same
validation, the same service call — instead of maintaining a second set of forms.

**Filters navigate, they do not hold state.** Every filter writes to the URL, so a filtered
view is shareable and re-queried on the server. Where the whole control can be server-rendered -
the analytics range switcher, the project status filter, the journal mood chips - it is a set of
plain `<a>` elements rather than buttons driving the router. That is partly principle (the
control works before hydration, and each view is a real URL) and partly hard-won: a
`router.replace` fired synchronously from a button's `onClick` was observed to silently drop
some query-only navigations, leaving the control visibly clicked and the list unchanged. The
task and journal search boxes stay client-side because they debounce, and the task filter
selects stay client-side because they are selects - both are covered by E2E tests that click
twice in a row.

**Empty states** are never decorative. `EmptyState` takes an `action`, and every caller passes
the real create dialog for that module, so an empty list is one click from real data.

**Accessibility.** Focus rings are visible for keyboard users and suppressed for mouse clicks
(`:focus-visible`). Validation messages sit in `aria-live="polite"` regions. Icon-only buttons
carry `aria-label`s naming the record they act on (`Delete "Write the report"`), which is also
what makes the E2E selectors stable. Charts are wrapped in labelled `<section>`s. Wide tables
scroll inside their own container so the page body never scrolls horizontally.
`prefers-reduced-motion` disables animation.

## Performance notes

- **Parallel reads.** Pages issue their queries with `Promise.all`. `getDashboardData` runs 18
  reads concurrently rather than sequentially.
- **Indexes.** Composite indexes match the query shapes: `(userId, status)`, `(userId, dueDate)`
  and `(userId, completedAt)` on `task`; `(userId, date)` on `habit_log`;
  `(userId, sessionDate)` and `(userId, subject)` on `study_session`; `(userId, startTime)` on
  `calendar_event`; `(userId, createdAt)` on `xp_event`.
- **Aggregate in the database.** Counts and sums use `groupBy` and `aggregate` rather than
  fetching rows to count in JavaScript. The exception is streak and 28-day-history computation,
  which needs the individual `habit_log` rows anyway.
- **Zero-fill on the server.** Chart series arrive dense and ascending, so no client code
  reconciles gaps.
- **Prisma singleton.** `lib/db.ts` caches the client on `globalThis` outside production, so dev
  hot-reload does not open a new pool per edit.
- **`optimizePackageImports`** is set for `lucide-react`, `date-fns` and `recharts`, which keeps
  barrel imports from pulling whole libraries into a route's bundle.

The one known hot spot is `syncAchievements`, which runs ~8 aggregate queries after every
XP-bearing mutation. At one user's data volume this is a few milliseconds; a multi-tenant
deployment would want to debounce it or move it to a job queue.

## Conventions

- **Named exports.** Default exports are reserved for Next.js's required files (pages, layouts,
  `error.tsx`, `loading.tsx`).
- **Services take `userId` first.** `createTask(userId, input)`, never `createTask(input)`.
- **`unknown` at the boundary.** Service inputs are typed `unknown` and narrowed by Zod, so a
  caller cannot bypass validation by asserting a type.
- **Comments explain *why*.** Mechanics are left to the code; comments cover the non-obvious
  decision (why `completedAt` is derived, why `DATE` columns use UTC-part helpers, why 404 is
  returned for a foreign id).
- **`strict` TypeScript, no `any`.** `@typescript-eslint/no-explicit-any` is an error, not a
  warning.
- **Tests mirror the source tree.** `lib/xp.ts` → `tests/unit/xp.test.ts`.

## Known limitations

- `syncAchievements` recomputes all metrics per mutation (see
  [Performance notes](#performance-notes)).
- Ownership is a `userId` column, not a membership table, so projects cannot be shared. Adding
  collaborators would mean a `project_member` join table and reworking the service scoping.
- The 13 timezone options on the Settings page are a curated list, not the full IANA database.
  `preferences.timezone` is stored but server-side "today" boundaries still use the server's
  local timezone; honouring the preference fully would mean threading it through `lib/dates.ts`.
- Auth rate limiting is in-memory, so the budget is per server instance. On a single-instance
  deployment that covers the whole application; on Vercel or any horizontally scaled host it
  only slows an attacker proportionally to the instance count. A shared store (Redis through
  Better Auth's secondary storage) is the production-grade upgrade.
- Account deletion and data export are not implemented (the schema cascades correctly, so
  deletion is a small addition).
