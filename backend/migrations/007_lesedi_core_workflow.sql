-- Additive workflow storage. Existing users, classrooms, learners and history survive.
BEGIN;
CREATE TABLE IF NOT EXISTS core_accounts (
  id UUID PRIMARY KEY REFERENCES users(id),
  school_id UUID NOT NULL REFERENCES schools(id),
  payload JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS core_assignments (
  id UUID PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id),
  learner_id UUID NOT NULL REFERENCES learners(id),
  teacher_id UUID NOT NULL REFERENCES users(id),
  payload JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS core_drafts (
  id UUID PRIMARY KEY REFERENCES core_assignments(id),
  school_id UUID NOT NULL REFERENCES schools(id),
  learner_id UUID NOT NULL REFERENCES learners(id),
  teacher_id UUID NOT NULL REFERENCES users(id),
  payload JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS core_notifications (
  id UUID PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id),
  learner_id UUID NOT NULL REFERENCES learners(id),
  teacher_id UUID NOT NULL REFERENCES users(id),
  payload JSONB NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS core_notification_once ON core_notifications ((payload->>'draftId')) WHERE payload->>'draftId' IS NOT NULL;
CREATE TABLE IF NOT EXISTS core_audits (
  id UUID PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id),
  payload JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS core_drafts_teacher ON core_drafts (school_id, teacher_id);
CREATE INDEX IF NOT EXISTS core_notifications_learner ON core_notifications (school_id, learner_id);
COMMIT;
