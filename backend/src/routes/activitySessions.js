/**
 * activitySessions.js
 * POST /api/activity-sessions
 *
 * Rules (from requirements):
 *  1. Consent gate: 403 with structured reason if learner.consent !== true.
 *  2. Idempotent on client-generated id: 200 + { duplicate: true } if seen before.
 *  3. step_data validated and stripped to per-activity allowlist (no names).
 *  4. On 201: observation_items rows inserted from activity_skill_map.
 *  5. On 201: audit_log row written.
 *  6. completedAt → completed_at; created_at is server-set.
 */

import { getStore } from '../store/index.js';
import { validateAndCleanStepData, deriveObservationResult } from '../store/schema.js';
import { getPool } from '../store/pool.js';
import crypto from 'node:crypto';

// ── Helpers ───────────────────────────────────────────────────────────────

function isUUID(s) {
  return typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function writeAuditLog(userId, action, entity, entityId) {
  // Best-effort; non-fatal
  try {
    if (process.env.USE_JSON_STORE?.toLowerCase() !== 'true') {
      getPool().query(
        `INSERT INTO audit_log (user_id, action, entity, entity_id)
         VALUES ($1,$2,$3,$4)`,
        [userId ?? null, action, entity, String(entityId)]
      ).catch(() => {});
    }
  } catch { /* ignore */ }
}

// ── Skill map lookup (PgStore only) ──────────────────────────────────────

async function getSkillMap(activityId) {
  if (process.env.USE_JSON_STORE?.toLowerCase() === 'true') return [];
  try {
    const { rows } = await getPool().query(
      `SELECT * FROM activity_skill_map WHERE activity_id = $1`,
      [activityId]
    );
    return rows;
  } catch {
    return [];
  }
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function handlePostActivitySession(req, res) {
  try {
    const body = req.body ?? {};
    const store = getStore();

    // ── 1. Basic validation ─────────────────────────────────────────────
    const { id, learnerId, activityId, subject, term, academicYear } = body;

    if (!id || !isUUID(id)) {
      return res.status(400).json({
        ok: false, reason: 'validation_failed',
        details: ['id must be a client-generated UUID'],
      });
    }
    if (!learnerId) {
      return res.status(400).json({ ok: false, reason: 'validation_failed', details: ['learnerId is required'] });
    }
    if (!activityId) {
      return res.status(400).json({ ok: false, reason: 'validation_failed', details: ['activityId is required'] });
    }
    if (!subject || !['English', 'Mathematics'].includes(subject)) {
      return res.status(400).json({ ok: false, reason: 'validation_failed', details: ['subject must be English or Mathematics'] });
    }
    if (!term || ![1,2,3,4].includes(Number(term))) {
      return res.status(400).json({ ok: false, reason: 'validation_failed', details: ['term must be 1–4'] });
    }
    if (!academicYear || isNaN(Number(academicYear))) {
      return res.status(400).json({ ok: false, reason: 'validation_failed', details: ['academicYear is required'] });
    }

    // ── 2. Consent gate ─────────────────────────────────────────────────
    const consent = await store.getConsent(learnerId, 'analysis');
    if (!consent.granted) {
      return res.status(403).json({
        ok:        false,
        reason:    'consent_required',
        learnerId,
        message:   "Parent consent for analysis is not recorded for this learner. No data will be saved.",
      });
    }

    // ── 3. Validate and clean step_data ─────────────────────────────────
    const rawStepData = body.stepData ?? body.step_data ?? null;
    let cleanedStepData = null;

    if (rawStepData) {
      const { ok, cleaned, stripped, error } = validateAndCleanStepData(activityId, rawStepData);
      if (!ok) {
        return res.status(400).json({
          ok: false, reason: 'validation_failed',
          details: [error ?? 'step_data validation failed'],
        });
      }
      cleanedStepData = cleaned;
      if (stripped.length > 0) {
        // Log stripped fields but don't fail — be permissive with extra keys
        console.info(`[activity-sessions] Stripped fields from ${activityId} step_data: ${stripped.join(', ')}`);
      }
    }

    // ── 4. Upsert session ────────────────────────────────────────────────
    const session = {
      id,
      learnerId,
      activityId,
      subject,
      term:            Number(term),
      academicYear:    Number(academicYear),
      score:           body.score      ?? null,
      maxScore:        body.maxScore   ?? null,
      hintsUsed:       body.hintsUsed  ?? 0,
      attempts:        body.attempts   ?? 1,
      stepData:        cleanedStepData,
      completedAt:     body.completedAt ?? null,
      clientUpdatedAt: body.clientUpdatedAt ?? null,
    };

    const { session: saved, duplicate } = await store.upsertActivitySession(session);

    if (duplicate) {
      return res.status(200).json({ ok: true, session: saved, duplicate: true });
    }

    // ── 5. Create observation_items from skill map (201 only) ────────────
    const skillMap = await getSkillMap(activityId);
    if (skillMap.length > 0 && cleanedStepData) {
      const result = deriveObservationResult(activityId, cleanedStepData);
      const obsItems = skillMap.map(sm => ({
        learnerId,
        subject:  sm.subject,
        skill:    sm.skill,
        capsRef:  sm.caps_ref,
        item:     sm.item,
        result,
        strategy: sm.strategy,
        source:   'activity',
      }));
      await store.createObservationItems(obsItems);
    }

    // ── 6. Audit log ────────────────────────────────────────────────────
    writeAuditLog(
      req.user?.id ?? null,
      'create',
      'activity_sessions',
      saved.id
    );

    return res.status(201).json({ ok: true, session: saved, duplicate: false });

  } catch (err) {
    console.error('[activity-sessions] Error:', err.message);
    return res.status(400).json({ ok: false, error: err.message });
  }
}
