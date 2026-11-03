# Phase 1 Requirements — PostgreSQL for the Whole App

## Context
The Pula backend currently stores all data in `backend/data.json`. The activities PR (`8b927e9`) added 8 interactive activities whose results are saved only to `localStorage` with no backend persistence, no consent gate, and no server validation.

This phase replaces `data.json` with PostgreSQL (Azure Database for PostgreSQL Flexible Server), adds a real persistence endpoint for activity sessions, and lays the database foundation that Phases 2 and 3 depend on.

## Assumptions
- `USE_JSON_STORE=true` keeps the existing JSON behaviour unchanged so the demo works without a database.
- All new tables use client-generated UUIDs so offline records can sync safely via upsert-on-id.
- The existing Express API response shapes are unchanged; `POST /api/assessments` is additive only.
- Grade R learners have no DBE code; `caps_rating_code` defaults to NULL, not 4.
- `avgWpm`, `yearSummary`, and other derived values from `data.json` are computed from tables, not stored.
- Audio recording URLs are not stored; audio is deleted after scoring. If kept in future, it must be consent-scoped with a retention date.
- Row-level security (RLS) is enforced in the API layer (not Postgres RLS), because the Express server is the single access point and Postgres RLS adds maintenance cost without a multi-tenant DB connection pool. The design document records this decision.
- Teacher and HOD seed users are created in migrations so `approved_by` can be a real foreign key from day one.
- `weeksInTier` is computed from `tier_history`, never stored as a column.
- Class-average WPM and other aggregates are computed from `reading_progress`, never stored.
- Subject names are stored as `English` and `Mathematics` (full words) everywhere. A lookup table `subjects` enforces the enum.
- The `confidence` field on a Lesedi output is based on the count of `observation_items` for that skill across sessions (≥ 3 = Medium, < 3 = Low), not on items inside one session.

---

## Requirements

### REQ-01 Schools and classrooms
- There is a `schools` table with `id`, `name`, `emis_number`, `created_at`.
- `classrooms.school_id` references `schools.id`.
- Every table reachable from a school is filterable by `school_id`.
- Teachers see only their own classrooms. HODs see all classrooms in their school. Parents see only their own children. This is enforced in the API middleware, not in Postgres RLS.

### REQ-02 Per-subject tiers
- `learners` has `literacy_tier` and `maths_tier` (replacing the single `group` / `current_tier`).
- `tier_history` has a `subject` column (`English` | `Mathematics`).
- `weeksInTier` is a computed value (SQL function or view), never a stored column.

### REQ-03 Observation items
- `observation_items` table: `id`, `learner_id`, `subject`, `skill`, `caps_ref`, `item`, `result` (`not_yet` | `with_help` | `on_own`), `strategy` (`counters` | `fingers` | `pictures` | `mental` | `number_line` | `building_up` | `other`), `source` (`teacher` | `speech_score` | `activity`), `observed_at`, `client_updated_at`, `updated_at`, `deleted_at`.
- `learner_observations` remains for free-text notes.

### REQ-04 Activity sessions persistence
- `POST /api/assessments` accepts an activity-session payload with a client-generated `id` (UUID). The operation is idempotent: if the `id` already exists, the server returns the existing record unchanged (`200`) without creating duplicate observations. A new record returns `201`.
- The server checks the learner's `analysis` consent against `current_consent`; missing, false, or revoked consent rejects the save with HTTP `403` and a structured JSON reason (`reason: "consent_required"`). The request body is not authoritative for consent.
- `completedAt` maps to `activity_sessions.completed_at`. `created_at` is set by the server at insert time and is separate.
- `step_data` is validated against a per-`activity_id` JSON schema allowlist (defined in `REQ-05`). Fields not on the allowlist are stripped before storage.
- No learner names appear in `step_data` or any other column of `activity_sessions`.
- The session, observation rows, and audit row are committed atomically. Retries with the same id do not repeat side effects.

