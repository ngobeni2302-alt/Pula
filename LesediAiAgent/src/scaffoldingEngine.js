/**
 * scaffoldingEngine.js
 * Adaptive hint ladder for Lesedi child learning activities.
 *
 * SCAFFOLDING LEVELS
 *   0 — Independent attempt (no hint — child tries on their own)
 *   1 — Gentle prompt (draw attention to what the child already knows)
 *   2 — Guided hint (model a simpler version of the same problem)
 *   3 — Worked example with a DIFFERENT number/word, invite retry, offer teacher handoff
 *   F — Final stage: give the learner another opportunity to solve independently
 *
 * ADAPTIVE RULES
 *   - Start at level 0 (let the child try independently)
 *   - Escalate +1 if the child struggles (wrong answer or no response)
 *   - After level 3, offer final stage (F) — another independent attempt
 *   - If the child succeeds at any level, reset to 0 for the next round
 *   - If the child self-corrects (wrong then right), do NOT escalate
 *   - If the child has a history of struggling with this skill, start at level 1
 *   - Never skip levels (1 → 3 is not allowed; must go 1 → 2 → 3)
 *
 * HISTORY-AWARE RULES
 *   - If a child has needed hints on the same activity/skill 2+ times before,
 *     start at level 1 (don't make them fail first)
 *   - If a child has succeeded independently 3+ times in a row on a skill,
 *     stay at level 0 even if they make one mistake (benefit of the doubt)
 *   - Track hint level per session (rounds within one activity session)
 *   - Cross-session history is Phase 3 (Learning Analytics Engine)
 *
 * CHILD EXPERIENCE RULES
 *   - No visible performance scores
 *   - No countdown pressure
 *   - No negative or shaming language
 *   - Lesedi's response must be short and suitable for young children
 *   - Always warm and encouraging
 *   - Level 3 always ends with teacher handoff invitation (never a dead end)
 */

import { getActivityHint, getActivityDefinition, getHintEvent } from '../../shared/activityDefinitions.js';
import { resolveChildPhrase }    from './phraseBank.js';
import { resolveMathsChildPhrase } from './mathsBank.js';

// ---------------------------------------------------------------------------
// Scaffolding state — per session (in-memory, not persisted)
// Key: `${sessionId}:${roundIndex}`  →  { level, attempts, lastEvent, history }
// ---------------------------------------------------------------------------
const sessionStates = new Map();
const MAX_SESSION_STATES = 200;

// Cross-session skill history: `${learnerId}:${curriculumSkillId}` → { successStreak, hintCount }
const skillHistory = new Map();
const MAX_SKILL_HISTORY = 500;

function getStateKey(sessionId, roundIndex) {
  return `${sessionId}:${roundIndex}`;
}

function pruneStates() {
  if (sessionStates.size > MAX_SESSION_STATES) {
    const oldest = sessionStates.keys().next().value;
    sessionStates.delete(oldest);
  }
}

function getSkillKey(learnerId, curriculumSkillId) {
  return `${learnerId}:${curriculumSkillId}`;
}

function getSkillHistory(learnerId, curriculumSkillId) {
  const key = getSkillKey(learnerId, curriculumSkillId);
  return skillHistory.get(key) ?? { successStreak: 0, hintCount: 0, totalSessions: 0 };
}

function updateSkillHistory(learnerId, curriculumSkillId, { succeeded, hintsUsed }) {
  const key = getSkillKey(learnerId, curriculumSkillId);
  const hist = getSkillHistory(learnerId, curriculumSkillId);
  hist.totalSessions++;
  if (succeeded && hintsUsed === 0) {
    hist.successStreak++;
  } else {
    hist.successStreak = 0;
  }
  if (hintsUsed > 0) hist.hintCount++;
  skillHistory.set(key, hist);
  if (skillHistory.size > MAX_SKILL_HISTORY) {
    const oldest = skillHistory.keys().next().value;
    skillHistory.delete(oldest);
  }
}

// ---------------------------------------------------------------------------
// Core scaffolding logic
// ---------------------------------------------------------------------------

/**
 * Determine the starting hint level for a new round.
 * Uses skill history to decide whether to start at 0 or 1.
 *
 * @param {string} learnerId
 * @param {string} curriculumSkillId
 * @param {number} roundIndex — 0-based round number in the session
 * @returns {number} starting hint level (0 or 1)
 */
export function getStartingLevel(learnerId, curriculumSkillId, roundIndex) {
  // First round: check skill history
  if (roundIndex === 0) {
    const hist = getSkillHistory(learnerId, curriculumSkillId);
    // If child has needed hints 2+ times on this skill, start at level 1
    if (hist.hintCount >= 2) return 1;
  }
  return 0;
}

/**
 * Resolve a hint for the current round based on the observed event.
 *
 * This is the main entry point for real-time scaffolding during gameplay.
 *
 * @param {object} ctx
 *   ctx.sessionId          — unique session identifier
 *   ctx.roundIndex         — 0-based round number
 *   ctx.activityId         — e.g. 'number-hunt'
 *   ctx.learnerId          — learner identifier
 *   ctx.curriculumSkillId — from activity definition
 *   ctx.observedEvent      — what happened: 'correct', 'no_response', 'wrong_selection',
 *                            'stuck_on_word', 'says_separate_sounds', 'incomplete',
 *                            'wrong_blend', 'wrong_word'
 *   ctx.firstName          — child's first name
 *   ctx.subject            — 'English' | 'Mathematics'
 * @returns {{ text: string, hintLevel: number, handoff: boolean, source: string, praise: boolean }}
 */
