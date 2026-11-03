# Phase 1 Design — PostgreSQL for the Whole App

## Architecture overview

```
Browser (React PWA)
  │
  │  existing API calls (unchanged shapes)
  │  new: POST /api/assessments
  ▼
Express backend  :4000
  │
  ├── USE_JSON_STORE=true  ──►  JsonStore (existing data.json)
  │
  └── USE_JSON_STORE=false ──►  Repository layer (pg)
                                  │
                                  ▼
                           Azure Database for PostgreSQL
                           Flexible Server — South Africa North
                           Burstable B1ms, SSL required
```

All existing response shapes are preserved. New endpoints are additive.

---

## Database schema

### Tenancy model
Every table reachable from a school has `school_id` (direct or via join). Tenancy is enforced in the API middleware:
- `requireClassroomAccess(classroomId)` — teacher must own the classroom, or HOD must belong to the same school.
- `requireLearnerAccess(learnerId)` — as above, plus parents may only access their own child.
- Postgres RLS is **not** used. Rationale: Express is the sole access point; RLS would require per-user DB connections, which conflicts with connection pooling on a Burstable instance.

### Enums (stored as text with CHECK constraints, not Postgres ENUM type — easier to migrate)

```
subject:           English | Mathematics
tier:              Seed | Sprout | Bloom | Tree
result_level:      not_yet | with_help | on_own
strategy_type:     counters | fingers | pictures | mental | number_line | building_up | other
consent_scope:     analysis | voice | training
note_status:       draft | to_review | sent
lesedi_task:       activity_draft | gap_explanation | class_insight | hod_insight | parent_note
lesedi_status:     draft | approved | rejected
user_role:         teacher | hod | parent
obs_source:        teacher | speech_score | activity
```

### ERD (table list and key relationships)

```
schools
  └─< classrooms
        └─< learners
              ├─< guardian_consents
              ├─< tier_history
              ├─< reading_progress
              ├─< observation_items
              ├─< learner_observations
              ├─< parent_notes
              ├─< activity_sessions
              └─< intervention_log

users (teacher | hod | parent)
  ├── school_id → schools

activity_skill_map
  └── activity_id (text, not FK — references activities.id)

activities
  └── activity_id (PK)

lesedi_outputs
  ├── learner_id → learners (nullable)
  └── classroom_id → classrooms

terms
  └── school_id → schools (implicit via classroom)

audit_log
  └── user_id → users
```

---

## SQL migrations (versioned, in `backend/migrations/`)

### Migration 001 — core tables

```sql
-- schools
CREATE TABLE schools (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  emis_number  TEXT UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- users
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('teacher','hod','parent')),
  school_id  UUID REFERENCES schools(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- classrooms
CREATE TABLE classrooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id),
  name        TEXT NOT NULL,
  grade       TEXT NOT NULL,
  teacher_id  UUID REFERENCES users(id),
  code        TEXT UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- learners
CREATE TABLE learners (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id       UUID NOT NULL REFERENCES classrooms(id),
  first_name         TEXT NOT NULL,
  -- last_name intentionally omitted from query results sent to Lesedi
  last_name          TEXT,
  literacy_tier      TEXT CHECK (literacy_tier IN ('Seed','Sprout','Bloom','Tree')),
  maths_tier         TEXT CHECK (maths_tier IN ('Seed','Sprout','Bloom','Tree')),
  language           TEXT,
  channel            TEXT,
  caps_rating_code   INT CHECK (caps_rating_code BETWEEN 1 AND 7),  -- NULL for Grade R
  sounds_to_practise TEXT[],
  client_updated_at  TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);
CREATE INDEX idx_learners_classroom_grade ON learners(classroom_id);

-- guardian_consents
CREATE TABLE guardian_consents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id  UUID NOT NULL REFERENCES learners(id),
  scope       TEXT NOT NULL CHECK (scope IN ('analysis','voice','training')),
  granted_by  TEXT,                    -- guardian name (display only, not FK)
  granted_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE VIEW current_consent AS
SELECT DISTINCT ON (learner_id, scope)
  learner_id,
  scope,
  (granted_at IS NOT NULL AND revoked_at IS NULL) AS granted
FROM guardian_consents
ORDER BY learner_id, scope, created_at DESC;

-- tier_history
CREATE TABLE tier_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id    UUID NOT NULL REFERENCES learners(id),
  subject       TEXT NOT NULL CHECK (subject IN ('English','Mathematics')),
  tier          TEXT NOT NULL CHECK (tier IN ('Seed','Sprout','Bloom','Tree')),
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by    UUID REFERENCES users(id),
  reason        TEXT,
  client_updated_at TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- weeks_in_tier computed function (not stored column)
CREATE OR REPLACE FUNCTION weeks_in_current_tier(p_learner_id UUID, p_subject TEXT)
RETURNS NUMERIC AS $$
  SELECT EXTRACT(EPOCH FROM (now() - changed_at)) / 604800
  FROM tier_history
  WHERE learner_id = p_learner_id AND subject = p_subject
  ORDER BY changed_at DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;
```

