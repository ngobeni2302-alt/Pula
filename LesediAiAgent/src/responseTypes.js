/**
 * responseTypes.js
 * Shared response type contracts for all Lesedi AI outputs.
 *
 * Every Lesedi task returns a response object that conforms to one of the
 * types defined here. The engine.js `runLesedi()` function and the
 * `POST /api/lesedi` endpoint both use these contracts.
 *
 * CONSUMER CONTRACT — the frontend expects these fields:
 *   - text:           string  — the main output text (always present)
 *   - source:         string  — where the response came from
 *   - requiresApproval: bool  — whether teacher/HOD must approve before use
 *   - tags:           string[] — searchable metadata tags
 *   - handoff:        bool    — whether to hand off to teacher (hint L3)
 *   - teacherFlag:    string?  — optional teacher dashboard flag
 *   - parentTip:      string?  — optional parent tip draft
 *   - confidence:     string?  — low | medium | medium-high | high
 *   - lesediOutputId: string?  — UUID of the persisted lesedi_outputs row
 *   - capsRef:        string?  — CAPS page reference for the response
 *   - policySource:   string?  — POPIA | CAPS | PROJECT | PEDAGOGY (guardrails)
 */

// ---------------------------------------------------------------------------
// Source types — where a Lesedi response comes from
// ---------------------------------------------------------------------------
export const SOURCES = {
  PHRASE_BANK:    'phrase_bank',     // Literacy offline fixed phrases (no AI)
  MATHS_BANK:     'maths_bank',      // Maths offline fixed phrases (no AI)
  AI_MODEL:       'ai_model',        // Real AI model call (Azure/Databricks)
  GUARDRAIL:      'guardrail',       // Policy refusal or redirect
  ENGINE_ERROR:   'engine_error',    // Unknown task or internal error
  CLIENT_FALLBACK:'client_fallback', // Frontend client-side fallback (no server)
};

// ---------------------------------------------------------------------------
// Confidence levels — used in gap_explanation and hod_insight
// ---------------------------------------------------------------------------
export const CONFIDENCE_LEVELS = ['low', 'medium', 'medium-high', 'high'];

// ---------------------------------------------------------------------------
// Task types — all 8 supported by the engine
// ---------------------------------------------------------------------------
export const TASKS = [
  'child_hint',        // Hint ladder levels 1–3 (offline phrase bank)
  'child_tutor',       // 1-to-1 session (phrase bank + AI fallback)
  'teacher_activity',  // CAPS-aligned activity draft
  'class_insight',     // Class-level pattern analysis
  'gap_explanation',   // Evidence-based tier explanation
  'hod_insight',       // HOD health check and stagnation alerts
  'parent_note',       // WhatsApp / SMS draft for teacher approval
  'guardrail',         // Policy refusal explanation
];

// ---------------------------------------------------------------------------
// Tasks that require teacher and/or HOD approval before use
// ---------------------------------------------------------------------------
export const APPROVAL_REQUIRED = new Set([
  'teacher_activity',
  'parent_note',
  'hod_insight',
]);

// ---------------------------------------------------------------------------
// Tasks that require learner consent (POPIA) before processing
// ---------------------------------------------------------------------------
export const CONSENT_GATED = new Set([
  'child_hint',
  'child_tutor',
  'gap_explanation',
  'parent_note',
  'class_insight',
]);

// ---------------------------------------------------------------------------
// Observation result levels — used in activity_sessions and observation_items
// ---------------------------------------------------------------------------
export const OBSERVATION_LEVELS = [
  'DEMONSTRATED',            // Child completed independently
  'DEVELOPING',              // Child completed with hints or support
  'NEEDS_FURTHER_PRACTICE',  // Child attempted but did not complete
  'INSUFFICIENT_EVIDENCE',   // No valid evidence captured
  'TEACHER_REVIEW_REQUIRED', // Anomaly or unexpected result
];

// ---------------------------------------------------------------------------
// Lesedi output statuses — used in the lesedi_outputs table
// ---------------------------------------------------------------------------
export const OUTPUT_STATUSES = [
  'draft',     // AI-generated, pending teacher review
  'approved',  // Teacher approved
  'rejected',  // Teacher rejected
];

// ---------------------------------------------------------------------------
// Response shape validators — lightweight runtime checks
// ---------------------------------------------------------------------------

/**
 * Validate that a response object has the minimum required fields.
 * @param {object} res
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateResponse(res) {
  const required = ['text', 'source'];
  const missing  = required.filter(k => res?.[k] == null);
  return { valid: missing.length === 0, missing };
}

/**
 * Normalise a response so the frontend always gets consistent fields.
 * Fills in defaults for optional fields.
 * @param {object} res
 * @returns {object}
 */
export function normaliseResponse(res) {
  return {
    text:             res.text           ?? '',
    source:           res.source         ?? SOURCES.ENGINE_ERROR,
    requiresApproval: res.requiresApproval ?? APPROVAL_REQUIRED.has(res.task),
    tags:             res.tags           ?? [],
    handoff:          res.handoff        ?? false,
    teacherFlag:      res.teacherFlag    ?? null,
    parentTip:        res.parentTip      ?? null,
    confidence:       res.confidence     ?? null,
    lesediOutputId:   res.lesediOutputId ?? null,
    capsRef:          res.capsRef        ?? null,
    policySource:     res.policySource   ?? null,
  };
}

/**
 * Build a standard error response.
 * @param {string} message
 * @returns {object}
 */
export function errorResponse(message) {
  return {
    text:             message,
    source:           SOURCES.ENGINE_ERROR,
    requiresApproval: false,
    tags:             ['error'],
    handoff:          false,
  };
}