### REQ-05 Session data schema per activity
Each activity has a strict JSON Schema allowlist. Every schema is an object schema with `additionalProperties: false`; declared fields have the indicated scalar or array types, and nested `rounds` objects also reject additional properties. The server validates on write, strips unknown fields, and rejects invalid values.

| `activity_id`  | Allowed fields and types in `step_data` |
|---|---|
| `talk-and-turn`  | `selectedPrompts` (string array), `correct`, `total`, `attempts` (non-negative integers) |
| `sound-hunt`     | `correct`, `total`, `attempts` (non-negative integers) |
| `sound-sorter`   | `rounds` (array of `{ roundId: string, chosen: string, isCorrect: boolean }`), `correct`, `total` (non-negative integers) |
| `blend-a-word`   | `correct`, `total`, `blendAttempts`, `attempts` (non-negative integers) |
| `add-numbers`    | `finalAnswer` (number), `isCorrect` (boolean), `hintsUsed`, `correct`, `total` (non-negative integers) |
| `bead-string`    | `slidCount`, `correct`, `total` (non-negative integers), `isCorrect` (boolean) |
| `make-a-ten`     | `placedInFrame`, `remainingInTray`, `correct`, `total` (non-negative integer counts), `isCorrect` (boolean) — aggregate counts only, **never raw React state** |
| `group-of-5`     | `countedTotal`, `correct`, `total` (non-negative integers), `isCorrect` (boolean) |

No schema accepts names, `hasAudio`, `frameCounters`, or other raw component state. `hasAudio` is removed until audio exists.

### REQ-06 Activity–skill map
- `activity_skill_map` table: `activity_id`, `subject`, `skill`, `caps_ref`, `item`, `strategy`.
- When a session is saved successfully, the server creates `observation_items` rows from `activity_skill_map` rows matching the `activity_id`, with `source = 'activity'` and `result` derived from the session `step_data`.
- One observation is created per matching skill-map row; its result is `on_own` for a fully correct session without hints, `with_help` for a fully correct session with hints, and `not_yet` otherwise. This mapping is performed in the same transaction as the session insert.

### REQ-07 Tier changes
- `generateActivityLesediReview` client-side tier thresholds are removed from `activitiesData.js`. The field `recommendedTier` is removed from the client-side review object.
- The full `generateActivityLesediReview` implementation moves to the backend Lesedi module in Phase 2. In Phase 1 the client retains only a name-free fallback template, using a first name or reference id, and it contains no tier thresholds.
- A tier suggestion lives only in `lesedi_outputs.output JSONB` (Phase 2), and cannot be generated when fewer than three `observation_items` exist for the relevant skill.
- A tier change is applied only when a teacher approves a Lesedi output, which writes a new row to `tier_history` and updates `learners.literacy_tier` or `learners.maths_tier`. No other path may update those columns.

### REQ-08 Confidence scoring
- `confidence` on a Lesedi output is `Low` when the count of `observation_items` for the relevant skill across all sessions is fewer than 3, and `Medium` when the count is 3 or more.
- A single-session activity that produces only one observation item is always `Low`.
- This rule is enforced in the backend Lesedi module (Phase 2), not on the client.

### REQ-09 Guardian consents
- `guardian_consents` table: `id`, `learner_id`, `scope` (`analysis` | `voice` | `training`), `granted_by`, `granted_at`, `revoked_at`.
- A view `current_consent` returns one row per learner per scope with a boolean `granted` (true when `granted_at` is set and `revoked_at` is null).
- `learners.parent_consent` is removed. All consent checks read from `current_consent`.
- Lesedi reads consent from `current_consent` and must refuse to process any learner whose `analysis` consent is not `granted = true`.

### REQ-10 Reading progress
- `reading_progress` table: `id`, `learner_id`, `year`, `term`, `wpm`, `accuracy`, `recorded_at`, `client_updated_at`, `updated_at`, `deleted_at`.
- This replaces `learners.termProgress` from `data.json`.
- Class-average WPM and per-term averages are computed from this table via SQL views, not stored.