### Migration 002 — reading progress and observations

```sql
-- reading_progress (replaces learners.termProgress)
CREATE TABLE reading_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id        UUID NOT NULL REFERENCES learners(id),
  year              INT NOT NULL,
  term              INT NOT NULL CHECK (term BETWEEN 1 AND 4),
  wpm               INT,
  accuracy          NUMERIC(5,2),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_updated_at TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_reading_progress_learner_term ON reading_progress(learner_id, term, year);

-- observation_items
CREATE TABLE observation_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id        UUID NOT NULL REFERENCES learners(id),
  subject           TEXT NOT NULL CHECK (subject IN ('English','Mathematics')),
  skill             TEXT NOT NULL,
  caps_ref          TEXT,
  item              TEXT NOT NULL,
  result            TEXT CHECK (result IN ('not_yet','with_help','on_own')),
  strategy          TEXT CHECK (strategy IN ('counters','fingers','pictures','mental','number_line','building_up','other')),
  source            TEXT NOT NULL CHECK (source IN ('teacher','speech_score','activity')),
  observed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_updated_at TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_obs_items_learner_term ON observation_items(learner_id, observed_at);

-- learner_observations (free-text notes)
CREATE TABLE learner_observations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id   UUID NOT NULL REFERENCES learners(id),
  text         TEXT NOT NULL,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);
```

### Migration 003 — activities and sessions

```sql
-- activities (the activity library)
CREATE TABLE activities (
  id          TEXT PRIMARY KEY,   -- e.g. 'sound-sorter'
  subject     TEXT NOT NULL CHECK (subject IN ('English','Mathematics')),
  name        TEXT NOT NULL,
  description TEXT,
  caps_ref    TEXT,
  tier        TEXT CHECK (tier IN ('Seed','Sprout','Bloom','Tree')),
  grade_range TEXT,               -- e.g. 'R-1'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- activity_skill_map
CREATE TABLE activity_skill_map (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id TEXT NOT NULL REFERENCES activities(id),
  subject     TEXT NOT NULL CHECK (subject IN ('English','Mathematics')),
  skill       TEXT NOT NULL,
  caps_ref    TEXT,
  item        TEXT NOT NULL,
  strategy    TEXT CHECK (strategy IN ('counters','fingers','pictures','mental','number_line','building_up','other'))
);

-- activity_sessions
-- id is client-generated UUID; upsert is idempotent on id
CREATE TABLE activity_sessions (
  id                UUID PRIMARY KEY,
  learner_id        UUID NOT NULL REFERENCES learners(id),
  activity_id       TEXT NOT NULL REFERENCES activities(id),
  subject           TEXT NOT NULL CHECK (subject IN ('English','Mathematics')),
  term              INT NOT NULL CHECK (term BETWEEN 1 AND 4),
  academic_year     INT NOT NULL,
  score             INT,
  max_score         INT,
  hints_used        INT NOT NULL DEFAULT 0,
  attempts          INT NOT NULL DEFAULT 1,
  step_data         JSONB,          -- validated allowlist per activity_id
  completed_at      TIMESTAMPTZ,    -- from client completedAt
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),   -- set by server
  client_updated_at TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_activity_sessions_learner_term ON activity_sessions(learner_id, term, academic_year);
```

### Migration 004 — notes, terms, lesedi outputs, intervention log, audit log

