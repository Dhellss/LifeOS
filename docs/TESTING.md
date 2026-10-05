# Testing

LifeOS has three test layers, each covering what it is genuinely good at. Nothing is skipped,
and no module is left untested.

## Contents

- [The three layers](#the-three-layers)
- [Commands](#commands)
- [Prerequisites](#prerequisites)
- [Unit tests](#unit-tests)
- [Integration tests](#integration-tests)
- [End-to-end tests](#end-to-end-tests)
- [Coverage](#coverage)
- [Debugging a failure](#debugging-a-failure)
- [Writing a new test](#writing-a-new-test)
- [What is deliberately not tested](#what-is-deliberately-not-tested)
- [Continuous integration](#continuous-integration)

---

## The three layers

| Layer | Runner | Scope | Tests | Needs a database | Typical runtime |
| --- | --- | --- | --- | --- | --- |
| **Unit** | Vitest | pure functions in `lib/` | 138 | no | ~2 s |
| **Integration** | Vitest | `lib/services/` against real PostgreSQL | 26 | yes | ~3 s |
| **E2E** | Playwright | the whole app in Chromium | 38 | yes | ~2–3 min (incl. build) |

The split follows one rule: **test a guarantee at the level that actually provides it.**

Streak arithmetic is pure, so it is unit-tested exhaustively with no database in sight. "One
check-in per habit per day" is enforced by a unique index, so it is tested against a real
Postgres. "Bob cannot read Alice's task" is ultimately an HTTP-surface property, so it is tested
through a running server.

## Commands

```bash
npm test                   # unit - fast, no dependencies
npm run test:watch         # unit in watch mode while developing
npm run test:coverage      # unit with a coverage report + 85% thresholds
npm run test:integration   # services against TEST_DATABASE_URL
npm run test:e2e           # Playwright against a production build
npm run test:e2e:ui        # Playwright's interactive UI mode
npm run test:all           # unit + integration
```

Full pre-merge gate:

```bash
npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build
```

## Prerequisites

**Unit tests** need nothing but `npm install`.

**Integration and E2E tests** need a PostgreSQL database set as `TEST_DATABASE_URL`, with the
migrations applied:

```bash
createdb lifeos_test                                      # or use docker compose
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
```

`TEST_DATABASE_URL` **must differ from `DATABASE_URL`**. The setup file refuses to run
otherwise, because the suites create and delete rows freely:

```
Error: TEST_DATABASE_URL must not be the same database as DATABASE_URL.
```

With Docker Compose, `docker/init-test-db.sql` creates `lifeos_test` the first time the volume
is initialised, so the default `.env.example` values work out of the box.

**E2E tests** additionally need the Chromium build Playwright drives:

```bash
npx playwright install chromium
```

---

## Unit tests

`tests/unit/` — 138 tests across 8 files, covering the pure domain logic.

| File | Covers |
| --- | --- |
| `xp.test.ts` | level ↔ XP boundaries, the inverse property of `xpForLevel`/`levelFromXP`, duration-scaled study XP and its minimum, the urgent-task bonus, and every award builder's dedupe key |
| `streaks.test.ts` | current vs. longest streaks, the yesterday grace rule, breaking on a missed day, month and leap-day boundaries, order- and duplicate-insensitivity, and target-aware qualification |
| `progress.test.ts` | per-status counts, exclusion of archived tasks from the denominator, rounding, and the empty and all-archived edge cases |
| `achievements.test.ts` | catalogue integrity (unique keys, positive thresholds), unlocking every crossed tier at once, skipping already-unlocked entries, off-by-one at the threshold, and progress capping |
| `validations.test.ts` | 41 assertions over every Zod schema: trimming, enum rejection, date coercion, length caps, cross-field rules (`targetDate >= startDate`, `endTime >= startTime`, password confirmation), and empty-patch rejection |
| `dates.test.ts` | day-key round-tripping, UTC-part reading of `DATE` columns, Monday-first weeks, trailing-range inclusivity, and the 42-cell month grid's gaps and DST tolerance |
| `utils.test.ts` | `cn` conflict resolution, duration and percentage formatting, initials, truncation, deterministic colour picking, grouping and summing |
| `analytics.test.ts` | zero-filling, same-day accumulation, out-of-range exclusion, ascending order, and cumulative monotonicity |

Characteristics worth preserving when adding to this layer:

- **No mocks.** These functions have no dependencies to mock. If a new function needs a mock,
  it probably belongs in a service and should be integration-tested instead.
- **Boundaries, not happy paths.** `levelFromXP` is checked at 99/100/199/200, not at 150.
  `studySessionXP` is checked at 49, 50 and 51 to pin the exact point where the minimum stops
  applying.
- **Invalid input is a test case.** `NaN`, `Infinity`, negatives, empty strings and empty
  collections all have assertions.
- **Properties where they apply.** `xpForLevel` and `levelFromXP` are asserted to be inverses
  across 20 levels rather than at one hand-picked value.

### Example: the yesterday grace rule

```ts
it('keeps the streak alive when the last check-in was yesterday', () => {
  const result = calculateStreak(['2026-03-07', '2026-03-08', '2026-03-09'], '2026-03-10');
  expect(result.current).toBe(3);
  expect(result.completedToday).toBe(false);
});

it('breaks the streak once a full day has been missed', () => {
  const result = calculateStreak(['2026-03-06', '2026-03-07', '2026-03-08'], '2026-03-10');
  expect(result.current).toBe(0);
  expect(result.longest).toBe(3);
});
```

---

## Integration tests

`tests/integration/` — 26 tests against a real PostgreSQL database, exercising the real service
layer with no mocking of Prisma.

### `ownership.test.ts` (9 tests)

Creates two users and, for **every** module, asserts that a valid id belonging to one is
invisible to the other across read, update and delete:

```ts
it("hides another user's task from read, update and delete", async () => {
  const task = await createTask(alice, { title: "Alice's secret task" });

  await expect(getTask(bob, task.id)).rejects.toThrow(NotFoundError);
  await expect(updateTask(bob, task.id, { title: 'Hijacked' })).rejects.toThrow(NotFoundError);
  await expect(deleteTask(bob, task.id)).rejects.toThrow(NotFoundError);

  const stillThere = await getTask(alice, task.id);   // and nothing was changed
  expect(stillThere.title).toBe("Alice's secret task");
});
```

It also covers cross-reference leaks — attaching a task to another user's `projectId` — and
search leaks, confirming that a journal search by one user never returns another's content.

### `xp-and-rules.test.ts` (17 tests)

The rules that need a database to be meaningful:

- **XP idempotency.** Toggling a task done → not-done → done four times leaves exactly one
  `TASK_COMPLETED` row.
- **Habit uniqueness.** Three check-ins on the same day leave one `habit_log` row, holding the
  latest count.
- **Target-gated rewards.** A partial check-in awards 0; reaching the target awards 15; and
  removing the check-in does not claw XP back.
- **Derived `completedAt`.** Set on entering `DONE`, preserved when editing another field while
  already `DONE`, cleared on reopening.
- **Edits do not re-reward.** Changing a study session from 90 to 600 minutes leaves the award
  at 9 XP.
- **Project completion.** Closes open tasks, awards their task XP *and* the project's 100, and
  awards nothing on a second call.
- **Derived progress.** 1 done of 3 countable with 1 archived reports exactly 33%.
- **`ON DELETE SET NULL`.** Deleting a project leaves its task in place with `projectId: null`.
- **Achievements.** The first completed task unlocks `FIRST_TASK_COMPLETED`, yields
  10 + 50 XP, and never unlocks or re-awards a second time.

Per-rule assertions filter XP by `type` rather than reading the grand total, because unlocking
an achievement is itself XP-bearing — a detail worth knowing before adding tests here:

```ts
async function xpFromType(userId: string, type: XPEventType) {
  const result = await prisma.xPEvent.aggregate({ where: { userId, type }, _sum: { points: true } });
  return result._sum.points ?? 0;
}
```

Isolation strategy: every test (or file) creates its own user with a random email and deletes it
afterwards. Cascades clean up every owned row, so the suite is safe to run repeatedly against a
database that already holds data, and `fileParallelism: false` keeps the assertions
deterministic.

---

## End-to-end tests

`tests/e2e/` — 38 tests across 5 specs, driving a **production build** in Chromium, so the suite
tests what actually gets deployed.

```
playwright.config.ts
  webServer: npm run build && next start --port 3100
  url:       http://127.0.0.1:3100/api/health    ← readiness probe
  env:       DATABASE_URL = TEST_DATABASE_URL
```

| Spec | Covers |
| --- | --- |
| `auth.spec.ts` | the landing page for anonymous visitors; redirects from five protected routes; registration; mismatched-confirmation and duplicate-email rejection; wrong-password handling with a non-enumerating message; sign out → session gone → sign back in; signed-in users bounced off `/login`, `/register` and `/` |
| `tasks.spec.ts` | honest empty state on a fresh account; create → complete → persist across reload → delete; title validation; edit with a priority change; URL-driven status filtering that survives a hard navigation; a project with two tasks reporting exactly 50% after one completion; completing a project closing its open task |
| `tracking.spec.ts` | habit creation, check-in and the resulting 1-day streak; a multi-count habit showing `1/3 today`; study session logging with `1h 30m` formatting; duration validation; study edit and delete; a workout with two exercises rendering in both the detail table and the exercise history; journal creation, content search, no-match state and mood filtering; empty-content validation; calendar event creation appearing in the agenda; end-before-start rejection |
| `dashboard.spec.ts` | a fresh account at Level 1 / 0 XP with real empty states; doing actual work moving the dashboard numbers and the sidebar level; analytics chart regions and range switching via the URL; achievements reflecting the work done; settings showing live row counts and persisting a preference that then changes the dashboard's goal copy; the mobile layout, including drawer navigation and no horizontal overflow at 390 px |
| `isolation.spec.ts` | Alice's records absent from Bob's lists; a direct URL to Alice's project detail page 404-ing; the API returning 404 for a foreign id on `GET`, `PATCH` and `DELETE`; Alice's data provably untouched afterwards; 401 on eight endpoints without a session; a 422 carrying `fieldErrors`; the health endpoint |

### Conventions

**A fresh account per spec - and per test where tests must not depend on each other.**
`newAccount('tasks')` generates a UUID-suffixed email, so specs never contend and the suite can
run against a populated database. `auth.spec.ts` goes further and registers an account inside
each test: sharing one would mean that a failure in the test which creates it leaves every later
test signing in as a user that was never created, burying the real cause under a cascade of
"User not found". Specs whose tests genuinely build on one another (`isolation.spec.ts`) declare
`test.describe.configure({ mode: 'serial' })`, so a failure skips the rest instead of producing
a second wave of misleading errors.

**Accessible selectors only.** Tests locate elements by role, label and accessible name:

```ts
await page.getByRole('checkbox', { name: 'Mark "Write the report" as done' }).click();
```

No CSS-class or `nth-child` selectors. This keeps the suite stable under restyling, and it means
a selector that breaks usually indicates a genuine accessibility regression. Building the suite
surfaced three real ones: a required-field marker rendered *inside* its `<label>`, which made
every control's accessible name `"Password *"`; a toast viewport whose `aria-live` turned it into
a second `alert` region competing with the login form's own; and chart panels whose `aria-label`
made a page-wide `getByLabel('Subject')` ambiguous with the study form's input.

**Scope to the dialog.** `fixtures.ts` provides `dialog(page)`, `dialogField(page, label)` and
`chooseOption(page, label, option, scope?)`. Dialog interactions go through them because
`getByLabel` matches substrings by default and the page behind the dialog has labels of its own -
an unscoped `getByLabel('Priority')` also matches the task filter bar's "Filter by priority", and
several pages label their header action the same as the dialog's submit button. `formAlert(page)`
scopes the form's error banner, because Next.js renders its own `role="alert"` route announcer in
the body.

**Persistence is verified, not assumed.** After a mutation the test reloads the page and
re-asserts, so a passing test proves the change reached PostgreSQL rather than only the local
component state.

```ts
await page.getByRole('checkbox', { name: 'Mark "…" as done' }).click();
await expectToast(page, 'Task completed');
await page.reload();                                        // ← round-trips the server
await expect(page.getByRole('checkbox', { name: 'Mark "…" as not done' })).toBeChecked();
```

**Derived values are asserted precisely.** "One of two tasks complete" asserts `1 of 2 done`
and `50%`, not merely that *some* progress is shown.

---

## Coverage

```bash
npm run test:coverage
```

Writes `coverage/index.html` (plus `lcov.info` for CI tooling). The configuration measures the
pure domain modules — `lib/achievements.ts`, `lib/dates.ts`, `lib/progress.ts`, `lib/series.ts`,
`lib/streaks.ts`, `lib/utils.ts`, `lib/validations/**` and `lib/xp.ts` — and currently reports
**99.7% of statements and lines, 97% of branches and 93% of functions**. The thresholds are set
just below those numbers (95 / 92 / 90 / 95), so a real regression trips the gate instead of
being averaged away.

Services, route handlers and React components are deliberately **outside** the coverage scope:
they do I/O or render, they are covered by the integration and E2E suites, and including them
would reward shallow mock-heavy unit tests that assert nothing real. This is also why the pure
series helpers live in `lib/series.ts` rather than inside `lib/services/analytics.ts` — the
reshaping logic is testable without a database, while the aggregate queries around it are not.

---

## Debugging a failure

### Unit

```bash
npx vitest run tests/unit/streaks.test.ts            # one file
npx vitest run -t 'breaks the streak'                # one test by name
npx vitest                                           # watch mode
```

### Integration

A connection error almost always means the migrations have not been applied to the test
database:

```bash
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
```

To inspect what a test left behind, comment out its cleanup and open the database:

```bash
psql "$TEST_DATABASE_URL" -c 'SELECT "dedupeKey", points FROM xp_event ORDER BY "createdAt";'
```

### E2E

```bash
npm run test:e2e:ui                                  # interactive, time-travel debugging
npx playwright test tests/e2e/tasks.spec.ts          # one spec
npx playwright test --headed --debug                 # watch a real browser, step through
npx playwright show-report                           # open the HTML report after a run
```

Failures retain a trace and a screenshot in `test-results/`. Open a trace with:

```bash
npx playwright show-trace test-results/<path>/trace.zip
```

The trace includes a DOM snapshot per step, the network log and the console, which is usually
enough to tell a selector problem from an application bug without re-running anything.

Common causes:

| Symptom | Likely cause |
| --- | --- |
| Timeout waiting for the server | the build failed — scroll up for the `next build` output |
| `TEST_DATABASE_URL is required` | `.env` is missing, or the variable is unset |
| Every spec fails at registration | migrations not applied to the test database |
| One selector fails after a UI change | an `aria-label` or visible string moved — update both the UI and the test deliberately |

---

## Writing a new test

1. **Choose the layer.** Pure function → unit. Depends on a constraint, a cascade or a
   transaction → integration. Depends on the browser, the session cookie or rendered output →
   E2E.
2. **Mirror the source path.** `lib/streaks.ts` → `tests/unit/streaks.test.ts`.
3. **Name the behaviour, not the function.** `'breaks the streak once a full day has been
   missed'`, not `'calculateStreak works'`. The name should survive a refactor.
4. **One behaviour per test.** Several assertions are fine when they describe one behaviour.
5. **Create your own data.** Integration tests make their own user via `createTestUser` and
   clean up in `afterAll`/`afterEach`. E2E specs register their own account. Never depend on
   the seed.
6. **Explain a non-obvious assertion.** A comment saying *why* 50% is the expected number is
   worth more than the assertion alone.

---

## What is deliberately not tested

Being explicit about the gaps, rather than implying blanket coverage:

- **Better Auth's internals.** Password hashing, cookie signing and session rotation are the
  library's responsibility. What *is* tested is the behaviour the app depends on: registration
  works, wrong passwords are rejected, sessions gate protected routes, and sign-out invalidates.
- **Recharts' rendering.** The E2E suite asserts that each chart's labelled region is present
  and that range switching re-queries; it does not assert SVG path geometry, which would break
  on any library update without indicating a real regression.
- **Browsers other than Chromium.** The Playwright config has a single project. Adding WebKit
  and Firefox is a two-line change if cross-browser coverage becomes a requirement.
- **Visual regression.** No screenshot diffing. The layout is asserted behaviourally instead
  (drawer navigation works, no horizontal overflow at 390 px).
- **Load and concurrency beyond XP dedupe.** The dedupe index is tested for repeat-award safety
  but not under genuine parallel load.
- **Auth rate limiting.** The E2E suite runs with `AUTH_RATE_LIMIT_DISABLED=true`, because it
  registers an account per test and would otherwise trip the 10-per-minute credential budget.
  The limiter itself is therefore not covered by an automated test; it is exercised by hand with
  a loop of failed sign-ins against a dev server.

---

## Continuous integration

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs the whole gate on every push and
pull request:

1. `npm ci` and `prisma generate`
2. `npm run lint`, `npm run typecheck`, `npm run format:check`
3. `npm run test:coverage` — unit tests with the 85% thresholds enforced
4. create `lifeos_test`, `prisma migrate deploy`
5. `npm run test:integration`
6. `npx playwright install --with-deps chromium`, then `npm run test:e2e`
7. on failure, upload `playwright-report/` as an artifact

PostgreSQL 17 runs as a service container, so the integration and E2E suites get a real
database. A second job builds the production Docker image with layer caching, which catches
Dockerfile regressions without waiting for a deploy.

The ordering is deliberate: the fast, dependency-free checks run first, so a lint or type error
fails in seconds rather than after a 170 MB browser download.
