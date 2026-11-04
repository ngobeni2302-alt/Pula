import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { ACTIVITY_DEFINITIONS, getActivityDefinition, getActivitiesBySubject,
         getActivitiesByGrade, isActivityApplicable, getActivityHint,
         EVIDENCE_TYPES, OBSERVATION_LEVELS } from '../../shared/activityDefinitions.js';
import { evaluateEvidence, classifyEvidence } from '../../shared/activityEvidence.js';
import { ACTIVITIES, serverRounds } from '../../shared/activityCatalog.js';
import { resolveScaffold, getCurrentLevel, clearSession, getSessionSummary,
         getStartingLevel, _resetForTesting } from '../../LesediAiAgent/src/scaffoldingEngine.js';
import { evaluateObservation, evaluatePattern } from '../../LesediAiAgent/src/evaluationEngine.js';

const FIVE = ['reading-time','number-hunt','count-and-pick','rhyme-time','sound-it-out'];

// ── Activity Definitions ──────────────────────────────────────────────────

test('all five activities have complete definitions', () => {
  for (const id of FIVE) {
    const def = getActivityDefinition(id);
    assert.ok(def, `Missing definition for ${id}`);
    assert.ok(def.name, `${id}: missing name`);
    assert.ok(def.subject, `${id}: missing subject`);
    assert.ok(def.grades.length > 0, `${id}: missing grades`);
    assert.ok(def.learningObjective, `${id}: missing learningObjective`);
    assert.ok(def.capsRef, `${id}: missing capsRef`);
    assert.ok(def.curriculumSkillId, `${id}: missing curriculumSkillId`);
    assert.ok(def.evaluationMethod, `${id}: missing evaluationMethod`);
    assert.ok(def.evidenceTypes.length > 0, `${id}: missing evidenceTypes`);
    assert.ok(def.misconceptions.length > 0, `${id}: missing misconceptions`);
    assert.ok(def.hintEvents, `${id}: missing hintEvents`);
    assert.ok(def.hintOverrides, `${id}: missing hintOverrides`);
    assert.ok(def.successCriteria.length > 0, `${id}: missing successCriteria`);
    assert.ok(def.evidenceToRecord.length > 0, `${id}: missing evidenceToRecord`);
  }
});

test('subject filtering returns correct activities', () => {
  const english = getActivitiesBySubject('English');
  const maths = getActivitiesBySubject('Mathematics');
  assert.deepEqual([...english].sort(), ['reading-time','rhyme-time','sound-it-out'].sort());
  assert.deepEqual([...maths].sort(), ['count-and-pick','number-hunt'].sort());
});

test('grade R activities are age-appropriate', () => {
  const gradeR = getActivitiesByGrade('R');
  assert.ok(gradeR.includes('reading-time'));
  assert.ok(gradeR.includes('number-hunt'));
  assert.ok(gradeR.includes('count-and-pick'));
  assert.ok(gradeR.includes('rhyme-time'));
  assert.ok(gradeR.includes('sound-it-out'));
});

test('isActivityApplicable checks both grade and subject', () => {
  assert.ok(isActivityApplicable('number-hunt', '1', 'Mathematics'));
  assert.ok(!isActivityApplicable('number-hunt', '1', 'English'));
  assert.ok(isActivityApplicable('rhyme-time', 'R', 'English'));
  assert.ok(!isActivityApplicable('rhyme-time', 'R', 'Mathematics'));
});

// ── Activity-Specific Hints ───────────────────────────────────────────────