```sql
-- parent_notes
CREATE TABLE parent_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id        UUID NOT NULL REFERENCES learners(id),
  text              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','to_review','sent')),
  language          TEXT,
  channel           TEXT,
  created_by        UUID REFERENCES users(id),
  approved_by       UUID REFERENCES users(id),
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_updated_at TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT sent_requires_approval CHECK (
    status <> 'sent' OR approved_by IS NOT NULL
  )
);

-- terms
CREATE TABLE terms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID REFERENCES schools(id),
  year         INT NOT NULL,
  term         INT NOT NULL CHECK (term BETWEEN 1 AND 4),
  name         TEXT,
  dates        TEXT,
  hod_reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by  UUID REFERENCES users(id),
  reviewed_at  TIMESTAMPTZ
);

-- lesedi_outputs
CREATE TABLE lesedi_outputs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task             TEXT NOT NULL CHECK (task IN ('activity_draft','gap_explanation','class_insight','hod_insight','parent_note')),
  subject          TEXT CHECK (subject IN ('English','Mathematics')),
  learner_id       UUID REFERENCES learners(id),    -- nullable for class/HOD tasks
  classroom_id     UUID REFERENCES classrooms(id),
  context_snapshot JSONB NOT NULL,   -- validated: no names, no phone numbers
  output           JSONB NOT NULL,
  confidence       TEXT CHECK (confidence IN ('Medium','Low')),
  model            TEXT,
  prompt_version   TEXT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','rejected')),
  approved_by      UUID REFERENCES users(id),
  approved_at      TIMESTAMPTZ,
  teacher_edited   BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- intervention_log
CREATE TABLE intervention_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id        UUID NOT NULL REFERENCES learners(id),
  teacher_id        UUID NOT NULL REFERENCES users(id),
  subject           TEXT NOT NULL CHECK (subject IN ('English','Mathematics')),
  action            TEXT NOT NULL,
  outcome           TEXT,
  logged_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_updated_at TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- audit_log (append-only)
CREATE TABLE audit_log (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES users(id),
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id TEXT,
  at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Migration 005 — seed data

The seed script reads `backend/data.json` and inserts:

| `data.json` key | Target table | Notes |
|---|---|---|
| `classroom` | `schools` + `classrooms` | Create a default school; `classroom.grade` maps to `classrooms.grade` |
| `learners[].name` | `learners.first_name` | Split on first space; store remainder as `last_name` |
| `learners[].group` | `learners.literacy_tier` | `maths_tier` set to same value initially |
| `learners[].groupJourney` + `recentlyMoved` | `tier_history` | One history row per group change; `subject = 'English'` |
| `learners[].termProgress` | `reading_progress` | One row per term entry |
| `learners[].soundsToPractise` | `learners.sounds_to_practise` | `text[]` |
| `learners[].checkInNote` | `learner_observations` | `source = 'teacher'` |
| `learners[].consent` | `guardian_consents` | `scope = 'analysis'`; `granted_at = now()` if true; null if false |
| `notes[]` | `parent_notes` | `status` mapped directly |
| `terms[]` | `terms` | |
| `completedActivities[]` | `activity_sessions` | `score` and `step_data` are null (historical records) |
| `avgWpm`, `yearSummary` | — | **Skipped** — computed from tables |
| Teacher user | `users` | `role = 'teacher'`, known UUID `00000000-0000-0000-0000-000000000001` |
| HOD user | `users` | `role = 'hod'`, known UUID `00000000-0000-0000-0000-000000000002` |

Seed also inserts the 8 activities and their `activity_skill_map` rows (see REQ-06).

---

## Repository layer

`backend/src/store/` replaces direct `data.json` reads/writes.

```
backend/src/store/
  index.js          — exports getStore() — returns JsonStore or PgStore based on USE_JSON_STORE
  JsonStore.js      — wraps existing data.json logic (unchanged)
  PgStore.js        — implements the same interface using pg queries
  pool.js           — single pg Pool, DATABASE_URL from environment, SSL required
  schema.js         — per-activity step_data allowlists and JSON schema validators
```

### Store interface (both implementations must satisfy)

```js
// Classrooms
getClassroom(id)
patchClassroom(id, fields)

// Learners
getLearners(classroomId)
getLearner(id)
patchLearner(id, fields)
deleteLearner(id)

// Consent
getConsent(learnerId, scope)            // returns { granted: boolean }

// Activity sessions
upsertActivitySession(session)          // idempotent on session.id
getActivitySessions(learnerId)

// Observation items
createObservationItems(items[])

// Reading progress
getReadingProgress(learnerId)
upsertReadingProgress(row)

// Notes
getNotes(classroomId)
createNote(note)
patchNote(id, fields)
deleteNote(id)

// Terms
getTerms(schoolId)
patchTerm(id, fields)

// Tier history
addTierHistory(row)
getCurrentTier(learnerId, subject)

// Lesedi outputs
createLesediOutput(output)
patchLesediOutput(id, fields)

// Intervention log
createIntervention(row)

