/**
 * evaluationEngine.js
 * Maps activity evidence to the 5 internal observation levels.
 *
 * OBSERVATION LEVELS (internal evidence descriptions, not official DBE codes):
 *   DEMONSTRATED             — Child completed independently
 *   DEVELOPING               — Child completed with hints or support
 *   NEEDS_FURTHER_PRACTICE   — Child attempted but did not complete
 *   INSUFFICIENT_EVIDENCE    — No valid evidence captured
 *   TEACHER_REVIEW_REQUIRED  — Anomaly or unexpected result
 *
 * These are internal evidence descriptions used by the Learning Analytics Engine
 * (Phase 3) and the Teacher Copilot (Phase 3). They are NOT official DBE
 * achievement codes and must never be presented as such.
 *
 * DETERMINISTIC SCORING:
 *   - Objective scores (correct/total) are calculated deterministically
 *   - AI is used only for interpretation and recommendations, never for inventing scores
 *   - Response time alone is never used as a measure of ability
 *   - Where evidence is insufficient, we say so explicitly
 */

import { OBSERVATION_LEVELS } from '../../shared/activityDefinitions.js';

// ---------------------------------------------------------------------------
// Thresholds for objective activities (score-based)
// ---------------------------------------------------------------------------
const SCORE_THRESHOLDS = {
  DEMONSTRATED:            67,  // ≥ 67% correct on first attempts
  DEVELOPING:              34,  // 34–66% correct
  // Below 34% → NEEDS_FURTHER_PRACTICE
};

// ---------------------------------------------------------------------------
// Hint thresholds (how much support the child needed)
// ---------------------------------------------------------------------------
const HINT_THRESHOLDS = {
  // DEMONSTRATED requires no hints at all (maxLevel 0)
  // DEVELOPING allows up to level 3 hints
  MAX_LEVEL_FOR_DEMONSTRATED: 0,  // Level 0 only (no hints) → DEMONSTRATED
  MAX_LEVEL_FOR_DEVELOPING:   3,  // Level 1–3 → DEVELOPING at best
};

// ---------------------------------------------------------------------------
// Core evaluation function
// ---------------------------------------------------------------------------

/**
 * Evaluate a completed activity session and determine the observation level
 * for the skill assessed.
 *
 * @param {object} ctx
 *   ctx.activityId         — e.g. 'number-hunt'
 *   ctx.score              — percentage (0-100) or null for participation activities
 *   ctx.total              — total scored rounds
 *   ctx.correct            — correct first choices
 *   ctx.transcriptAvailable — whether speech transcript was captured
 *   ctx.recordingCaptured  — whether audio recording was captured
 *   ctx.sessionSummary     — from scaffoldingEngine.getSessionSummary()
 *                             { rounds, maxLevelReached, totalHints, selfCorrections }
 * @returns {{ level: string, reason: string, evidence: object, confidence: string }}
 */
export function evaluateObservation(ctx) {
  const {
    activityId,
    score = null,
    total = 0,
    correct = 0,
    transcriptAvailable = false,
    recordingCaptured = false,
    sessionSummary = null,
  } = ctx;

  const maxLevel = sessionSummary?.maxLevelReached ?? 0;
  const totalHints = sessionSummary?.totalHints ?? 0;
  const selfCorrections = sessionSummary?.selfCorrections ?? 0;

  // ── INSUFFICIENT_EVIDENCE: no valid evidence ────────────────────────────
  // Participation activities with no speech transcript AND no scored rounds
  if (score === null && !transcriptAvailable && total === 0) {
    return {
      level: OBSERVATION_LEVELS.INSUFFICIENT_EVIDENCE,
      reason: 'No validated evidence was captured. The child participated but no scoreable data is available. Teacher should observe directly.',
      evidence: { activityId, score: null, transcriptAvailable: false, total: 0 },
      confidence: 'insufficient',
    };
  }

  // ── Participation activities (score === null) ───────────────────────────
  // Reading Time and Sound It Out — participation is the primary measure
  if (score === null) {
    // If speech transcript is available, we have some evidence but it's unverified
    if (transcriptAvailable) {
      return {
        level: OBSERVATION_LEVELS.DEVELOPING,
        reason: `Child participated and speech was captured (${totalHints} hints used). Browser transcript is unverified — teacher review required before drawing conclusions.`,
        evidence: { activityId, score: null, transcriptAvailable: true, totalHints, maxLevel, selfCorrections },
        confidence: 'low',
      };
    }
    // No transcript — participation only
    if (maxLevel <= 1 && totalHints === 0) {
      return {
        level: OBSERVATION_LEVELS.DEVELOPING,
        reason: 'Child participated independently. No hints were needed. No validated score is available from this activity type.',
        evidence: { activityId, score: null, totalHints: 0, maxLevel: 0 },
        confidence: 'low',
      };
    }
    return {
      level: OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE,
      reason: `Child needed ${totalHints} hints during the activity. Participation recorded but the child required significant support.`,
      evidence: { activityId, score: null, totalHints, maxLevel, selfCorrections },
      confidence: 'low',
    };
  }

  // ── Objective activities (score !== null) ───────────────────────────────
  // Number Hunt, Count and Pick, Rhyme Time

  // TEACHER_REVIEW_REQUIRED: anomaly detection
  // - Very fast completion with 100% might indicate guessing or pattern exploitation
  // - Inconsistent results (high variance between rounds) need review
  if (score === 100 && totalHints === 0 && total < 3) {
    return {
      level: OBSERVATION_LEVELS.TEACHER_REVIEW_REQUIRED,
      reason: `Child scored 100% on only ${total} round(s). This may not be enough evidence to conclude mastery. Teacher should observe with more rounds.`,
      evidence: { activityId, score, total, correct, totalHints },
      confidence: 'low',
    };
  }

  // DEMONSTRATED: high score + minimal hints
  if (score >= SCORE_THRESHOLDS.DEMONSTRATED && maxLevel <= HINT_THRESHOLDS.MAX_LEVEL_FOR_DEMONSTRATED) {
    return {
      level: OBSERVATION_LEVELS.DEMONSTRATED,
      reason: `Child answered ${correct} of ${total} correctly on first attempt (${score}%) with ${totalHints === 0 ? 'no' : 'minimal'} hints. Evidence suggests the skill is demonstrated.`,
      evidence: { activityId, score, total, correct, totalHints, maxLevel, selfCorrections },
      confidence: total >= 3 ? 'medium' : 'low',
    };
  }

  // DEVELOPING: moderate score OR high score with more hints
  if (score >= SCORE_THRESHOLDS.DEVELOPING || (score >= SCORE_THRESHOLDS.DEMONSTRATED && maxLevel <= HINT_THRESHOLDS.MAX_LEVEL_FOR_DEVELOPING)) {
    const hintNote = totalHints > 0 ? ` with ${totalHints} hints` : '';
    const selfCorrNote = selfCorrections > 0 ? ` and ${selfCorrections} self-correction${selfCorrections !== 1 ? 's' : ''}` : '';
    return {
      level: OBSERVATION_LEVELS.DEVELOPING,
      reason: `Child answered ${correct} of ${total} correctly (${score}%)${hintNote}${selfCorrNote}. The skill is developing — continue practice.`,
      evidence: { activityId, score, total, correct, totalHints, maxLevel, selfCorrections },
      confidence: total >= 3 ? 'medium' : 'low',
    };
  }

  // NEEDS_FURTHER_PRACTICE: low score
  if (total > 0) {
    return {
      level: OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE,
      reason: `Child answered ${correct} of ${total} correctly (${score}%)${totalHints > 0 ? ` with ${totalHints} hints` : ''}. Further practice is recommended. Teacher should check for specific misconceptions.`,
      evidence: { activityId, score, total, correct, totalHints, maxLevel, selfCorrections },
      confidence: total >= 3 ? 'medium' : 'low',
    };
  }

  // Fallback: insufficient evidence
  return {
    level: OBSERVATION_LEVELS.INSUFFICIENT_EVIDENCE,
    reason: 'No valid evidence was captured for evaluation.',
    evidence: { activityId, score: null, total: 0 },
    confidence: 'insufficient',
  };
}

