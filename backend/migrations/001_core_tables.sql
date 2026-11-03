-- Migration 001: core tables
-- schools, users, classrooms, learners, guardian_consents, tier_history

BEGIN;

-- ── schools ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  emis_number  TEXT UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── users ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('teacher','hod','parent')),
  school_id  UUID REFERENCES schools(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── classrooms ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classrooms (
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

-- ── learners ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learners (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id       UUID NOT NULL REFERENCES classrooms(id),
  first_name         TEXT NOT NULL,
  last_name          TEXT,                           -- never sent to Lesedi
  literacy_tier      TEXT CHECK (literacy_tier IN ('Seed','Sprout','Bloom','Tree')),
  maths_tier         TEXT CHECK (maths_tier    IN ('Seed','Sprout','Bloom','Tree')),
  language           TEXT,
  channel            TEXT,
  caps_rating_code   INT  CHECK (caps_rating_code BETWEEN 1 AND 7),  -- NULL for Grade R
  sounds_to_practise TEXT[],
  client_updated_at  TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_learners_classroom
  ON learners(classroom_id);

-- ── guardian_consents ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guardian_consents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id  UUID NOT NULL REFERENCES learners(id),
  scope       TEXT NOT NULL CHECK (scope IN ('analysis','voice','training')),
  granted_by  TEXT,          -- display name of guardian; not a FK
  granted_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- View: latest consent state per learner per scope
CREATE OR REPLACE VIEW current_consent AS
SELECT DISTINCT ON (learner_id, scope)
  learner_id,
  scope,
  (granted_at IS NOT NULL AND revoked_at IS NULL) AS granted
FROM guardian_consents
ORDER BY learner_id, scope, created_at DESC;

-- ── tier_history ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tier_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id        UUID NOT NULL REFERENCES learners(id),
  subject           TEXT NOT NULL CHECK (subject IN ('English','Mathematics')),
  tier              TEXT NOT NULL CHECK (tier IN ('Seed','Sprout','Bloom','Tree')),
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by        UUID REFERENCES users(id),
  reason            TEXT,
  client_updated_at TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Computed: weeks in current tier (not a stored column)
CREATE OR REPLACE FUNCTION weeks_in_current_tier(
  p_learner_id UUID,
  p_subject    TEXT
) RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT ROUND(
    EXTRACT(EPOCH FROM (now() - changed_at)) / 604800.0,
    1
  )
  FROM tier_history
  WHERE learner_id = p_learner_id
    AND subject    = p_subject
  ORDER BY changed_at DESC
  LIMIT 1;
$$;

COMMIT;