// Assessments (legacy — reading round)
createAssessment(row)
getAssessments(classroomId)
patchAssessment(id, fields)
```

---

## New endpoints

### `POST /api/assessments`

**Request body:**
```jsonc
{
  "id":           "uuid",          // client-generated, idempotent key
  "learnerId":    "uuid",
  "activityId":   "sound-sorter",
  "subject":      "English",
  "term":         4,
  "academicYear": 2026,
  "score":        3,
  "maxScore":     5,
  "hintsUsed":    1,
  "attempts":     2,
  "completedAt":  "2026-11-03T10:00:00Z",
  "stepData":     { /* strict per-activity JSON Schema — see REQ-05;
                         blend-a-word includes blendAttempts here */ }
}
```

**Responses:**
- `201` — new session created, returns `{ ok: true, assessment: {...} }`
- `200` — id already exists, returns `{ ok: true, assessment: {...}, duplicate: true }`; no duplicate observation or audit rows are written
- `403` — analysis consent missing, false, or revoked in `current_consent`: `{ ok: false, reason: "consent_required", learnerId: "..." }`
- `400` — validation error: `{ ok: false, reason: "validation_failed", details: [...] }`

The server checks consent from `current_consent` before accepting a new record; it never trusts a consent value supplied in the request. The session, mapped `observation_items`, and `audit_log` row are committed in one database transaction. A duplicate id returns the existing record unchanged. `completedAt` is stored in `activity_sessions.completed_at`; `created_at` is set separately by the server.

`stepData` must pass the strict activity-specific JSON Schema in REQ-05. Unknown properties are discarded before persistence; invalid declared values reject the request. `make-a-ten` accepts only aggregate numeric counts and outcome fields, never React state such as `frameCounters`.

For each matching `activity_skill_map` row, the transaction creates one `observation_items` row with `source = 'activity'`. The session outcome maps to `on_own` when fully correct with no hints, `with_help` when fully correct with hints, and `not_yet` otherwise. This creates a comparable skill observation across separate sessions for Phase 2 confidence calculations.

### Per-activity `stepData` JSON Schemas

These are the normative JSON Schema definitions for `stepData`; fields are optional, but every supplied value must match its declared type. Each activity schema and nested object rejects unknown properties. The global validator first removes unknown properties, then validates the remaining values.

```js
const nonNegativeInteger = { type: "integer", minimum: 0 };
const activityStepDataSchemas = {
  "talk-and-turn": {
    type: "object",
    additionalProperties: false,
    properties: {
      selectedPrompts: { type: "array", items: { type: "string" } },
      correct: nonNegativeInteger,
      total: nonNegativeInteger,
      attempts: nonNegativeInteger
    }
  },
  "sound-hunt": {
    type: "object",
    additionalProperties: false,
    properties: {
      correct: nonNegativeInteger,
      total: nonNegativeInteger,
      attempts: nonNegativeInteger
    }
  },
  "sound-sorter": {
    type: "object",
    additionalProperties: false,
    properties: {
      rounds: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            roundId: { type: "string" },
            chosen: { type: "string" },
            isCorrect: { type: "boolean" }
          }
        }
      },
      correct: nonNegativeInteger,
      total: nonNegativeInteger
    }
  },
  "blend-a-word": {
    type: "object",
    additionalProperties: false,
    properties: {
      correct: nonNegativeInteger,
      total: nonNegativeInteger,
      blendAttempts: nonNegativeInteger,
      attempts: nonNegativeInteger
    }
  },
  "add-numbers": {
    type: "object",
    additionalProperties: false,
    properties: {
      finalAnswer: { type: "number" },
      isCorrect: { type: "boolean" },
      hintsUsed: nonNegativeInteger,
      correct: nonNegativeInteger,
      total: nonNegativeInteger
    }
  },
  "bead-string": {
    type: "object",
    additionalProperties: false,
    properties: {
      slidCount: nonNegativeInteger,
      isCorrect: { type: "boolean" },
      correct: nonNegativeInteger,
      total: nonNegativeInteger
    }
  },
  "make-a-ten": {
    type: "object",
    additionalProperties: false,
    properties: {
      placedInFrame: nonNegativeInteger,
      remainingInTray: nonNegativeInteger,
      isCorrect: { type: "boolean" },
      correct: nonNegativeInteger,
      total: nonNegativeInteger
    }
  },
  "group-of-5": {
    type: "object",
    additionalProperties: false,
    properties: {
      countedTotal: nonNegativeInteger,
      isCorrect: { type: "boolean" },
      correct: nonNegativeInteger,
      total: nonNegativeInteger
    }
  }
};
```

### `GET /api/health`

```jsonc
{
  "ok":   true,
  "mode": "postgres",      // or "json"
  "db":   "connected"      // or "unreachable"
}
```

### Unchanged endpoints
All existing `GET /api/state`, `PATCH /api/learners/:id`, `POST /api/notes`, `PATCH /api/notes/:id`, etc. keep their current response shapes. They route through `getStore()` so they work with both backends.

---

## Client-side changes

### `Dashboards.jsx` — consent gate (REQ-19)
```js
// First operation in onSaveAssessment; missing consent also denies the save.
if (!learner?.consent) return;
```
The guard precedes assessment construction, local persistence, and the API call. The API remains authoritative and rejects absent, false, or revoked analysis consent.

### `activitiesData.js` — remove client-side tier thresholds (REQ-07)
- Remove `recommendedTier` from all `generateActivityLesediReview` return objects.
- Remove the `recTier` calculation blocks.
- Remove the dead `hasAudio` branch from activity review data; audio support is out of scope until added explicitly.
- Persist `blendAttempts` as `assessmentRecord.stepData.blendAttempts` for `blend-a-word`.
- In Phase 1, keep only a name-free fallback template on the client, using a first name or reference id (never a full name). Move the complete `generateActivityLesediReview` implementation into the backend Lesedi module in Phase 2.
- No client code may calculate or apply a tier change. Phase 2 may store a tier suggestion only in `lesedi_outputs.output`; only teacher approval may write `tier_history` and update the learner's current tier.

### Phase 2 Lesedi confidence and finding privacy
- Count `observation_items` for the relevant skill across sessions: fewer than 3 yields `Low`; 3 or more yields `Medium`. A single-question session yields `Low` by design.
- Do not emit a tier suggestion for a skill with fewer than 3 observations.
- Findings and `context_snapshot` must not include full names or phone numbers. First name or reference id may be used in the Phase 1 client fallback only.

---

## Docker Compose (local development)

```yaml
# docker-compose.yml (root)
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB:       pula
      POSTGRES_USER:     pula
      POSTGRES_PASSWORD: pula_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    environment:
      DATABASE_URL:    postgres://pula:pula_dev@db:5432/pula?sslmode=disable
      USE_JSON_STORE:  false
      PORT:            4000
    ports:
      - "4000:4000"
    depends_on:
      - db

