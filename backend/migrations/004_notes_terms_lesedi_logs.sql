-- Migration 004: parent notes, terms, lesedi outputs, intervention log, audit log

BEGIN;

-- ── parent_notes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parent_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id        UUID NOT NULL REFERENCES learners(id),
  text              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','to_review','sent')),
  language          TEXT,
  channel           TEXT,
  created_by        UUID REFERENCES users(id),
  approved_by       UUID REFERENCES users(id),
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_updated_at TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  -- A sent note must have been approved
  CONSTRAINT sent_requires_approval
    CHECK (status <> 'sent' OR approved_by IS NOT NULL)
);

-- ── terms ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS terms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID REFERENCES schools(id),
  year         INT  NOT NULL,
  term         INT  NOT NULL CHECK (term BETWEEN 1 AND 4),
  name         TEXT,
  dates        TEXT,
  hod_reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by  UUID REFERENCES users(id),
  reviewed_at  TIMESTAMPTZ
);

-- ── lesedi_outputs ────────────────────────────────────────────────────────
-- context_snapshot must be validated before storage: no names, no phone numbers.
-- A tier suggestion lives in output JSONB only — never applied directly.
CREATE TABLE IF NOT EXISTS lesedi_outputs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task             TEXT NOT NULL CHECK (task IN (
                     'activity_draft','gap_explanation',
                     'class_insight','hod_insight','parent_note'
                   )),
  subject          TEXT CHECK (subject IN ('English','Mathematics')),
  learner_id       UUID REFERENCES learners(id),    -- nullable for class/HOD tasks
  classroom_id     UUID REFERENCES classrooms(id),
  context_snapshot JSONB NOT NULL,
  output           JSONB NOT NULL,
  confidence       TEXT CHECK (confidence IN ('High','Medium','Low')),
  model            TEXT,
  prompt_version   TEXT,
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','approved','rejected')),
  approved_by      UUID REFERENCES users(id),
  approved_at      TIMESTAMPTZ,
  teacher_edited   BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── intervention_log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intervention_log (
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

-- ── audit_log (append-only) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES users(id),
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id TEXT,
  at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
