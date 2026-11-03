# Phase 1 Tasks

## Task 1 — Git branch
- [x] Confirm `8b927e9` is merged into `main` and create `phase1-postgresql-main` from `main`

## Task 2 — Docker Compose and environment
- [ ] Create `docker-compose.yml` at repo root (postgres:16 service + backend service)
- [ ] Create `backend/.env.example` with `DATABASE_URL`, `USE_JSON_STORE`, `PORT`
- [ ] Add `backend/.env` to `.gitignore`

## Task 3 — Database migrations
- [ ] Create `backend/migrations/` folder and a migration runner (`backend/src/db/migrate.js`)
- [ ] `001_core_tables.sql` — schools, users, classrooms, learners, guardian_consents, current_consent view, tier_history, weeks_in_current_tier function
- [ ] `002_progress_observations.sql` — reading_progress, observation_items, learner_observations
- [ ] `003_activities_sessions.sql` — activities, activity_skill_map, activity_sessions
- [ ] `004_notes_terms_lesedi_logs.sql` — parent_notes, terms, lesedi_outputs, intervention_log, audit_log
- [ ] `005_indexes.sql` — all indexes from REQ-18
- [ ] `006_seed_users.sql` — Teacher (UUID `00000000-…-0001`) and HOD (UUID `00000000-…-0002`) seed users

## Task 4 — Seed script
- [ ] Create `backend/src/db/seed.js`
- [ ] Map `classroom` → `schools` + `classrooms`
- [ ] Map `learners` → `learners` (split name, `literacy_tier` from `group`, `maths_tier` same)
- [ ] Map `learners[].consent` → `guardian_consents` (scope `analysis`)
- [ ] Map `learners[].groupJourney` + `recentlyMoved` → `tier_history` (subject `English`)
- [ ] Map `learners[].termProgress` → `reading_progress`
- [ ] Map `learners[].soundsToPractise` → `learners.sounds_to_practise`
- [ ] Map `learners[].checkInNote` → `learner_observations`
- [ ] Map `notes[]` → `parent_notes`
- [ ] Map `terms[]` → `terms`
- [ ] Map `completedActivities[]` → `activity_sessions` (score and step_data null)
- [ ] Seed 8 activities and `activity_skill_map` rows
- [ ] Skip `avgWpm`, `yearSummary` — never stored
- [ ] Add npm script `"db:seed"` to `backend/package.json`

## Task 5 — Repository layer
- [ ] Create `backend/src/store/pool.js` (single pg Pool, `DATABASE_URL`, SSL required)
- [ ] Create `backend/src/store/schema.js` — per-activity `step_data` allowlists and validators
- [ ] Create `backend/src/store/JsonStore.js` — wraps existing `data.json` logic
- [ ] Create `backend/src/store/PgStore.js` — implements full store interface using pg
- [ ] Create `backend/src/store/index.js` — `getStore()` returns JsonStore or PgStore based on `USE_JSON_STORE`
- [ ] Replace all direct `data.json` reads/writes in `server.js` with `getStore()` calls

## Task 6 — New endpoint: `POST /api/assessments`
- [ ] Add route in `server.js` (or a new `backend/src/routes/activitySessions.js`)
- [ ] Consent gate — require `current_consent` `analysis` grant; missing, false, or revoked returns `403` with `{ ok: false, reason: "consent_required", learnerId }`
- [ ] Idempotency — upsert on client `id`; return `200 + { duplicate: true }` if already exists
- [ ] Validate `step_data` against strict per-activity JSON Schema; strip unknown fields; return `400` with details on invalid values
- [ ] Strip any name-like fields from `step_data` before storage
- [ ] On `201`: atomically insert `observation_items` rows from `activity_skill_map` with `source = 'activity'` and result derived from the session outcome
- [ ] On `201`: write `audit_log` row in the same transaction
- [ ] Map `completedAt` → `completed_at`; `created_at` is server-set

## Task 7 — Update `GET /api/health`
- [x] Add `mode` (`postgres` | `json`) and `db` (`connected` | `unreachable`) to response
- [x] Test DB connection with `SELECT 1`

## Task 8 — Client-side fixes (`activitiesData.js` and `Dashboards.jsx`)
- [ ] Remove client-side tier thresholds and `recommendedTier` / `recTier` blocks
- [ ] Keep only a name-free client fallback using first name or reference id; move full `generateActivityLesediReview` implementation to backend Lesedi module in Phase 2
- [ ] Ensure findings never contain full names
- [ ] Remove dead `hasAudio` branch from `talk-and-turn` review
- [ ] Include `blendAttempts` in `blend-a-word` `assessmentRecord.stepData` in `ActivitiesHub.jsx`
- [ ] Add missing/false consent guard as the first operation in `onSaveAssessment` in `Dashboards.jsx`
- [ ] Call `POST /api/assessments` from `onSaveAssessment` handler in `Dashboards.jsx`

## Task 9 — Tests
- [ ] **T-01** Unit: client consent gate returns before local assessment construction or persistence when consent is missing or false
- [ ] **T-02** Unit: `step_data` validator strips unknown fields and accepts allowlist fields per activity
- [ ] **T-03** Unit: `make-a-ten` `step_data` never contains raw React state fields (`frameCounters`)
- [ ] **T-04** Unit: no full names in `step_data` or `context_snapshot` (privacy check)
- [ ] **T-05** Unit: client review/fallback has no tier thresholds or `recommendedTier`
- [ ] **T-06** Unit: `blendAttempts` is included in `blend-a-word` session record
- [ ] **T-07** Unit: confidence is `Low` when cross-session `observation_items` count for a skill is fewer than 3
- [ ] **T-08** Unit: confidence is `Medium` when cross-session `observation_items` count for a skill is 3 or more
- [ ] **T-09** Unit: a one-question session produces `Low` confidence by design
- [ ] **T-10** Consent: Palesa (`consent: false`) creates no saved assessment client-side; server responds `403 consent_required` and creates no session or observation
- [ ] **T-11** Lesedi: fewer than 3 observations for a skill yields no tier suggestion
- [ ] **T-12** Privacy: a finding never includes a learner's full name (fallback may use first name or reference id)
- [ ] **T-13** Backend integration: valid `POST /api/assessments` saves one `activity_sessions` row plus mapped `observation_items`; duplicate id causes no duplicate side effects; denied consent saves nothing; invalid `step_data` is rejected
- [ ] **T-14** Integration: `USE_JSON_STORE=true` — existing frontend calls still work unchanged
- [ ] **T-15** Integration: `USE_JSON_STORE=false` — existing frontend calls still work unchanged
- [ ] **T-16** Integration: `GET /api/health` returns correct `mode` and `db` for both store types

## Task 10 — README section
- [ ] Add `## Database` section to root `README.md`
- [ ] Document: how to run migrations, how to seed, environment variables, switching providers (`USE_JSON_STORE`)

## Phase 2 handoff — Backend Lesedi module (not part of Phase 1 implementation)
- [ ] Move full `generateActivityLesediReview` logic into the backend Lesedi module; retain only the Phase 1 client fallback
- [ ] Calculate confidence from cross-session `observation_items` per skill (`< 3` = Low; `>= 3` = Medium) and suppress tier suggestions below 3 observations
- [ ] Store suggestions only in `lesedi_outputs`; apply tier updates only after teacher approval, recording the change in `tier_history`