### REQ-11 Parent notes
- `parent_notes` table: `id`, `learner_id`, `text`, `status` (`draft` | `to_review` | `sent`), `language`, `channel`, `created_by` (FK `users.id`), `approved_by` (FK `users.id`, nullable), `sent_at`, `created_at`, `client_updated_at`, `updated_at`, `deleted_at`.
- This replaces `notes[]` from `data.json`.
- A note with `status = sent` must have `approved_by` set. The server enforces this.

### REQ-12 Lesedi outputs
- `lesedi_outputs` table: `id`, `task` (`activity_draft` | `gap_explanation` | `class_insight` | `hod_insight` | `parent_note`), `subject`, `learner_id` (nullable), `classroom_id`, `context_snapshot JSONB` (no names, no phone numbers), `output JSONB`, `confidence`, `model`, `prompt_version`, `status` (`draft` | `approved` | `rejected`), `approved_by` (FK `users.id`, nullable), `approved_at`, `teacher_edited` boolean, `created_at`.
- The `context_snapshot` must be validated before storage: no phone numbers, no full names.

### REQ-13 Terms
- `terms` table: `id`, `year`, `term` (1–4), `name`, `dates`, `hod_reviewed` boolean, `reviewed_by` (FK `users.id`, nullable), `reviewed_at`.

### REQ-14 Intervention log
- `intervention_log` table: `id`, `learner_id`, `teacher_id` (FK `users.id`), `subject`, `action`, `outcome`, `logged_at`, `client_updated_at`, `updated_at`, `deleted_at`.

### REQ-15 Audit log
- `audit_log` table: `id`, `user_id`, `action`, `entity`, `entity_id`, `at`. Append-only; no `deleted_at`.

### REQ-16 Offline sync support
- All mutable tables have `client_updated_at`, `updated_at`, `deleted_at`.
- `POST /api/assessments` is idempotent on client `id`.
- Both `PgStore` and `JsonStore` preserve the same idempotency behavior for that client-generated id.
- The `USE_JSON_STORE` environment flag, when `true`, routes all reads and writes through the existing JSON file store.

### REQ-17 Users and seed data
- `users` table: `id`, `name`, `role` (`teacher` | `hod` | `parent`), `school_id`, `created_at`.
- The seed migration creates at minimum one Teacher user and one HOD user with known IDs so that `approved_by`, `created_by`, and `reviewed_by` foreign keys resolve from day one.

### REQ-18 Indexes
- `(classroom_id, grade)` on `learners`.
- `(learner_id, term, academic_year)` on `activity_sessions`, `academic_assessments`, `observation_items`.
- `(conversation_id, created_at DESC)` on `messages`.

### REQ-19 Client-side consent gate
- `onSaveAssessment` in `Dashboards.jsx` must return before creating or saving any assessment, writing local state/storage, or making a request when `learner.consent` is false or missing. This is a silent client-side gate; the server independently returns `403` for missing, false, or revoked analysis consent.
- The check is in addition to the server-side `403`.

### REQ-20 Health endpoint
- `GET /api/health` checks the database connection and returns `{ ok, mode, db }` where `mode` is `postgres` or `json` and `db` is `connected` or `unreachable`.

### REQ-21 No derived values stored
- `avgWpm`, `yearSummary.learnersHeard`, `yearSummary.movedUp`, `yearSummary.parentNotesSent` are never stored. They are query results.
- The seed script skips these fields from `data.json`.

### REQ-22 Remove audio URLs
- `audio_recording_url` is not added to any table. If audio retention is required in future, it must be added with a consent scope and a `retention_until` date.
- Remove the dead `hasAudio` branch from activity review data until audio support exists. Persist `blendAttempts` as `step_data.blendAttempts` in the `blend-a-word` session record.

### REQ-23 Name-free findings
- Lesedi findings and `context_snapshot` must not contain a learner's full name or phone number. Phase 1 client fallback strings may use only a first name or reference id; full names must not be composed or copied into finding text.
