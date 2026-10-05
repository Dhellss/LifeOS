# API

LifeOS exposes a JSON API under `/api`. It is consumed by the app's own client components;
server-rendered pages read through the service layer directly rather than calling HTTP.

## Contents

- [Conventions](#conventions)
- [Authentication](#authentication)
- [Error codes](#error-codes)
- [Tasks](#tasks)
- [Projects](#projects)
- [Habits](#habits)
- [Study](#study)
- [Fitness](#fitness)
- [Calendar](#calendar)
- [Journal](#journal)
- [Settings](#settings)
- [Health](#health)
- [Auth endpoints](#auth-endpoints)
- [Trying it out](#trying-it-out)

---

## Conventions

**Envelopes.** Success responses wrap the payload in `data`; failures wrap it in `error`.

```json
{ "data": { "id": "clx…", "title": "Write the report" } }
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted data is invalid.",
    "fieldErrors": { "title": ["Title is required."] }
  }
}
```

**Methods.** `GET` reads, `POST` creates, `PATCH` partially updates, `DELETE` removes.
There is no `PUT`: updates are always partial, so every update schema accepts any subset of
fields and rejects an entirely empty body.

**Status codes.**

| Code | When |
| --- | --- |
| `200` | Successful read or update |
| `201` | Successful create |
| `204` | Successful delete (no body) |
| `401` | No valid session |
| `404` | Record not found **or not owned by the caller** |
| `422` | Validation failed; `fieldErrors` names the offending fields |
| `500` | Unexpected server error (details are logged, never returned) |

**Dates.** Accepted as ISO 8601 (`2026-03-10T09:00:00.000Z`) or `yyyy-MM-dd`. Habit check-ins
require `yyyy-MM-dd` exactly, because a check-in belongs to a calendar day rather than an
instant. Dates are returned as ISO strings.

**Content type.** `POST` and `PATCH` expect `Content-Type: application/json`. An empty body is
treated as `{}`; malformed JSON returns 422.

## Authentication

Every endpoint except `/api/health` and `/api/auth/*` requires a valid session. The session
cookie is httpOnly and SameSite, set by the auth endpoints; there is no bearer-token or API-key
scheme.

Requests without a session receive:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "You must be signed in to do that." } }
```

**Ownership.** Every endpoint resolves the acting user from the session and scopes its query by
that id. A record belonging to another user returns **404, not 403** — identical to a record
that does not exist — so the API cannot be used to probe for other users' record ids. The same
applies to cross-references: linking a task to another user's `projectId` returns 404.

## Error codes

| `code` | Status | Meaning |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Reserved; ownership failures use 404 by design |
| `NOT_FOUND` | 404 | No such record for this user |
| `CONFLICT` | 409 | Uniqueness violation |
| `VALIDATION_ERROR` | 422 | Includes `fieldErrors: Record<string, string[]>` |
| `INTERNAL_ERROR` | 500 | Unexpected failure; message is deliberately generic |

---

## Tasks

### `GET /api/tasks`

Lists the caller's tasks. Archived tasks are excluded unless `status=ARCHIVED` is requested.

| Query parameter | Values | Default |
| --- | --- | --- |
| `status` | `TODO`, `IN_PROGRESS`, `DONE`, `ARCHIVED` | all except `ARCHIVED` |
| `priority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` | any |
| `projectId` | a project id | any |
| `search` | free text, matched against title and description, case-insensitive | — |
| `sort` | `dueDate`, `priority`, `createdAt`, `title` | `dueDate` |
| `direction` | `asc`, `desc` | `asc` |

Sorting by `dueDate` always places undated tasks last. Sorting by `priority` ascending puts
`URGENT` first (most urgent first is the useful reading).

Each task includes its project when linked:

```json
{
  "data": [
    {
      "id": "clx1…",
      "userId": "clu9…",
      "projectId": "clp4…",
      "title": "Implement log replication",
      "description": "Append entries and the commit index.",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "dueDate": "2026-03-13T17:00:00.000Z",
      "completedAt": null,
      "createdAt": "2026-03-01T09:12:00.000Z",
      "updatedAt": "2026-03-08T19:40:00.000Z",
      "project": { "id": "clp4…", "name": "Distributed Systems coursework", "color": "#6366f1" }
    }
  ]
}
```

### `POST /api/tasks` → 201

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | yes | 1–200 chars after trimming |
| `description` | string | no | ≤2000 chars |
| `status` | `TaskStatus` | no | default `TODO` |
| `priority` | `TaskPriority` | no | default `MEDIUM` |
| `dueDate` | date | no | |
| `projectId` | string | no | must be owned by the caller |

Creating a task directly as `DONE` stamps `completedAt` and awards XP.

### `GET /api/tasks/:id` → 200 · 404

### `PATCH /api/tasks/:id` → 200 · 404 · 422

Accepts any subset of the create fields. `projectId: null` unlinks the task.

`completedAt` is **not** accepted — it is derived from the status transition:

| Transition | `completedAt` |
| --- | --- |
| anything → `DONE` | set to now |
| `DONE` → `DONE` (editing another field) | unchanged |
| `DONE` → anything else | cleared |

Entering `DONE` for the first time awards task XP (+20 for `URGENT`, +10 otherwise) and
re-evaluates achievements. Re-entering `DONE` after reopening awards nothing: the award's
dedupe key has already been recorded.

### `DELETE /api/tasks/:id` → 204 · 404

XP already earned from the task is retained; the ledger is append-only.

---

## Projects

### `GET /api/projects`

| Query parameter | Values | Default |
| --- | --- | --- |
| `status` | `ACTIVE`, `PAUSED`, `COMPLETED`, `ARCHIVED` | any |
| `search` | matched against name and description | — |
| `sort` | `createdAt`, `name`, `targetDate` | `createdAt` |
| `direction` | `asc`, `desc` | `desc` |

Every project carries derived progress:

```json
{
  "data": [
    {
      "id": "clp4…",
      "name": "Distributed Systems coursework",
      "status": "ACTIVE",
      "color": "#6366f1",
      "startDate": "2026-01-28T00:00:00.000Z",
      "targetDate": "2026-04-03T00:00:00.000Z",
      "completedAt": null,
      "taskCount": 5,
      "progress": {
        "total": 5, "completed": 1, "inProgress": 1, "todo": 3,
        "archived": 0, "percent": 20
      }
    }
  ]
}
```

`progress` is computed on every read from the project's tasks — `total` excludes archived tasks,
and `percent` is `completed / total` rounded.

### `POST /api/projects` → 201

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | 1–120 chars |
| `description` | string | no | ≤2000 chars |
| `status` | `ProjectStatus` | no | default `ACTIVE` |
| `color` | string | no | `#rrggbb` |
| `startDate`, `targetDate` | date | no | `targetDate >= startDate` |

### `GET /api/projects/:id` → 200 · 404

Returns the project with its progress **and** its full `tasks` array, ordered by status then due
date.

### `PATCH /api/projects/:id` → 200 · 404 · 422

Two modes:

**Field update** — any subset of the create fields. The start/target window is re-validated
against the merged record, so moving only `startDate` cannot invert the window. Setting
`status: "COMPLETED"` stamps `completedAt` and awards project XP, but leaves the project's tasks
alone.

**Complete action** — `{ "action": "complete" }`. In one transaction this closes every `TODO`
and `IN_PROGRESS` task in the project, then awards:

- task XP for each task it closed (closing a task through the project is still completing it),
- project XP (+100),
- any achievements the new totals unlock.

All of it is idempotent; calling it again awards nothing.

### `DELETE /api/projects/:id` → 204 · 404

The project's tasks are **kept** and unlinked (`projectId` becomes `null`).

---

## Habits

### `GET /api/habits`

| Query parameter | Values | Default |
| --- | --- | --- |
| `includeInactive` | `true`, `false` | `false` |

Each habit arrives decorated with derived statistics:

```json
{
  "data": [
    {
      "id": "clh2…",
      "name": "Morning reading",
      "frequency": "DAILY",
      "targetCount": 1,
      "color": "#6366f1",
      "isActive": true,
      "streak": { "current": 6, "longest": 14, "completedToday": true },
      "history": { "2026-02-11": 1, "2026-02-12": 0, "…": 1 },
      "todayCount": 1,
      "completedToday": true,
      "completionRate": 86
    }
  ]
}
```

- `streak.current` counts consecutive qualifying days ending today **or yesterday** — a habit is
  not broken until a full day has been missed.
- `history` covers the trailing 28 days, zero-filled, and drives the mini heatmap.
- `completionRate` is the share of that window that met `targetCount`, ignoring days before the
  habit existed.

### `POST /api/habits` → 201

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | 1–120 chars |
| `description` | string | no | ≤1000 chars |
| `frequency` | `DAILY`, `WEEKLY` | no | default `DAILY` |
| `targetCount` | integer | no | default `1`, range 1–50 |
| `color` | string | no | `#rrggbb` |

### `GET /api/habits/:id` → 200 · 404

### `PATCH /api/habits/:id` → 200 · 404 · 422

Accepts the create fields plus `isActive`. Archiving is `{ "isActive": false }` — the habit and
its history are preserved.

### `DELETE /api/habits/:id` → 204 · 404

Cascades to the habit's logs. XP already earned is retained.

### `POST /api/habits/checkin` → 200 · 404 · 422

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `habitId` | string | yes | must be owned by the caller |
| `date` | string | yes | **exactly** `yyyy-MM-dd` |
| `count` | integer | no | default `1`, range 0–50 |
| `note` | string | no | ≤500 chars |

Upserts against the unique `(habitId, date)` key, so re-submitting the same day revises the
existing row rather than creating a second one. `count: 0` deletes the check-in.

XP (+15) is awarded only when `count >= targetCount`, and only once per habit per day. Removing
and re-adding a check-in does not re-award.

```json
{ "data": { "habit": { "…": "the decorated habit" }, "xpAwarded": 15 } }
```

`xpAwarded` is `0` when the target was not met, or when this day was already rewarded.

---

## Study

### `GET /api/study`

| Query parameter | Notes |
| --- | --- |
| `subject` | exact match, case-insensitive |
| `from`, `to` | ISO dates bounding `sessionDate` |

Returns sessions newest first.

### `POST /api/study` → 201

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `subject` | string | yes | 1–120 chars |
| `topic` | string | no | ≤200 chars |
| `durationMinutes` | integer | yes | 1–1440 |
| `notes` | string | no | ≤2000 chars |
| `sessionDate` | date | yes | |

```json
{ "data": { "session": { "…": "the created row" }, "xpAwarded": 9 } }
```

XP is 1 per full 10 minutes, with a minimum of 5 — so 90 minutes earns 9, and 15 minutes
earns 5.

### `GET /api/study/:id` → 200 · 404
### `PATCH /api/study/:id` → 200 · 404 · 422

Accepts any subset of the create fields. **Editing the duration does not change the XP already
awarded** — the reward was for the act of studying, not for the record's current value.

### `DELETE /api/study/:id` → 204 · 404

---

## Fitness

### `GET /api/fitness`

| Query parameter | Notes |
| --- | --- |
| `from`, `to` | ISO dates bounding `workoutDate` |

Each workout includes its `exercises`, ordered by `position`.

### `POST /api/fitness` → 201

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | 1–120 chars |
| `workoutDate` | date | yes | |
| `durationMinutes` | integer | no | 1–1440 |
| `notes` | string | no | ≤2000 chars |
| `exercises` | array | no | ≤40 entries, default `[]` |

Each exercise:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | 1–120 chars |
| `sets` | integer | no | default `1`, 1–100 |
| `reps` | integer | no | 1–1000 |
| `weight` | number | no | kilograms, 0–1000 |
| `durationSeconds` | integer | no | 1–86400 |
| `notes` | string | no | ≤500 chars |

```json
{ "data": { "workout": { "…": "with exercises" }, "xpAwarded": 25 } }
```

### `GET /api/fitness/:id` → 200 · 404
### `PATCH /api/fitness/:id` → 200 · 404 · 422

Omitting `exercises` leaves the existing list untouched. **Providing `exercises` replaces the
entire list** inside a transaction — there is no per-exercise endpoint, which keeps the
repeatable form rows mapping directly onto the stored rows.

### `DELETE /api/fitness/:id` → 204 · 404

Cascades to the workout's exercises.

---

## Calendar

### `GET /api/calendar`

| Query parameter | Notes |
| --- | --- |
| `from`, `to` | ISO datetimes bounding `startTime` |
| `type` | `TASK`, `STUDY`, `FITNESS`, `PERSONAL`, `PROJECT`, `OTHER` |

Returns events ascending by `startTime`.

### `POST /api/calendar` → 201

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | yes | 1–200 chars |
| `description` | string | no | ≤2000 chars |
| `startTime` | datetime | yes | |
| `endTime` | datetime | no | must be `>= startTime` |
| `type` | `CalendarEventType` | no | default `OTHER` |
| `location` | string | no | ≤200 chars |
| `allDay` | boolean | no | default `false` |

### `GET /api/calendar/:id` → 200 · 404
### `PATCH /api/calendar/:id` → 200 · 404 · 422

The time window is re-validated against the **merged** record, so a patch that moves only
`startTime` past the stored `endTime` is rejected with a field error on `endTime`.

### `DELETE /api/calendar/:id` → 204 · 404

---

## Journal

### `GET /api/journal`

| Query parameter | Notes |
| --- | --- |
| `search` | case-insensitive, matched against title **and** content |
| `mood` | `GREAT`, `GOOD`, `NEUTRAL`, `LOW`, `BAD` |

Returns entries newest first.

### `POST /api/journal` → 201

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | no | ≤200 chars |
| `content` | string | yes | 1–20,000 chars; whitespace-only is rejected |
| `mood` | `Mood` | no | |
| `entryDate` | date | yes | normalised to a calendar day |

```json
{ "data": { "entry": { "…": "the created row" }, "xpAwarded": 10 } }
```

Several entries per day are allowed, and each earns XP. The journaling *streak* still counts
distinct days.

### `GET /api/journal/:id` → 200 · 404
### `PATCH /api/journal/:id` → 200 · 404 · 422
### `DELETE /api/journal/:id` → 204 · 404

---

## Settings

### `GET /api/settings` → 200

Returns the caller's preferences, creating the row with defaults on first access.

```json
{
  "data": {
    "timezone": "Europe/Berlin",
    "weekStartsOn": 1,
    "dailyTaskGoal": 5,
    "weeklyStudyGoal": 720,
    "weeklyWorkoutGoal": 4
  }
}
```

### `PATCH /api/settings` → 200 · 422

| Field | Type | Notes |
| --- | --- | --- |
| `timezone` | string | IANA name |
| `weekStartsOn` | integer | 0 (Sunday) or 1 (Monday) |
| `dailyTaskGoal` | integer | 1–50 |
| `weeklyStudyGoal` | integer | 0–10080 minutes |
| `weeklyWorkoutGoal` | integer | 0–21 |

---

## Health

### `GET /api/health`

The only unauthenticated application endpoint. Used by the Docker `HEALTHCHECK`, by
Playwright's `webServer.url` readiness probe, and for post-deploy smoke tests.

```json
{ "status": "ok", "database": "up" }
```

Returns `503` with `{ "status": "degraded", "database": "down" }` when `SELECT 1` fails.

---

## Auth endpoints

`/api/auth/*` is handled by Better Auth. The endpoints the app uses:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/sign-up/email` | Register with `name`, `email`, `password`; signs in on success |
| `POST /api/auth/sign-in/email` | Sign in with `email`, `password` |
| `POST /api/auth/sign-out` | Invalidate the session row and clear the cookie |
| `GET /api/auth/get-session` | Current session and user, or `null` |

Prefer the typed helpers in [`lib/auth-client.ts`](../lib/auth-client.ts) (`signIn`, `signUp`,
`signOut`) over calling these by hand. Server code should use `getCurrentUser()` /
`requireUser()` from [`lib/session.ts`](../lib/session.ts) rather than fetching
`get-session` over HTTP.

Login failures are reported to the user with a single generic message — "That email and password
combination did not match an account" — so the form cannot be used to enumerate registered
addresses.

---

## Trying it out

The API uses cookie sessions, so `curl` needs a cookie jar.

```bash
BASE=http://localhost:3000

# Register (also signs you in)
curl -s -c cookies.txt -X POST "$BASE/api/auth/sign-up/email" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"ada@example.test","password":"analytical-engine"}'

# Create a task
curl -s -b cookies.txt -X POST "$BASE/api/tasks" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Read the Raft paper","priority":"HIGH","dueDate":"2026-04-01"}'

# List tasks sorted by priority
curl -s -b cookies.txt "$BASE/api/tasks?sort=priority"

# Complete it (replace the id)
curl -s -b cookies.txt -X PATCH "$BASE/api/tasks/<id>" \
  -H 'Content-Type: application/json' -d '{"status":"DONE"}'

# Validation failure: 422 with field errors
curl -s -b cookies.txt -X POST "$BASE/api/tasks" \
  -H 'Content-Type: application/json' -d '{"title":"   "}'

# Unauthenticated: 401
curl -s "$BASE/api/tasks"

# Health check: no auth needed
curl -s "$BASE/api/health"
```
