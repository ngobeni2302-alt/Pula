-- Migration 002: reading progress and observation tables

BEGIN;

-- ── reading_progress ──────────────────────────────────────────────────────
-- Replaces learners.termProgress from data.json.
-- Class averages are computed from this table, never stored.
CREATE TABLE IF NOT EXISTS reading_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id        UUID NOT NULL REFERENCES learners(id),
  year              INT  NOT NULL,
  term              INT  NOT NULL CHECK (term BETWEEN 1 AND 4),
  wpm               INT,
  accuracy          NUMERIC(5,2),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_updated_at TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_learner_term
  ON reading_progress(learner_id, term, year);

-- ── observation_items ─────────────────────────────────────────────────────
-- Structured evidence rows. Created by teachers, speech scores, or activities.
CREATE TABLE IF NOT EXISTS observation_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id        UUID NOT NULL REFERENCES learners(id),
  subject           TEXT NOT NULL CHECK (subject IN ('English','Mathematics')),
  skill             TEXT NOT NULL,
  caps_ref          TEXT,
  item              TEXT NOT NULL,
  result            TEXT CHECK (result IN ('not_yet','with_help','on_own')),
  strategy          TEXT CHECK (strategy IN (
                      'counters','fingers','pictures',
                      'mental','number_line','building_up','other'
                    )),
  source            TEXT NOT NULL CHECK (source IN ('teacher','speech_score','activity')),
  observed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_updated_at TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_obs_items_learner_term
  ON observation_items(learner_id, observed_at);

-- ── learner_observations (free-text notes) ────────────────────────────────
CREATE TABLE IF NOT EXISTS learner_observations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id  UUID NOT NULL REFERENCES learners(id),
  text        TEXT NOT NULL,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

COMMIT;