// ---------------------------------------------------------------------------
// Multi-session pattern detection (for Phase 3 — Learning Analytics Engine)
// ---------------------------------------------------------------------------

/**
 * Evaluate a pattern across multiple sessions for the same skill.
 * Used by the Learning Analytics Engine to identify persistent gaps.
 *
 * @param {Array} observations — array of single-session evaluation results
 * @returns {{ pattern: string, sessions: number, trend: string, confidence: string }}
 */
export function evaluatePattern(observations) {
  if (!Array.isArray(observations) || observations.length === 0) {
    return { pattern: 'no_data', sessions: 0, trend: 'unknown', confidence: 'insufficient' };
  }

  const sessions = observations.length;
  const levels = observations.map(o => o.level);

  // Count each level
  const counts = {
    [OBSERVATION_LEVELS.DEMONSTRATED]: 0,
    [OBSERVATION_LEVELS.DEVELOPING]: 0,
    [OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE]: 0,
    [OBSERVATION_LEVELS.INSUFFICIENT_EVIDENCE]: 0,
    [OBSERVATION_LEVELS.TEACHER_REVIEW_REQUIRED]: 0,
  };
  for (const lvl of levels) {
    if (counts[lvl] !== undefined) counts[lvl]++;
  }

  // Repeated NEEDS_FURTHER_PRACTICE → persistent gap
  if (counts[OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE] >= 2) {
    return {
      pattern: 'persistent_gap',
      sessions,
      trend: 'stagnant',
      confidence: sessions >= 3 ? 'medium' : 'low',
    };
  }

  // Progression from NEEDS_FURTHER_PRACTICE → DEVELOPING → DEMONSTRATED
  const recent = levels.slice(-2);
  if (recent.length === 2) {
    const order = [
      OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE,
      OBSERVATION_LEVELS.DEVELOPING,
      OBSERVATION_LEVELS.DEMONSTRATED,
    ];
    const prevIdx = order.indexOf(recent[0]);
    const currIdx = order.indexOf(recent[1]);
    if (currIdx > prevIdx && currIdx >= 0 && prevIdx >= 0) {
      return { pattern: 'improving', sessions, trend: 'improving', confidence: 'medium' };
    }
    if (currIdx < prevIdx && currIdx >= 0 && prevIdx >= 0) {
      return { pattern: 'regressing', sessions, trend: 'regressing', confidence: sessions >= 3 ? 'medium' : 'low' };
    }
  }

  // Consistent DEMONSTRATED
  if (counts[OBSERVATION_LEVELS.DEMONSTRATED] === sessions && sessions >= 2) {
    return { pattern: 'mastered', sessions, trend: 'stable', confidence: 'medium' };
  }

  // Insufficient evidence
  if (counts[OBSERVATION_LEVELS.INSUFFICIENT_EVIDENCE] >= sessions / 2) {
    return { pattern: 'insufficient_data', sessions, trend: 'unknown', confidence: 'insufficient' };
  }

  return { pattern: 'mixed', sessions, trend: 'fluctuating', confidence: 'low' };
}
