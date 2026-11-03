/**
 * PgStore.js
 * Implements the full store interface using PostgreSQL.
 * Keeps existing API response shapes unchanged.
 */

import { getPool } from './pool.js';
import crypto from 'node:crypto';

export class PgStore {

  // ── Classrooms ──────────────────────────────────────────────────────────

  async getClassroom(id) {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT * FROM classrooms WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return rows[0] ?? null;
  }

  async patchClassroom(id, fields) {
    const pool = getPool();
    const allowed = ['name', 'grade', 'teacher_id', 'code'];
    const sets    = [];
    const vals    = [];
    let   i       = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { sets.push(`${k} = $${i++}`); vals.push(v); }
    }
    if (!sets.length) return this.getClassroom(id);
    sets.push(`updated_at = now()`);
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE classrooms SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return rows[0];
  }

  // ── Learners ─────────────────────────────────────────────────────────────

  async getLearners(classroomId) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT l.*,
              (SELECT granted FROM current_consent
               WHERE learner_id = l.id AND scope = 'analysis'
               LIMIT 1) AS consent
       FROM learners l
       WHERE l.classroom_id = $1 AND l.deleted_at IS NULL`,
      [classroomId]
    );
    return rows;
  }

  async getLearner(id) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT l.*,
              (SELECT granted FROM current_consent
               WHERE learner_id = l.id AND scope = 'analysis'
               LIMIT 1) AS consent
       FROM learners l WHERE l.id = $1 AND l.deleted_at IS NULL`,
      [id]
    );
    return rows[0] ?? null;
  }

  async patchLearner(id, fields) {
    const pool    = getPool();
    const allowed = [
      'literacy_tier', 'maths_tier', 'language', 'channel',
      'caps_rating_code', 'sounds_to_practise',
    ];
    const sets = [];
    const vals = [];
    let   i    = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { sets.push(`${k} = $${i++}`); vals.push(v); }
    }
    if (!sets.length) return this.getLearner(id);
    sets.push(`updated_at = now()`);
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE learners SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return rows[0];
  }

  async deleteLearner(id) {
    const pool = getPool();
    await pool.query(
      `UPDATE learners SET deleted_at = now() WHERE id = $1`,
      [id]
    );
    return { ok: true };
  }

  // ── Consent ──────────────────────────────────────────────────────────────

  async getConsent(learnerId, scope = 'analysis') {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT granted FROM current_consent WHERE learner_id = $1 AND scope = $2`,
      [learnerId, scope]
    );
    return { granted: rows[0]?.granted === true };
  }

  // ── Activity sessions ────────────────────────────────────────────────────

  async upsertActivitySession(session) {
    const pool = getPool();

    // Check for existing record (idempotent on client id)
    const { rows: existing } = await pool.query(
      'SELECT * FROM activity_sessions WHERE id = $1',
      [session.id]
    );
    if (existing.length > 0) return { session: existing[0], duplicate: true };

    const { rows } = await pool.query(
      `INSERT INTO activity_sessions
         (id, learner_id, activity_id, subject, term, academic_year,
          score, max_score, hints_used, attempts, step_data,
          completed_at, client_updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        session.id,
        session.learnerId,
        session.activityId,
        session.subject,
        session.term,
        session.academicYear,
        session.score      ?? null,
        session.maxScore   ?? null,
        session.hintsUsed  ?? 0,
        session.attempts   ?? 1,
        session.stepData ? JSON.stringify(session.stepData) : null,
        session.completedAt ?? null,
        session.clientUpdatedAt ?? null,
      ]
    );
    return { session: rows[0], duplicate: false };
  }

  async getActivitySessions(learnerId) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM activity_sessions
       WHERE learner_id = $1 AND deleted_at IS NULL
       ORDER BY completed_at DESC NULLS LAST`,
      [learnerId]
    );
    return rows;
  }

  // ── Observation items ────────────────────────────────────────────────────

  async createObservationItems(items) {
    if (!items.length) return [];
    const pool = getPool();
    const inserted = [];
    for (const item of items) {
      const { rows } = await pool.query(
        `INSERT INTO observation_items
           (learner_id, subject, skill, caps_ref, item, result, strategy, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          item.learnerId,
          item.subject,
          item.skill,
          item.capsRef ?? null,
          item.item,
          item.result  ?? null,
          item.strategy ?? null,
          item.source,
        ]
      );
      inserted.push(rows[0]);
    }
    return inserted;
  }

  async countObservationItems(learnerId, skill) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM observation_items
       WHERE learner_id = $1 AND skill = $2 AND deleted_at IS NULL`,
      [learnerId, skill]
    );
    return Number(rows[0].cnt);
  }

  // ── Reading progress ──────────────────────────────────────────────────────

  async getReadingProgress(learnerId) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM reading_progress
       WHERE learner_id = $1 AND deleted_at IS NULL
       ORDER BY year, term`,
      [learnerId]
    );
    return rows;
  }

  async upsertReadingProgress(row) {
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO reading_progress (learner_id, year, term, wpm, accuracy)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [row.learnerId, row.year, row.term, row.wpm ?? null, row.accuracy ?? null]
    );
    return rows[0] ?? row;
  }

  // ── Notes ─────────────────────────────────────────────────────────────────

  async getNotes(classroomId) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT n.* FROM parent_notes n
       JOIN learners l ON n.learner_id = l.id
       WHERE l.classroom_id = $1 AND n.deleted_at IS NULL
       ORDER BY n.created_at DESC`,
      [classroomId]
    );
    return rows;
  }

  async createNote(note) {
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO parent_notes
         (id, learner_id, text, status, language, channel, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        note.id ?? crypto.randomUUID(),
        note.learnerId,
        note.text,
        note.status    ?? 'draft',
        note.language  ?? null,
        note.channel   ?? null,
        note.createdBy ?? null,
      ]
    );
    return rows[0];
  }

  async patchNote(id, fields) {
    const pool    = getPool();
    const allowed = ['text', 'status', 'approved_by', 'sent_at'];
    const sets    = [];
    const vals    = [];
    let   i       = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { sets.push(`${k} = $${i++}`); vals.push(v); }
    }
    if (!sets.length) throw new Error('No patchable fields');
    sets.push(`updated_at = now()`);
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE parent_notes SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return rows[0];
  }

  async deleteNote(id) {
    const pool = getPool();
    await pool.query(
      `UPDATE parent_notes SET deleted_at = now() WHERE id = $1`,
      [id]
    );
    return { ok: true };
  }

  // ── Terms ─────────────────────────────────────────────────────────────────

  async getTerms(schoolId) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM terms WHERE school_id = $1 OR school_id IS NULL ORDER BY year, term`,
      [schoolId]
    );
    return rows;
  }

  async patchTerm(id, fields) {
    const pool    = getPool();
    const allowed = ['hod_reviewed', 'reviewed_by', 'reviewed_at'];
    const sets    = [];
    const vals    = [];
    let   i       = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { sets.push(`${k} = $${i++}`); vals.push(v); }
    }
    if (!sets.length) return null;
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE terms SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return rows[0];
  }

  // ── Tier history ──────────────────────────────────────────────────────────

  async addTierHistory(row) {
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO tier_history (learner_id, subject, tier, changed_by, reason)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [row.learnerId, row.subject, row.tier, row.changedBy ?? null, row.reason ?? null]
    );
    // Also update learners table
    const col = row.subject === 'Mathematics' ? 'maths_tier' : 'literacy_tier';
    await pool.query(
      `UPDATE learners SET ${col} = $1, updated_at = now() WHERE id = $2`,
      [row.tier, row.learnerId]
    );
    return rows[0];
  }

  async getCurrentTier(learnerId, subject) {
    const pool = getPool();
    const col  = subject === 'Mathematics' ? 'maths_tier' : 'literacy_tier';
    const { rows } = await pool.query(
      `SELECT ${col} AS tier FROM learners WHERE id = $1`,
      [learnerId]
    );
    return rows[0]?.tier ?? null;
  }

  // ── Lesedi outputs ────────────────────────────────────────────────────────

  async createLesediOutput(output) {
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO lesedi_outputs
         (task, subject, learner_id, classroom_id, context_snapshot, output,
          confidence, model, prompt_version, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft')
       RETURNING *`,
      [
        output.task,
        output.subject       ?? null,
        output.learnerId     ?? null,
        output.classroomId   ?? null,
        JSON.stringify(output.contextSnapshot),
        JSON.stringify(output.output),
        output.confidence    ?? 'Low',
        output.model         ?? null,
        output.promptVersion ?? null,
      ]
    );
    return rows[0];
  }

  async patchLesediOutput(id, fields) {
    const pool    = getPool();
    const allowed = ['status', 'approved_by', 'approved_at', 'teacher_edited'];
    const sets    = [];
    const vals    = [];
    let   i       = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { sets.push(`${k} = $${i++}`); vals.push(v); }
    }
    if (!sets.length) return null;
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE lesedi_outputs SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return rows[0];
  }

  // ── Intervention log ──────────────────────────────────────────────────────

  async createIntervention(row) {
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO intervention_log
         (learner_id, teacher_id, subject, action, outcome)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [row.learnerId, row.teacherId, row.subject, row.action, row.outcome ?? null]
    );
    return rows[0];
  }

  // ── Assessments (legacy reading round) ───────────────────────────────────
  // These are stored in the existing assessments pattern.
  // In PgStore we keep them in a simple JSONB column for now
  // until a dedicated academic_assessments table is added in Phase 3.

  async createAssessment(row) {
    const pool = getPool();
    // Store in activity_sessions with activity_id = 'reading-round' as a stopgap
    const { rows } = await pool.query(
      `INSERT INTO activity_sessions
         (id, learner_id, activity_id, subject, term, academic_year,
          score, max_score, step_data, completed_at)
       VALUES ($1,$2,'reading-round','English',4,$3,$4,$5,$6,now())
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [
        row.id,
        row.learnerId,
        new Date().getFullYear(),
        row.accuracy ?? null,
        100,
        JSON.stringify(row),
      ]
    );
    return rows[0] ?? row;
  }

  async getAssessments(classroomId) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT s.* FROM activity_sessions s
       JOIN learners l ON s.learner_id = l.id
       WHERE l.classroom_id = $1 AND s.activity_id = 'reading-round'
         AND s.deleted_at IS NULL
       ORDER BY s.completed_at DESC NULLS LAST`,
      [classroomId]
    );
    return rows;
  }

  async patchAssessment(id, fields) {
    // For the stopgap: update the step_data JSONB
    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE activity_sessions
       SET step_data = step_data || $1::jsonb, updated_at = now()
       WHERE id = $2 RETURNING *`,
      [JSON.stringify(fields), id]
    );
    return rows[0];
  }

  // ── Full state (legacy /api/state — not supported in PgStore) ───────────

  async getFullState() {
    // Return a minimal structure so the frontend doesn't break
    // while the JSON store is being phased out.
    throw new Error(
      '/api/state is not supported in PgStore. ' +
      'Use individual endpoints instead.'
    );
  }
}
