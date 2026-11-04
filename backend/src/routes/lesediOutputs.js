/**
 * lesediOutputs.js
 * Routes for managing Lesedi AI output drafts.
 *
 * PATCH /api/lesedi/outputs/:id/approve
 *   Teacher approves or rejects an AI draft.
 *   - Sets status to 'approved' or 'rejected'.
 *   - Records approved_by (user id from req.user, falling back to demo teacher UUID).
 *   - Sets teacher_edited: true if the payload includes edited output text.
 *   - For parent_note outputs: if approved, writes the text to parent_notes as status='to_review'
 *     so it appears in the teacher's notes queue for final send.
 *   - For gap_explanation outputs: if approved AND a tier suggestion is present in the output JSONB,
 *     writes a tier_history row (subject + tier). The teacher still manually confirms.
 *
 * GET /api/lesedi/outputs
 *   List all Lesedi outputs for a classroom (filtered by classroomId query param).
 */

import { getStore }   from '../store/index.js';
import { getPool }    from '../store/pool.js';
import crypto         from 'node:crypto';

const DEMO_TEACHER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_HOD_ID     = '00000000-0000-0000-0000-000000000002';

function isUUID(s) {
  return typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// ---------------------------------------------------------------------------
// PATCH /api/lesedi/outputs/:id/approve
// ---------------------------------------------------------------------------
export async function handleApproveOutput(req, res) {
  try {
    const { id }          = req.params;
    const { action, editedText, editedOutput } = req.body ?? {};

    if (!isUUID(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid output id — must be a UUID.' });
    }
    if (!action || !['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ ok: false, error: 'body.action must be "approved" or "rejected".' });
    }

    const approverId = req.user?.id ?? DEMO_TEACHER_ID;
    const store      = getStore();

    // Build the patch fields
    const fields = {
      status:         action,
      approved_by:    approverId,
      approved_at:    new Date().toISOString(),
      teacher_edited: !!(editedText || editedOutput),
    };

    const updated = await store.patchLesediOutput(id, fields);
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Lesedi output not found.' });
    }

    // ── Side effects on approval only ────────────────────────────────────

    if (action === 'approved') {
      // 1. parent_note → create a parent_notes draft so the teacher can send it
      if (updated.task === 'parent_note' && updated.learner_id) {
        const text = editedText ?? updated.output?.text ?? JSON.stringify(updated.output);
        await store.createNote({
          id:         crypto.randomUUID(),
          learnerId:  updated.learner_id,
          text,
          status:     'to_review',
          createdBy:  approverId,
          approvedBy: approverId,
        });
      }

      // 2. gap_explanation with a tier suggestion → write tier_history
      //    The teacher must still manually confirm any tier move in the UI —
      //    this just records the AI's suggestion as an evidence row, not a final change.
      if (
        updated.task === 'gap_explanation' &&
        updated.learner_id &&
        updated.output?.suggestedTier
      ) {
        const subject = updated.subject === 'Mathematics' ? 'Mathematics' : 'English';
        await store.addTierHistory({
          learnerId:  updated.learner_id,
          subject,
          tier:       updated.output.suggestedTier,
          changedBy:  approverId,
          reason:     'Lesedi gap analysis suggestion — teacher review required',
        });
      }

      // 3. Audit log (PgStore only, best-effort)
      try {
        if (process.env.USE_JSON_STORE?.toLowerCase() !== 'true') {
          getPool().query(
            `INSERT INTO audit_log (user_id, action, entity, entity_id)
             VALUES ($1, 'approve_lesedi_output', 'lesedi_outputs', $2)`,
            [approverId, id]
          ).catch(() => {});
        }
      } catch { /* non-fatal */ }
    }

    return res.json({ ok: true, output: updated });

  } catch (err) {
    console.error('[lesedi-outputs] Approve error:', err.message);
    return res.status(400).json({ ok: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// GET /api/lesedi/outputs
// Returns all outputs for a classroom, optionally filtered by status or task.
// ---------------------------------------------------------------------------
export async function handleListOutputs(req, res) {
  try {
    const { classroomId, status, task, learnerId } = req.query;
    const useJson = (process.env.USE_JSON_STORE ?? 'true').toLowerCase() === 'true';

    if (useJson) {
      // JSON mode — filter from in-memory store
      const store = getStore();
      const db    = store.getFullState?.() ?? {};
      let outputs = db.lesediOutputs ?? [];
      if (classroomId) outputs = outputs.filter(o => o.classroomId === classroomId || o.classroom_id === classroomId);
      if (learnerId)   outputs = outputs.filter(o => o.learnerId   === learnerId   || o.learner_id   === learnerId);
      if (status)      outputs = outputs.filter(o => o.status === status);
      if (task)        outputs = outputs.filter(o => o.task   === task);
      return res.json({ ok: true, outputs });
    }

    // PgStore mode — query directly
    const pool   = getPool();
    const wheres = ['1=1'];
    const vals   = [];
    let   i      = 1;
    if (classroomId) { wheres.push(`classroom_id = $${i++}`); vals.push(classroomId); }
    if (learnerId)   { wheres.push(`learner_id   = $${i++}`); vals.push(learnerId);   }
    if (status)      { wheres.push(`status       = $${i++}`); vals.push(status);      }
    if (task)        { wheres.push(`task         = $${i++}`); vals.push(task);        }

    const { rows } = await pool.query(
      `SELECT * FROM lesedi_outputs WHERE ${wheres.join(' AND ')} ORDER BY created_at DESC`,
      vals
    );
    return res.json({ ok: true, outputs: rows });

  } catch (err) {
    console.error('[lesedi-outputs] List error:', err.message);
    return res.status(400).json({ ok: false, error: err.message });
  }
}