export function resolveScaffold(ctx) {
  const {
    sessionId, roundIndex, activityId, learnerId,
    curriculumSkillId, observedEvent, firstName,
    subject = 'English',
  } = ctx;

  const def = getActivityDefinition(activityId);
  if (!def) {
    return {
      text:      `Good try, ${firstName ?? 'there'}. Let's keep going!`,
      hintLevel: 1,
      handoff:   false,
      source:     'scaffolding_fallback',
      praise:     false,
    };
  }

  // Get or create state for this round
  const stateKey = getStateKey(sessionId, roundIndex);
  let state = sessionStates.get(stateKey);
  if (!state) {
    const startLevel = getStartingLevel(learnerId, curriculumSkillId ?? def.curriculumSkillId, roundIndex);
    state = { level: startLevel, attempts: 0, lastEvent: null, history: [] };
    sessionStates.set(stateKey, state);
    pruneStates();
  }

  // ── CORRECT: praise and reset ──────────────────────────────────────────
  if (observedEvent === 'correct') {
    const hintLevel = 0; // reset for next round
    // Check if this was a self-correction (previous attempt was wrong)
    const selfCorrected = state.history.length > 0 && state.history[state.history.length - 1] !== 'correct';
    const text = getActivityHint(activityId, selfCorrected ? 'F' : 'correct'.length > 0 ? 'correct' : 'F', 'correct', firstName)
      ?? (subject === 'Mathematics'
        ? `You worked that out, ${firstName}! Can you show me another way?`
        : `You did it, ${firstName}! Can you think of another one?`);

    // Update skill history
    updateSkillHistory(learnerId, curriculumSkillId ?? def.curriculumSkillId, {
      succeeded: true,
      hintsUsed: state.level > 0 ? 1 : 0,
    });

    // Mark state as resolved (keep for summary, don't delete)
    state.resolved = true;
    state.level = 0;
    sessionStates.set(stateKey, state);

    return { text, hintLevel, handoff: false, source: 'activity_definition', praise: true };
  }

  // ── STRUGGLING: escalate hint level ────────────────────────────────────
  state.attempts++;
  state.history.push(observedEvent);
  state.lastEvent = observedEvent;

  // Determine next hint level
  // Rule: never skip levels. 0 → 1 → 2 → 3 → F
  let nextLevel = state.level;
  if (state.level === 0) nextLevel = 1;
  else if (state.level === 1) nextLevel = 2;
  else if (state.level === 2) nextLevel = 3;
  else if (state.level === 3) nextLevel = 'F'; // final stage — another independent attempt
  else if (state.level === 'F') nextLevel = 3; // if they fail the final stage too, go back to 3 (max support)

  state.level = nextLevel;
  sessionStates.set(stateKey, state);

  // ── Get hint text ──────────────────────────────────────────────────────
  // Try activity-specific hint first
  let text = getActivityHint(activityId, nextLevel, observedEvent, firstName);

  // Fall back to generic phrase bank
  if (!text) {
    const isMaths = subject === 'Mathematics' || def.subject === 'Mathematics';
    const bankEvent = getHintEvent(activityId, observedEvent) ?? 'default';

    if (nextLevel === 'F') {
      // Final stage: short encouragement for independent retry
      text = `Let's try once more, ${firstName}. You go first this time — I'm right here if you need me.`;
    } else if (isMaths) {
      const result = resolveMathsChildPhrase(Number(nextLevel) || 1, bankEvent, firstName);
      text = result.text;
    } else {
      const result = resolveChildPhrase(Number(nextLevel) || 1, bankEvent, firstName);
      text = result.text;
    }
  }

  const handoff = nextLevel === 3;

  // Update skill history for struggling (any hint level ≥ 1 means support was needed)
  if (Number(nextLevel) >= 1) {
    updateSkillHistory(learnerId, curriculumSkillId ?? def.curriculumSkillId, {
      succeeded: false,
      hintsUsed: 1,
    });
  }

  return { text, hintLevel: nextLevel, handoff, source: 'activity_definition', praise: false };
}

/**
 * Get the current hint level for a session/round without resolving a new hint.
 * Useful for the frontend to know what level the child is on.
 *
 * @param {string} sessionId
 * @param {number} roundIndex
 * @returns {number|string} current hint level (0, 1, 2, 3, or 'F')
 */
export function getCurrentLevel(sessionId, roundIndex) {
  const state = sessionStates.get(getStateKey(sessionId, roundIndex));
  return state?.level ?? 0;
}

/**
 * Clear scaffolding state for a session (called when session ends).
 * Does NOT clear skill history (that persists across sessions for adaptive behaviour).
 *
 * @param {string} sessionId
 */
export function clearSession(sessionId) {
  for (const key of sessionStates.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      sessionStates.delete(key);
    }
  }
}

/**
 * Get a summary of the scaffolding history for a session.
 * Used by the teacher copilot (Phase 3) to understand how much support the child needed.
 *
 * @param {string} sessionId
 * @returns {{ rounds: number, maxLevelReached: number, totalHints: number, selfCorrections: number }}
 */
export function getSessionSummary(sessionId) {
  let rounds = 0, maxLevel = 0, totalHints = 0, selfCorrections = 0;

  for (const [key, state] of sessionStates.entries()) {
    if (!key.startsWith(`${sessionId}:`)) continue;
    rounds++;
    const level = typeof state.level === 'number' ? state.level : 3;
    if (level > maxLevel) maxLevel = level;
    totalHints += state.attempts;
    // Self-correction: wrong answer followed by correct within the same round
    for (let i = 1; i < state.history.length; i++) {
      if (state.history[i] === 'correct' && state.history[i - 1] !== 'correct') {
        selfCorrections++;
      }
    }
  }

  return { rounds, maxLevelReached: maxLevel, totalHints, selfCorrections };
}

/**
 * Reset all in-memory state (for testing).
 */
export function _resetForTesting() {
  sessionStates.clear();
  skillHistory.clear();
}
