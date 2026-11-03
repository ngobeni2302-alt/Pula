/**
 * schema.js
 * Per-activity step_data field allowlists and validators.
 *
 * Rules:
 *  - Only fields on the allowlist are kept; all others are stripped silently.
 *  - No field may contain a string that looks like a person's name.
 *    (Names are removed at the controller level; this is the final check.)
 *  - 'hasAudio' is not on any allowlist — it is removed until audio exists.
 *  - 'recommendedTier' is not on any allowlist — tier changes are server-only.
 *  - For make-a-ten: only clean computed counts are stored, never raw React state
 *    (i.e. 'frameCounters' is not allowed).
 */

// ── Allowlists ────────────────────────────────────────────────────────────

export const STEP_DATA_ALLOWLISTS = {
  'talk-and-turn': [
    'selectedPrompts', 'correct', 'total', 'attempts',
  ],
  'sound-hunt': [
    'correct', 'total', 'attempts',
  ],
  'sound-sorter': [
    'rounds', 'correct', 'total',
    // rounds[] items: { roundId, chosen, isCorrect } — validated below
  ],
  'blend-a-word': [
    'correct', 'total', 'blendAttempts', 'attempts',
  ],
  'add-numbers': [
    'finalAnswer', 'isCorrect', 'hintsUsed', 'correct', 'total',
  ],
  'bead-string': [
    'slidCount', 'isCorrect', 'correct', 'total',
  ],
  'make-a-ten': [
    // Clean counts only — 'frameCounters' is NOT here
    'placedInFrame', 'remainingInTray', 'isCorrect', 'correct', 'total',
  ],
  'group-of-5': [
    'countedTotal', 'isCorrect', 'correct', 'total',
  ],
};

// Fields that must never appear in step_data regardless of allowlist
const FORBIDDEN_FIELDS = [
  'frameCounters',   // raw React state from make-a-ten
  'hasAudio',        // removed until audio feature exists
  'recommendedTier', // tier changes are server-only
  'learnerName',
  'firstName',
  'lastName',
  'name',
  'parentContact',
  'phone',
];

// ── Scrub ─────────────────────────────────────────────────────────────────

/**
 * Strip step_data to the allowlist for the given activity.
 * Also removes any forbidden fields.
 * Returns { ok, cleaned, stripped } where stripped lists removed keys.
 *
 * @param {string} activityId
 * @param {object} stepData
 * @returns {{ ok: boolean, cleaned: object, stripped: string[], error?: string }}
 */
export function validateAndCleanStepData(activityId, stepData) {
  const allowlist = STEP_DATA_ALLOWLISTS[activityId];

  if (!allowlist) {
    return { ok: false, cleaned: {}, stripped: [], error: `Unknown activity_id: ${activityId}` };
  }

  if (!stepData || typeof stepData !== 'object' || Array.isArray(stepData)) {
    return { ok: true, cleaned: {}, stripped: [] };
  }

  const cleaned  = {};
  const stripped = [];

  for (const [key, value] of Object.entries(stepData)) {
    if (FORBIDDEN_FIELDS.includes(key)) {
      stripped.push(key);
      continue;
    }
    if (!allowlist.includes(key)) {
      stripped.push(key);
      continue;
    }
    cleaned[key] = value;
  }

  // Validate sound-sorter rounds array shape
  if (activityId === 'sound-sorter' && cleaned.rounds) {
    if (!Array.isArray(cleaned.rounds)) {
      return { ok: false, cleaned, stripped, error: 'rounds must be an array' };
    }
    cleaned.rounds = cleaned.rounds.map(r => ({
      roundId:   r.roundId,
      chosen:    r.chosen,
      isCorrect: r.isCorrect,
    }));
  }

  // Validate selectedPrompts is an array of strings (talk-and-turn)
  if (activityId === 'talk-and-turn' && cleaned.selectedPrompts) {
    if (!Array.isArray(cleaned.selectedPrompts)) {
      return { ok: false, cleaned, stripped, error: 'selectedPrompts must be an array' };
    }
    // Each prompt must be a string — no objects with learner names
    if (cleaned.selectedPrompts.some(p => typeof p !== 'string')) {
      return { ok: false, cleaned, stripped, error: 'selectedPrompts must be strings only' };
    }
  }

  return { ok: true, cleaned, stripped };
}

/**
 * Compute observation result from step_data for a given activity.
 * Returns 'on_own' | 'with_help' | 'not_yet'.
 *
 * @param {string} activityId
 * @param {object} stepData — already cleaned
 * @returns {'on_own'|'with_help'|'not_yet'}
 */
export function deriveObservationResult(activityId, stepData) {
  const correct  = stepData.correct  ?? 0;
  const total    = stepData.total    ?? 1;
  const hints    = stepData.hintsUsed ?? 0;
  const attempts = stepData.attempts  ?? stepData.blendAttempts ?? 1;
  const accuracy = total > 0 ? correct / total : 0;

  if (accuracy >= 0.8 && hints === 0 && attempts <= 2) return 'on_own';
  if (accuracy >= 0.5 || hints > 0)                    return 'with_help';
  return 'not_yet';
}
