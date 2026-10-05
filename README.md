# LifeOS

A personal operating system for a student or developer: tasks, projects, habits, study
sessions, workouts, calendar events and journal entries in one private workspace — with XP,
achievements and analytics computed from your own records.

Built with Next.js 15 (App Router), TypeScript, Prisma and PostgreSQL. Every number the UI
shows is an aggregate query against the signed-in user's rows. There are no placeholder
values, no stubbed modules, and no AI features anywhere in the project.

```
┌──────────────────────────────────────────────────────────────┐
│  Dashboard · Tasks · Projects · Habits · Study · Fitness     │
│  Calendar · Journal · Analytics · Achievements · Settings    │
└──────────────────────────────────────────────────────────────┘
        │                    │                     │
   Server Components    Route handlers        Client components
   (read via services)  (/api/*, validated)   (forms, charts)
        └────────────────────┴─────────────────────┘
                             │
                   lib/services/*  — ownership + business rules
                             │
                      Prisma  →  PostgreSQL
```

---

## Table of contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Tech stack](#tech-stack)
- [Database model](#database-model)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Development commands](#development-commands)
- [Testing](#testing)
- [Docker](#docker)
- [Deployment](#deployment)
- [Folder structure](#folder-structure)
- [Design notes](#design-notes)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

### Authentication
- Email + password registration and login via [Better Auth](https://better-auth.com), with
  scrypt-hashed credentials stored in the `account` table.
- Database-backed sessions carried by an httpOnly, SameSite cookie. No identity is ever
  persisted in `localStorage`.
- Every protected route is guarded server-side in `app/(dashboard)/layout.tsx`;
  unauthenticated visitors are redirected to `/login` before any page renders.
- Every service function is scoped by `userId`, so a valid id belonging to another account is
  indistinguishable from one that does not exist (verified by tests — see
  [Testing](#testing)).
- The auth endpoints are rate limited: 120 requests per minute overall, and 10 per minute for
  sign-in and sign-up. The budget is per server instance (in-memory), which is noted as a
  limitation in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#known-limitations).

### Tasks
Create, edit, delete. Four statuses (`TODO`, `IN_PROGRESS`, `DONE`, `ARCHIVED`) and four
priorities (`LOW` → `URGENT`). Optional due date and project link. Filter by status, priority,
project or free-text search; sort by due date, priority, creation date or title. All filters
live in the URL, so a filtered list is shareable and re-queried on the server.
`completedAt` is derived from the status transition rather than trusted from the client.

### Projects
Create, edit, pause, archive, complete, delete. Progress is **derived from the project's
tasks** on every read rather than stored, so it can never drift out of sync. Archived tasks
are excluded from the percentage. Completing a project closes its open tasks (and awards their
task XP) in one transaction. Deleting a project keeps its tasks and unlinks them.

### Habits
Daily or weekly habits with a configurable `targetCount`. One check-in per habit per day is
enforced by a unique `(habitId, date)` database constraint. Streaks are recomputed from the log
history: a streak stays alive while it ends today *or* yesterday, and partial check-ins below
the target do not extend it. Each card shows the current streak, the all-time best, a 28-day
completion rate and a mini heatmap.

### Study
Log sessions with subject, topic, duration and notes. Totals for today, this week, this month
and all time; minutes-per-day chart and an all-time subject breakdown. Previously used subjects
are offered as an autocomplete list.

### Fitness
Workouts with repeatable exercise rows (sets, reps, weight, notes). Weekly count and minutes,
average session length, total volume (`sets × reps`), a workouts-per-week chart and a
per-exercise history table with the heaviest weight used. Editing a workout replaces its
exercise list inside a transaction.

### Calendar
A real 6×7 month grid with per-day event chips and a click-to-create affordance on each cell,
plus a rolling 30-day agenda grouped by day. Six event types, each mapped to a chart colour
token so calendar and analytics colours agree. `endTime` is validated against `startTime` on
both the client and the server, including partial updates.

### Journal
Dated entries with an optional title and mood. Full-text search across title and content, mood
filtering, and a journaling streak. Entries are stored on a `DATE` column, so multiple entries
per day are allowed while streaks still collapse to distinct calendar days.

### XP, levels and achievements
| Action | XP |
| --- | --- |
| Complete a task | +10 |
| Complete an **urgent** task | +20 |
| Complete a project | +100 |
| Habit check-in (at target) | +15 |
| Study session | +1 per full 10 min, minimum +5 |
| Log a workout | +25 |
| Journal entry | +10 |
| Unlock an achievement | +50 |

`level = floor(totalXP / 100) + 1`.

Every award carries a **dedupe key** (`TASK_COMPLETED:<taskId>`,
`HABIT_CHECKIN:<habitId>:<date>`, …) with a unique `(userId, dedupeKey)` index. Un-completing
and re-completing a task, or re-submitting the same day's check-in, inserts nothing and awards
nothing. 17 achievements across seven categories unlock automatically when the relevant metric
crosses its threshold; unlocked state is persisted in `user_achievement` while the definitions
live in code.

### Analytics
Tasks completed over time, cumulative XP growth, study minutes per day, study by subject, habit
completion rate, workout frequency, XP by source, project status and events by type — over a
7-, 30- or 90-day window. Series are zero-filled server-side so the charts need no gap handling.

### UI
Light and dark themes (plus "system") driven entirely by CSS custom properties — no component
hard-codes a colour. Sidebar navigation that collapses to a drawer on mobile, a top bar with
the current date and a quick-add menu that can create a record of any type from any page,
keyboard-visible focus rings, `aria-live` validation messages, honest empty states with a
create action, and route-level loading and error boundaries.

---

## Screenshots

Screenshots are not committed to the repository. To capture your own:

```bash
npm run db:seed          # creates the demo account with ~60 days of data
npm run dev              # then sign in as demo@lifeos.app / demo-password-123
```

Then capture `/dashboard`, `/tasks`, `/projects`, `/habits`, `/analytics` and `/calendar` in
both light and dark mode, and save them to `docs/screenshots/`.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, React 19, Server Components) |
| Language | TypeScript 5.9 in `strict` mode |
| Styling | Tailwind CSS 3 with HSL design tokens |
| Components | shadcn/ui-style primitives on Radix UI, `lucide-react` icons |
| Database | PostgreSQL 17 |
| ORM | Prisma 6 (migrations + typed client) |
| Auth | Better Auth 1.7 (email + password, DB sessions) |
| Forms | React Hook Form + Zod resolvers |
| Validation | Zod — separate client form schemas and server transform schemas |
| Charts | Recharts 3 |
| Unit tests | Vitest |
| Integration tests | Vitest against a real PostgreSQL database |
| E2E tests | Playwright against a production build |
| Tooling | ESLint 9 (flat config) + Prettier |
| Containers | Docker multi-stage build + Docker Compose |

---

## Database model

Eleven domain tables plus four auth tables. Every domain table carries a `userId` foreign key
with `ON DELETE CASCADE`, so ownership can be enforced with a single scoped `where` clause and
deleting an account removes everything it owns.

```
user ──┬── session                      (Better Auth)
       ├── account                       (hashed credentials)
       ├── user_preferences  1:1         (timezone, goals)
       ├── project ──── task             (task.projectId is nullable, ON DELETE SET NULL)
       ├── task
       ├── habit ────── habit_log        (UNIQUE habitId + date)
       ├── habit_log
       ├── study_session
       ├── workout ──── workout_exercise
       ├── calendar_event
       ├── journal_entry
       ├── xp_event                      (UNIQUE userId + dedupeKey)
       └── user_achievement              (UNIQUE userId + achievementKey)
```

Full column-by-column reference, enums, indexes and the invariants each constraint protects:
**[docs/DATABASE.md](docs/DATABASE.md)**.

---

## Quick start

### Option A — Docker (nothing but Docker required)

```bash
git clone <your-fork-url> lifeos && cd lifeos
cp .env.example .env
```

Set a real secret in `.env` (`docker compose` refuses to start without one):

```bash
printf 'BETTER_AUTH_SECRET="%s"\n' "$(openssl rand -base64 32)" >> .env
```

Then:

```bash
docker compose up -d --build
```

The app is on <http://localhost:3000>. Migrations run automatically on container start.
To load the demo account:

```bash
docker compose exec app npx prisma db seed
```

### Option B — local Node + PostgreSQL

```bash
git clone <your-fork-url> lifeos && cd lifeos
npm install
cp .env.example .env
```

Point `DATABASE_URL` and `TEST_DATABASE_URL` at your PostgreSQL server, set
`BETTER_AUTH_SECRET`, then:

```bash
createdb lifeos           # or: docker compose up -d db
createdb lifeos_test      # scratch database for integration + E2E tests
npx prisma migrate dev    # create the schema
npx prisma db seed        # optional: demo data
npm run dev
```

Open <http://localhost:3000>. The seeded demo account is
**demo@lifeos.app** / **demo-password-123** (override with `SEED_DEMO_EMAIL` and
`SEED_DEMO_PASSWORD`).

---

## Environment variables

Every variable is documented in [`.env.example`](.env.example). `.env` is gitignored; no
secrets are committed.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string used by the app and by migrations. |
| `BETTER_AUTH_SECRET` | yes | Signs session cookies and auth tokens. Minimum 16 characters; generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | yes in production | Canonical origin, used for cookie and redirect handling. Defaults to `http://localhost:3000`. **Must be the `https://` origin in production** — the `Secure` cookie flag is derived from this scheme. |
| `NEXT_PUBLIC_APP_URL` | yes in production | Origin exposed to the browser. Same value as `BETTER_AUTH_URL`. |
| `TEST_DATABASE_URL` | tests only | Scratch database for the integration and E2E suites. **Must differ from `DATABASE_URL`** — the setup refuses to run otherwise. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | compose only | Credentials for the bundled PostgreSQL container. |
| `SEED_DEMO_EMAIL` / `SEED_DEMO_PASSWORD` | optional | Override the seeded demo account. |
| `E2E_PORT` / `E2E_BASE_URL` | optional | Override the port the E2E server binds to (default `3100`). |
| `AUTH_RATE_LIMIT_DISABLED` | **tests only** | Set to `true` only by `playwright.config.ts`. The E2E suite registers an account per test, which legitimately exceeds the credential budget. Never set this in a deployment. |

`lib/env.ts` parses the server-side variables with Zod at first use and throws a message naming
the missing or malformed ones, rather than failing later with an opaque connection error.

---

## Development commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on port 3000. |
| `npm run build` | Generate the Prisma client and produce a production build. |
| `npm start` | Serve the production build. |
| `npm run lint` | ESLint over the whole project; warnings fail the run. |
| `npm run lint:fix` | ESLint with autofix. |
| `npm run format` | Prettier write. |
| `npm run format:check` | Prettier check (run by CI). |
| `npm run typecheck` | `tsc --noEmit` over the app, then over the E2E suite (`tsconfig.e2e.json`). |

### Database commands

| Command | What it does |
| --- | --- |
| `npm run db:migrate` | Create and apply a migration from schema changes (development). |
| `npm run db:migrate:deploy` | Apply pending migrations without generating new ones (production). |
| `npm run db:generate` | Regenerate the Prisma client. |
| `npm run db:push` | Push the schema without a migration file (prototyping only). |
| `npm run db:seed` | Load the demo dataset. |
| `npm run db:reset` | Drop, re-migrate and re-seed. **Destroys all data.** |
| `npm run db:studio` | Open Prisma Studio. |

---

## Testing

Three layers, each testing what it is actually good at. Full detail, including how to add tests
and how to debug a failure: **[docs/TESTING.md](docs/TESTING.md)**.

| Command | Layer | Needs a database |
| --- | --- | --- |
| `npm test` | Unit — pure domain logic | no |
| `npm run test:watch` | Unit, in watch mode | no |
| `npm run test:coverage` | Unit with a V8 coverage report and enforced thresholds | no |
| `npm run test:integration` | Services against real PostgreSQL | yes (`TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright against a production build | yes (`TEST_DATABASE_URL`) |
| `npm run test:all` | Unit + integration | yes |

**Unit** (`tests/unit/`) — 185 tests covering XP and level maths, streak calculation, project
progress, every Zod schema (server *and* client form), date and timezone helpers, chart series
filling, and the formatting utilities. Coverage of the pure domain modules sits at 99.7% of
lines, enforced by thresholds in `vitest.config.ts`.

**Integration** (`tests/integration/`) — 26 tests running the real service layer against a real
database, covering what only a database can enforce: cross-user isolation on every module, XP idempotency via
the unique dedupe index, one habit log per day, derived `completedAt` timestamps, project
progress derivation, and `ON DELETE SET NULL` on task→project.

**E2E** (`tests/e2e/`) — 38 tests driving a production build in Chromium: registration, login, logout,
duplicate-email and wrong-password handling, the full create/complete/edit/delete cycle for
tasks, projects with derived progress, habit check-ins and streaks, study sessions, workouts
with exercises, journal entries with search and mood filters, calendar events, analytics range
switching, achievement unlocking, preference persistence, the mobile layout, and cross-user
isolation through both the UI and the HTTP API.

The E2E suite builds the app before running (`npm run build && next start`), so the first run
takes a few minutes. Install the browser once with:

```bash
npx playwright install chromium
```

Before opening a pull request:

```bash
npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build
```

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs all of the above plus the E2E suite
against a PostgreSQL 17 service container on every push, and builds the Docker image in a
parallel job.

---

## Docker

```bash
docker compose up -d --build       # build and start app + database
docker compose logs -f app         # follow application logs
docker compose exec app npx prisma db seed
docker compose exec db psql -U lifeos -d lifeos
docker compose down                # stop, keep the data volume
docker compose down -v             # stop and delete the data volume
```

The image is a three-stage build (`deps` → `build` → `runner`) producing a Next.js
`standalone` server. The runtime stage runs as a non-root user, carries only the Prisma CLI
and migrations needed by its entrypoint, and declares a `HEALTHCHECK` against `/api/health`.
`docker/entrypoint.sh` runs `prisma migrate deploy` before `exec`-ing the server, so the
process stays PID 1 and receives signals directly.

To build the image on its own:

```bash
docker build -t lifeos:latest .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/lifeos?schema=public" \
  -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  -e BETTER_AUTH_URL="http://localhost:3000" \
  -e NEXT_PUBLIC_APP_URL="http://localhost:3000" \
  lifeos:latest
```

---

## Deployment

### Vercel + managed PostgreSQL (Neon, Supabase or Railway)

1. **Provision the database.** Create a PostgreSQL instance and copy its pooled connection
   string. On Neon, append `?sslmode=require`.
2. **Import the repository** into Vercel. The framework preset is detected automatically; the
   build command is `npm run build`, which runs `prisma generate` first.
3. **Set the environment variables** for Production (and Preview, pointing at a separate
   database):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | the managed connection string |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` — a *different* value from development |
   | `BETTER_AUTH_URL` | `https://your-app.vercel.app` |
   | `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |

4. **Apply the migrations.** Vercel's build step does not touch the database, so run them
   explicitly once per deploy:

   ```bash
   DATABASE_URL="<production-url>" npx prisma migrate deploy
   ```

   Or add it to the build: `"build": "prisma generate && prisma migrate deploy && next build"`.
   Keep it out of the build if you prefer migrations gated behind a manual step.

5. **Verify.** `curl https://your-app.vercel.app/api/health` should return
   `{"status":"ok","database":"up"}`. Then register an account and confirm the dashboard loads.

Notes:
- Serverless functions open a connection per instance. Use your provider's **pooled**
  connection string (`-pooler` on Neon, port 6543 on Supabase) to avoid exhausting connections.
- `BETTER_AUTH_URL` must match the deployment origin exactly, or session cookies will be
  rejected on redirect. It must use `https://`: the `Secure` cookie flag is derived from the
  scheme, so an `http://` value leaves session cookies unprotected in transit.
- Do not seed a production database. The seed script deletes and recreates the demo user.

### Any Docker host (Fly.io, Railway, Render, a VPS)

Build and push the image, set the same four environment variables, and expose port 3000. The
entrypoint applies migrations on boot, so a deploy needs no extra step.

---

## Folder structure

```
lifeos/
├── app/
│   ├── (auth)/                  # public auth routes; redirects signed-in users away
│   │   ├── layout.tsx
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/             # protected segment - layout.tsx holds the session guard
│   │   ├── layout.tsx
│   │   ├── loading.tsx          # shared route skeleton
│   │   ├── error.tsx            # route-level error boundary
│   │   ├── dashboard/  tasks/  projects/  projects/[id]/
│   │   ├── habits/  study/  fitness/  calendar/
│   │   └── journal/  analytics/  achievements/  settings/
│   ├── api/
│   │   ├── auth/[...all]/       # Better Auth handler
│   │   ├── tasks/  projects/  habits/  habits/checkin/
│   │   ├── study/  fitness/  calendar/  journal/
│   │   ├── settings/            # user preferences
│   │   └── health/              # liveness + database probe
│   ├── globals.css              # design tokens for light and dark themes
│   ├── icon.svg                 # app icon / favicon
│   ├── layout.tsx               # fonts, metadata, theme + toast + tooltip providers
│   ├── page.tsx                 # landing page
│   ├── not-found.tsx
│   └── global-error.tsx
├── components/
│   ├── layout/                  # app shell, sidebar, quick-add, theme, user menu
│   ├── ui/                      # Radix-based primitives (button, dialog, select, …)
│   ├── shared/                  # page header, stat card, empty state, confirm dialog
│   ├── analytics/               # chart kit and the four chart components
│   ├── auth/  dashboard/  tasks/  projects/  habits/
│   └── study/  fitness/  calendar/  journal/  achievements/  settings/
├── lib/
│   ├── auth.ts                  # Better Auth server instance
│   ├── auth-client.ts           # browser auth client
│   ├── session.ts               # getCurrentUser / requireUser / requireApiUser
│   ├── db.ts                    # PrismaClient singleton
│   ├── env.ts                   # Zod-validated server environment
│   ├── errors.ts                # AppError hierarchy -> HTTP status mapping
│   ├── api-response.ts          # { data } / { error } envelopes for route handlers
│   ├── api-client.ts            # typed fetch wrapper for client components
│   ├── form-errors.ts           # server field errors -> React Hook Form state
│   ├── xp.ts                    # pure XP + level rules and award builders
│   ├── achievements.ts          # achievement catalogue and pure evaluator
│   ├── streaks.ts               # pure streak calculation
│   ├── progress.ts              # pure project progress derivation
│   ├── dates.ts                 # day keys, ranges, month grid, UTC date-only handling
│   ├── utils.ts                 # cn, formatting, grouping
│   ├── validations/             # Zod schemas - server transforms + client form shapes
│   └── services/                # tasks, projects, habits, study, fitness, calendar,
│                                # journal, xp, achievements, analytics, dashboard,
│                                # preferences, validate
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                  # realistic ~60-day demo dataset
├── tests/
│   ├── unit/                    # Vitest - pure logic
│   ├── integration/             # Vitest - services against real PostgreSQL
│   └── e2e/                     # Playwright - production build in Chromium
├── public/
│   └── robots.txt               # keeps the private routes out of indexes
├── docs/                        # ARCHITECTURE, DATABASE, API, TESTING
├── docker/                      # entrypoint and test-database init
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── eslint.config.mjs
├── playwright.config.ts
├── tsconfig.json                # app
├── tsconfig.e2e.json            # E2E suite (excluded from the app program)
├── vitest.config.ts
└── vitest.integration.config.ts
```

---

## Design notes

A few decisions worth knowing before reading the code. The reasoning behind each is in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

- **Derive, don't store.** Project progress, task completion rates, streaks and level are all
  computed from their source rows on read. There is no denormalised counter to drift.
- **Validate twice, trust once.** Client forms use string-shaped Zod schemas for instant
  feedback; route handlers re-validate the same payload with transforming schemas that produce
  typed domain values. The server is the only authority, and a crafted request cannot skip a
  rule the form enforces.
- **Ownership at the service boundary.** No route handler writes a `where` clause. Services take
  the acting `userId` and scope every query by it, which is why "not yours" and "not found" are
  the same response.
- **Idempotent rewards.** A unique `(userId, dedupeKey)` index makes XP awards safe to replay.
  `awardXP` inserts with `skipDuplicates`, so a repeated action is an ordinary `count: 0`, not an
  exception.
- **Dates are explicit about their kind.** Instants (`startTime`, `completedAt`) are
  `TIMESTAMP`; calendar days (`habit_log.date`, `journal_entry.entryDate`) are `DATE` and are
  read back through UTC-part helpers, because local getters shift the day at negative offsets.
- **No business logic in components.** Pages are Server Components that read through services;
  mutations go through route handlers and refresh the server tree.
- **Filters are URLs, not state.** Every filter is reflected in the query string, so a filtered
  view is shareable and re-queried server-side. Where the whole control can be server-rendered it
  is plain anchors, which keeps it working before hydration.

---

## Roadmap

Things deliberately left out of this version, roughly in the order they would be worth adding:

- Recurring tasks and recurring calendar events (an `RRULE`-style rule on the row).
- Subtasks / checklists on a task.
- Habit reminders and a weekly email digest.
- CSV and JSON export of a user's full dataset, plus account deletion from Settings.
- Drag-and-drop reordering, and a kanban view for tasks grouped by status.
- Week and day calendar views alongside the existing month grid and agenda.
- OAuth providers (GitHub, Google) through Better Auth's social plugins.
- A shared (Redis-backed) store for auth rate limiting, so the budget is global rather than per instance.
- Shared projects with per-user roles, which would mean moving ownership from `userId` to a
  membership table.

## License

MIT — see [LICENSE](LICENSE).
