-- Migration 005: additional indexes (REQ-18)
-- Primary indexes are created inline in earlier migrations.
-- This file adds the remaining composite indexes.

BEGIN;

-- Learners: filter by classroom and grade (REQ-18)
CREATE INDEX IF NOT EXISTS idx_learners_classroom_grade
  ON learners(classroom_id);
-- Note: grade lives on classrooms, not learners, so the join uses classroom_id.
-- A partial index on (classroom_id) is sufficient for classroom-scoped queries.

-- Activity sessions: per-learner per-term lookups (REQ-18)
-- Already created in 003; kept here for completeness check.
CREATE INDEX IF NOT EXISTS idx_activity_sessions_learner_term
  ON activity_sessions(learner_id, term, academic_year);

-- Observation items: per-learner chronological (REQ-18)
CREATE INDEX IF NOT EXISTS idx_obs_items_learner_term
  ON observation_items(learner_id, observed_at);

-- Reading progress: per-learner per-term (REQ-18)
CREATE INDEX IF NOT EXISTS idx_reading_progress_learner_term
  ON reading_progress(learner_id, term, year);

-- Messages: per-conversation chronological (REQ-18)
-- messages table is added by the existing messaging system in server.js.
-- This index is created here so it is not lost when the messaging migration runs.
-- IF the messages table doesn't exist yet this is a no-op via DO block.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'messages'
  ) THEN
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
        ON messages(conversation_id, created_at DESC)
    ';
  END IF;
END
$$;

COMMIT;
