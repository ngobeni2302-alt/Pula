-- Migration 003: activity library, skill map, and sessions

BEGIN;

-- ── activities (the library) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id          TEXT PRIMARY KEY,    -- e.g. 'sound-sorter'
  subject     TEXT NOT NULL CHECK (subject IN ('English','Mathematics')),
  name        TEXT NOT NULL,
  description TEXT,
  caps_ref    TEXT,
  tier        TEXT CHECK (tier IN ('Seed','Sprout','Bloom','Tree')),
  grade_range TEXT,               -- e.g. 'R-1'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── activity_skill_map ────────────────────────────────────────────────────
-- Maps each activity to the observation_items it produces on completion.
CREATE TABLE IF NOT EXISTS activity_skill_map (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id TEXT NOT NULL REFERENCES activities(id),
  subject     TEXT NOT NULL CHECK (subject IN ('English','Mathematics')),
  skill       TEXT NOT NULL,
  caps_ref    TEXT,
  item        TEXT NOT NULL,
  strategy    TEXT CHECK (strategy IN (
                'counters','fingers','pictures',
                'mental','number_line','building_up','other'
              ))
);

-- ── activity_sessions ─────────────────────────────────────────────────────
-- id is CLIENT-generated UUID — upsert is idempotent on id.
-- completed_at = client timestamp; created_at = server insert time.
CREATE TABLE IF NOT EXISTS activity_sessions (
  id                UUID PRIMARY KEY,
  learner_id        UUID NOT NULL REFERENCES learners(id),
  activity_id       TEXT NOT NULL REFERENCES activities(id),
  subject           TEXT NOT NULL CHECK (subject IN ('English','Mathematics')),
  term              INT  NOT NULL CHECK (term BETWEEN 1 AND 4),
  academic_year     INT  NOT NULL,
  score             INT,
  max_score         INT,
  hints_used        INT  NOT NULL DEFAULT 0,
  attempts          INT  NOT NULL DEFAULT 1,
  step_data         JSONB,         -- validated allowlist per activity_id; no names
  completed_at      TIMESTAMPTZ,   -- from client completedAt
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_updated_at TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_activity_sessions_learner_term
  ON activity_sessions(learner_id, term, academic_year);

COMMIT;