test('activity-specific hints escalate from level 1 to 3', () => {
  for (const id of FIVE) {
    const h1 = getActivityHint(id, 1, 'no_response', 'Thando');
    const h2 = getActivityHint(id, 2, 'no_response', 'Thando');
    const h3 = getActivityHint(id, 3, 'no_response', 'Thando');
    assert.ok(h1, `${id}: level 1 hint missing`);
    assert.ok(h2, `${id}: level 2 hint missing`);
    assert.ok(h3, `${id}: level 3 hint missing`);
    // Level 3 must include teacher handoff language
    assert.match(h3, /teacher/i, `${id}: level 3 must mention teacher handoff`);
    // Level 3 must use a DIFFERENT example (worked example, not the answer)
    // The hint should contain "watch" or "let me show" or "let me try"
    assert.match(h3, /watch|let me|let's try|listen/i, `${id}: level 3 must demonstrate with an example`);
  }
});

test('praise phrases are warm and encouraging', () => {
  for (const id of FIVE) {
    const praise = getActivityHint(id, 1, 'correct', 'Thando');
    assert.ok(praise, `${id}: praise missing`);
    assert.ok(!/wrong|incorrect|fail|bad/i.test(praise), `${id}: praise must not contain negative language`);
  }
});

test('final stage invites independent retry', () => {
  for (const id of FIVE) {
    const final = getActivityHint(id, 'F', 'no_response', 'Thando');
    assert.ok(final, `${id}: final stage hint missing`);
    assert.match(final, /try once more|you go first|let's try/i, `${id}: final stage must invite independent retry`);
  }
});

// ── Scaffolding Engine ────────────────────────────────────────────────────

beforeEach(() => _resetForTesting());

test('scaffolding starts at level 0 for first-time learners', () => {
  const level = getStartingLevel('learner-1', 'MATHS-NUMBER-RECOGNITION', 0);
  assert.equal(level, 0);
});

test('scaffolding escalates 0 → 1 → 2 → 3 → F on repeated struggles', () => {
  const sid = 'test-session-1';
  // First wrong attempt: level 0 → 1
  let r = resolveScaffold({ sessionId: sid, roundIndex: 0, activityId: 'number-hunt',
    learnerId: 'l1', observedEvent: 'wrong_selection', firstName: 'Thando', subject: 'Mathematics' });
  assert.equal(r.hintLevel, 1, 'Should escalate to level 1');

  // Second wrong: 1 → 2
  r = resolveScaffold({ sessionId: sid, roundIndex: 0, activityId: 'number-hunt',
    learnerId: 'l1', observedEvent: 'wrong_selection', firstName: 'Thando', subject: 'Mathematics' });
  assert.equal(r.hintLevel, 2, 'Should escalate to level 2');

  // Third wrong: 2 → 3
  r = resolveScaffold({ sessionId: sid, roundIndex: 0, activityId: 'number-hunt',
    learnerId: 'l1', observedEvent: 'wrong_selection', firstName: 'Thando', subject: 'Mathematics' });
  assert.equal(r.hintLevel, 3, 'Should escalate to level 3');
  assert.ok(r.handoff, 'Level 3 must signal teacher handoff');

  // Fourth wrong: 3 → F (final stage)
  r = resolveScaffold({ sessionId: sid, roundIndex: 0, activityId: 'number-hunt',
    learnerId: 'l1', observedEvent: 'wrong_selection', firstName: 'Thando', subject: 'Mathematics' });
  assert.equal(r.hintLevel, 'F', 'Should escalate to final stage');
});

test('correct answer resets hint level and returns praise', () => {
  const sid = 'test-session-2';
  // Escalate to level 2
  resolveScaffold({ sessionId: sid, roundIndex: 0, activityId: 'rhyme-time',
    learnerId: 'l2', observedEvent: 'wrong_selection', firstName: 'Sarah', subject: 'English' });
  resolveScaffold({ sessionId: sid, roundIndex: 0, activityId: 'rhyme-time',
    learnerId: 'l2', observedEvent: 'wrong_selection', firstName: 'Sarah', subject: 'English' });

  // Now correct → praise + reset
  const r = resolveScaffold({ sessionId: sid, roundIndex: 0, activityId: 'rhyme-time',
    learnerId: 'l2', observedEvent: 'correct', firstName: 'Sarah', subject: 'English' });
  assert.ok(r.praise, 'Correct should return praise');
  assert.equal(r.hintLevel, 0, 'Correct should reset to level 0');
});

test('history-aware starting level kicks in after 2+ hint sessions', () => {
  // Simulate 2 sessions where the learner needed hints
  const learner = 'learner-hist';
  const skill = 'MATHS-NUMBER-RECOGNITION';

  // Session 1: struggle → needs hints
  resolveScaffold({ sessionId: 's1', roundIndex: 0, activityId: 'number-hunt',
    learnerId: learner, curriculumSkillId: skill, observedEvent: 'wrong_selection', firstName: 'Bongi', subject: 'Mathematics' });

  // Session 2: struggle again
  resolveScaffold({ sessionId: 's2', roundIndex: 0, activityId: 'number-hunt',
    learnerId: learner, curriculumSkillId: skill, observedEvent: 'wrong_selection', firstName: 'Bongi', subject: 'Mathematics' });

  // Now session 3: should start at level 1 (not 0) because of history
  const startLevel = getStartingLevel(learner, skill, 0);
  assert.equal(startLevel, 1, 'Should start at level 1 after 2 hint sessions');
});

test('session summary tracks hints and self-corrections', () => {
  const sid = 'test-session-summary';
  // Round 0: wrong, wrong, correct (self-correction)
  resolveScaffold({ sessionId: sid, roundIndex: 0, activityId: 'count-and-pick',
    learnerId: 'l3', observedEvent: 'wrong_selection', firstName: 'Kabelo', subject: 'Mathematics' });
  resolveScaffold({ sessionId: sid, roundIndex: 0, activityId: 'count-and-pick',
    learnerId: 'l3', observedEvent: 'wrong_selection', firstName: 'Kabelo', subject: 'Mathematics' });
  resolveScaffold({ sessionId: sid, roundIndex: 0, activityId: 'count-and-pick',
    learnerId: 'l3', observedEvent: 'correct', firstName: 'Kabelo', subject: 'Mathematics' });

  // Round 1: wrong, wrong, wrong, wrong (max escalation)
  resolveScaffold({ sessionId: sid, roundIndex: 1, activityId: 'count-and-pick',
    learnerId: 'l3', observedEvent: 'wrong_selection', firstName: 'Kabelo', subject: 'Mathematics' });
  resolveScaffold({ sessionId: sid, roundIndex: 1, activityId: 'count-and-pick',
    learnerId: 'l3', observedEvent: 'wrong_selection', firstName: 'Kabelo', subject: 'Mathematics' });
  resolveScaffold({ sessionId: sid, roundIndex: 1, activityId: 'count-and-pick',
    learnerId: 'l3', observedEvent: 'wrong_selection', firstName: 'Kabelo', subject: 'Mathematics' });
  resolveScaffold({ sessionId: sid, roundIndex: 1, activityId: 'count-and-pick',
    learnerId: 'l3', observedEvent: 'wrong_selection', firstName: 'Kabelo', subject: 'Mathematics' });

  const summary = getSessionSummary(sid);
  assert.ok(summary.rounds >= 1, 'Should track rounds');
  assert.ok(summary.totalHints >= 5, 'Should track total hints');
  assert.ok(summary.maxLevelReached >= 3, 'Should track max level');
});

test('clearSession removes scaffolding state', () => {
  const sid = 'test-clear';
  resolveScaffold({ sessionId: sid, roundIndex: 0, activityId: 'sound-it-out',
    learnerId: 'l4', observedEvent: 'no_response', firstName: 'Lebo', subject: 'English' });
  assert.ok(getCurrentLevel(sid, 0) > 0, 'Should have state before clear');
  clearSession(sid);
  assert.equal(getCurrentLevel(sid, 0), 0, 'Should have no state after clear');
});

// ── Evidence Classification ────────────────────────────────────────────────

test('number-hunt classifies visual recognition and cognitive evidence', () => {
  const rounds = serverRounds('number-hunt', '2');
  const evidence = { rounds: rounds.map(r => ({ choices: [r.answer], letters: [] })),
    speech_transcript: '', time_taken_seconds: 12 };
  const result = evaluateEvidence({ activityId: 'number-hunt', grade: '2', voiceConsent: false }, evidence);
  assert.ok(result.evidenceClassification, 'Should have evidence classification');
  assert.ok(result.evidenceClassification.types.includes(EVIDENCE_TYPES.VISUAL_RECOGNITION));
  assert.ok(result.evidenceClassification.types.includes(EVIDENCE_TYPES.COGNITIVE));
});

test('reading-time classifies reading accuracy and fluency evidence', () => {
  const rounds = serverRounds('reading-time', '2');
  const evidence = { rounds: [{ choices: [], letters: [] }],
    speech_transcript: 'The sun is up. The cat sat on a mat.',
    speech_duration_seconds: 10, recording_captured: true, time_taken_seconds: 12 };
  const result = evaluateEvidence({ activityId: 'reading-time', grade: '2', voiceConsent: true }, evidence);
  const cls = result.evidenceClassification;
  assert.ok(cls.types.includes(EVIDENCE_TYPES.READING_ACCURACY));
  assert.ok(cls.types.includes(EVIDENCE_TYPES.READING_FLUENCY));
  // Should note that comprehension is not assessed
  assert.ok(cls.observations.some(o => o.type === EVIDENCE_TYPES.COMPREHENSION && o.confidence === 'insufficient'));
});

test('sound-it-out notes that tapping letters is not a validated phonics score', () => {
  const rounds = serverRounds('sound-it-out', '2');
  const evidence = { rounds: rounds.map(r => ({ choices: [], letters: [...r.target].map((_, i) => i) })),
    speech_transcript: '', time_taken_seconds: 15 };
  const result = evaluateEvidence({ activityId: 'sound-it-out', grade: '2', voiceConsent: false }, evidence);
  const cls = result.evidenceClassification;
  assert.ok(cls.types.includes(EVIDENCE_TYPES.COGNITIVE));
  assert.ok(cls.types.includes(EVIDENCE_TYPES.VISUAL_RECOGNITION));
  assert.ok(cls.note.includes('No validated phonics score'), 'Must state that tapping is not a validated phonics score');
});

test('rhyme-time: child identifying rhyme without speaking demonstrates the skill', () => {
  const rounds = serverRounds('rhyme-time', '2');
  const evidence = { rounds: rounds.map(r => ({ choices: [r.answer], letters: [] })),
    speech_transcript: '', time_taken_seconds: 10 };
  const result = evaluateEvidence({ activityId: 'rhyme-time', grade: '2', voiceConsent: false }, evidence);
  const cls = result.evidenceClassification;
  assert.ok(cls.note.includes('without speaking'), 'Must note that speaking is not required for rhyme recognition');
});

test('maths speech pronunciation does not affect mathematical result', () => {
  const rounds = serverRounds('number-hunt', '2');
  const evidence = { rounds: rounds.map(r => ({ choices: [r.answer], letters: [] })),
    speech_transcript: 'free fur fife', speech_duration_seconds: 8,
    recording_captured: true, time_taken_seconds: 12 };
  const result = evaluateEvidence({ activityId: 'number-hunt', grade: '2', voiceConsent: true }, evidence);
  // Score should be 100% despite imperfect pronunciation in transcript
  assert.equal(result.score, 100, 'Correct number selection must score 100% regardless of speech pronunciation');
  const cls = result.evidenceClassification;
  const spokenObs = cls.observations.find(o => o.type === EVIDENCE_TYPES.SPOKEN_PRODUCTION);
  assert.ok(spokenObs, 'Must have a spoken production observation');
  assert.ok(spokenObs.value.includes('should not receive an incorrect mathematical result') ||
    spokenObs.note.includes('should not receive an incorrect mathematical result'),
    'Must note that imperfect pronunciation does not affect the mathematical result');
});

// ── Evaluation Engine ────────────────────────────────────────────────────

test('high score with no hints → DEMONSTRATED', () => {
  const result = evaluateObservation({
    activityId: 'number-hunt', score: 100, total: 3, correct: 3,
    sessionSummary: { maxLevelReached: 0, totalHints: 0, selfCorrections: 0 },
  });
  assert.equal(result.level, OBSERVATION_LEVELS.DEMONSTRATED);
  assert.match(result.confidence, /medium|high/);
});

test('moderate score → DEVELOPING', () => {
  const result = evaluateObservation({
    activityId: 'rhyme-time', score: 67, total: 3, correct: 2,
    sessionSummary: { maxLevelReached: 1, totalHints: 1, selfCorrections: 0 },
  });
  assert.equal(result.level, OBSERVATION_LEVELS.DEVELOPING);
});

test('low score → NEEDS_FURTHER_PRACTICE', () => {
  const result = evaluateObservation({
    activityId: 'count-and-pick', score: 0, total: 3, correct: 0,
    sessionSummary: { maxLevelReached: 3, totalHints: 4, selfCorrections: 0 },
  });
  assert.equal(result.level, OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE);
});

test('no evidence → INSUFFICIENT_EVIDENCE', () => {
  const result = evaluateObservation({
    activityId: 'reading-time', score: null, total: 0, correct: 0,
    transcriptAvailable: false, recordingCaptured: false,
    sessionSummary: null,
  });
  assert.equal(result.level, OBSERVATION_LEVELS.INSUFFICIENT_EVIDENCE);
  assert.equal(result.confidence, 'insufficient');
});

test('100% on only 1 round → TEACHER_REVIEW_REQUIRED', () => {
  const result = evaluateObservation({
    activityId: 'number-hunt', score: 100, total: 1, correct: 1,
    sessionSummary: { maxLevelReached: 0, totalHints: 0, selfCorrections: 0 },
  });
  assert.equal(result.level, OBSERVATION_LEVELS.TEACHER_REVIEW_REQUIRED);
  assert.match(result.reason, /may not be enough/);
});

test('participation with speech transcript → DEVELOPING (low confidence)', () => {
  const result = evaluateObservation({
    activityId: 'reading-time', score: null, total: 0, correct: 0,
    transcriptAvailable: true, recordingCaptured: true,
    sessionSummary: { maxLevelReached: 1, totalHints: 1, selfCorrections: 0 },
  });
  assert.equal(result.level, OBSERVATION_LEVELS.DEVELOPING);
  assert.equal(result.confidence, 'low');
});

test('self-corrections are noted in the evaluation reason', () => {
  const result = evaluateObservation({
    activityId: 'rhyme-time', score: 67, total: 3, correct: 2,
    sessionSummary: { maxLevelReached: 1, totalHints: 2, selfCorrections: 1 },
  });
  assert.match(result.reason, /self-correction/i, 'Self-corrections must be noted in the reason');
});

// ── Pattern Detection (for Phase 3) ───────────────────────────────────────

test('repeated NEEDS_FURTHER_PRACTICE → persistent_gap pattern', () => {
  const result = evaluatePattern([
    { level: OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE },
    { level: OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE },
  ]);
  assert.equal(result.pattern, 'persistent_gap');
});

test('progression from NEEDS_FURTHER_PRACTICE → DEVELOPING → improving trend', () => {
  const result = evaluatePattern([
    { level: OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE },
    { level: OBSERVATION_LEVELS.DEVELOPING },
  ]);
  assert.equal(result.trend, 'improving');
});

test('regression from DEMONSTRATED → NEEDS_FURTHER_PRACTICE → regressing trend', () => {
  const result = evaluatePattern([
    { level: OBSERVATION_LEVELS.DEMONSTRATED },
    { level: OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE },
  ]);
  assert.equal(result.trend, 'regressing');
});

test('consistent DEMONSTRATED → mastered pattern', () => {
  const result = evaluatePattern([
    { level: OBSERVATION_LEVELS.DEMONSTRATED },
    { level: OBSERVATION_LEVELS.DEMONSTRATED },
  ]);
  assert.equal(result.pattern, 'mastered');
});