volumes:
  pgdata:
```

For local dev without Docker: `USE_JSON_STORE=true npm run dev` keeps the JSON store.

---

## Azure deployment notes

- Region: **South Africa North** for backend, database, and storage.
- Instance: **Burstable B1ms** (1 vCore, 2 GB RAM) — sufficient for demo/hackathon scale.
- SSL: `DATABASE_URL` must include `?sslmode=require`.
- Managed identity: `AZURE_CLIENT_ID` set; password auth disabled in production.
- `DATABASE_URL` stored in Azure Key Vault; referenced as an app setting via Key Vault reference syntax.
- Daily Lesedi model call cap: `LESEDI_DAILY_CALL_CAP` env var (default 200); enforced in Phase 2.

---

## Tenancy enforcement (middleware)

```js
// backend/src/middleware/access.js
requireClassroomAccess(classroomId)   // reads req.user.role, req.user.classroomIds, req.user.schoolId
requireLearnerAccess(learnerId)       // as above + parent check
requireHodAccess(schoolId)            // req.user.role === 'hod' && req.user.schoolId === schoolId
```

For the demo, `req.user` is a hardcoded demo user injected by `backend/src/middleware/demoAuth.js`. The middleware interface is the same so real auth can be plugged in later.

---

## Decisions recorded

| Decision | Rationale |
|---|---|
| API-layer tenancy, not Postgres RLS | Single Express entry point; RLS requires per-user connections, incompatible with connection pooling on Burstable instance |
| Text CHECK constraints, not Postgres ENUM | Easier to add values in future migrations without a full type rebuild |
| `caps_rating_code` defaults to NULL | Grade R is observed and has no DBE code; NULL is correct, not 4 |
| `recommendedTier` removed from client | A tier change is a teacher decision. Client-side thresholds bypass guardrails and observation-count requirements |
| Strict activity-specific JSON Schemas | Prevent unknown or raw component data, including names and make-a-ten React state, from entering saved sessions |
| `completed_at` vs `created_at` | `completed_at` is the client timestamp when the learner finished; `created_at` is server time at insert. Both are needed for offline sync analysis |
| `weeksInTier` as computed function | Avoids stale stored values when tier_history is back-filled; consistent with no-derived-values rule |
