import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { aggregateLearnerEvidence, aggregateClassEvidence } from '../../LesediAiAgent/src/analyticsEngine.js';
import { evaluateObservation, evaluatePattern } from '../../LesediAiAgent/src/evaluationEngine.js';
import { OBSERVATION_LEVELS, EVIDENCE_TYPES } from '../../shared/activityDefinitions.js';
import { ACTIVITIES } from '../../shared/activityCatalog.js';

// ── Helper: create a mock session ─────────────────────────────────────────
function mockSession(activityId, score, total, correct, overrides = {}) {
  return {
    activityId,
    activityName: ACTIVITIES[activityId]?.name ?? activityId,
    score,
    total,
    correct,
    transcriptAvailable: overrides.transcriptAvailable ?? false,
    recordingCaptured: overrides.recordingCaptured ?? false,
    hintsUsed: overrides.hintsUsed ?? 0,
    maxHintLevel: overrides.maxHintLevel ?? 0,
    selfCorrections: overrides.selfCorrections ?? 0,
    createdAt: overrides.createdAt ?? '2026-01-15T10:00:00.000Z',
    curriculumSkillId: overrides.curriculumSkillId ?? null,
    ...overrides,
  };
}

// ── Learner Analytics ──────────────────────────────────────────────────────

test('empty sessions returns insufficient evidence', () => {
  const result = aggregateLearnerEvidence({
    learnerId: 'l1', learnerName: 'Thando', subject: 'English', grade: '2', sessions: [],
  });
  assert.equal(result.totalSessions, 0);
  assert.equal(result.confidence, 'insufficient');
  assert.match(result.summary, /No sessions recorded/i);
});

test('groups sessions by curriculum skill', () => {
  const sessions = [
    mockSession('number-hunt', 100, 3, 3, { createdAt: '2026-01-10T10:00:00Z', curriculumSkillId: 'MATHS-NUMBER-RECOGNITION' }),
    mockSession('count-and-pick', 67, 3, 2, { createdAt: '2026-01-12T10:00:00Z', curriculumSkillId: 'MATHS-ONE-TO-ONE-COUNTING' }),
    mockSession('number-hunt', 67, 3, 2, { createdAt: '2026-01-14T10:00:00Z', curriculumSkillId: 'MATHS-NUMBER-RECOGNITION' }),
  ];
  const result = aggregateLearnerEvidence({
    learnerId: 'l1', learnerName: 'Bongi', subject: 'Mathematics', grade: '2', sessions,
  });
  assert.equal(result.skills.length, 2, 'Should group into 2 skills');
  const numRec = result.skills.find(s => s.skillId === 'MATHS-NUMBER-RECOGNITION');
  assert.ok(numRec, 'Should have MATHS-NUMBER-RECOGNITION skill group');
  assert.equal(numRec.sessionCount, 2, 'Should have 2 sessions for number recognition');
});

test('identifies skill gaps from repeated low scores', () => {
  const sessions = [
    mockSession('rhyme-time', 0, 3, 0, { createdAt: '2026-01-10T10:00:00Z', curriculumSkillId: 'HL-RHYME-RECOGNITION' }),
    mockSession('rhyme-time', 0, 3, 0, { createdAt: '2026-01-14T10:00:00Z', curriculumSkillId: 'HL-RHYME-RECOGNITION' }),
    mockSession('rhyme-time', 33, 3, 1, { createdAt: '2026-01-18T10:00:00Z', curriculumSkillId: 'HL-RHYME-RECOGNITION' }),
  ];
  const result = aggregateLearnerEvidence({
    learnerId: 'l2', learnerName: 'Sarah', subject: 'English', grade: '1', sessions,
  });
  assert.ok(result.skillGaps.length >= 1, 'Should identify rhyme recognition as a gap');
  assert.equal(result.skillGaps[0].skillId, 'HL-RHYME-RECOGNITION');
  assert.equal(result.skillGaps[0].pattern, 'persistent_gap');
});

test('identifies strengths from consistent high scores', () => {
  const sessions = [
    mockSession('number-hunt', 100, 3, 3, { createdAt: '2026-01-10T10:00:00Z', curriculumSkillId: 'MATHS-NUMBER-RECOGNITION' }),
    mockSession('number-hunt', 100, 3, 3, { createdAt: '2026-01-14T10:00:00Z', curriculumSkillId: 'MATHS-NUMBER-RECOGNITION' }),
  ];
  const result = aggregateLearnerEvidence({
    learnerId: 'l3', learnerName: 'Kabelo', subject: 'Mathematics', grade: '2', sessions,
  });
  assert.ok(result.strengths.length >= 1, 'Should identify number recognition as a strength');
  assert.equal(result.strengths[0].skillId, 'MATHS-NUMBER-RECOGNITION');
  assert.equal(result.strengths[0].level, OBSERVATION_LEVELS.DEMONSTRATED);
});

test('calculates observation period and weeks', () => {
  const sessions = [
    mockSession('number-hunt', 100, 3, 3, { createdAt: '2026-01-10T10:00:00Z' }),
    mockSession('number-hunt', 67, 3, 2, { createdAt: '2026-01-24T10:00:00Z' }),
  ];
  const result = aggregateLearnerEvidence({
    learnerId: 'l4', learnerName: 'Lebo', subject: 'Mathematics', grade: '2', sessions,
  });
  assert.ok(result.observationPeriod);
  assert.equal(result.observationPeriod.start, '2026-01-10');
  assert.equal(result.observationPeriod.end, '2026-01-24');
  assert.ok(result.observationPeriod.weeks >= 2, 'Should calculate at least 2 weeks');
});

test('detects improving trend', () => {
  const sessions = [
    mockSession('number-hunt', 0, 3, 0, { createdAt: '2026-01-10T10:00:00Z', curriculumSkillId: 'MATHS-NUMBER-RECOGNITION' }),
    mockSession('number-hunt', 67, 3, 2, { createdAt: '2026-01-14T10:00:00Z', curriculumSkillId: 'MATHS-NUMBER-RECOGNITION' }),
  ];
  const result = aggregateLearnerEvidence({
    learnerId: 'l5', learnerName: 'Thando', subject: 'Mathematics', grade: '2', sessions,
  });
  const skill = result.skills[0];
  assert.equal(skill.pattern.trend, 'improving', 'Should detect improving trend');
});

test('detects declining trend', () => {
  const sessions = [
    mockSession('number-hunt', 100, 3, 3, { createdAt: '2026-01-10T10:00:00Z', curriculumSkillId: 'MATHS-NUMBER-RECOGNITION' }),
    mockSession('number-hunt', 0, 3, 0, { createdAt: '2026-01-14T10:00:00Z', curriculumSkillId: 'MATHS-NUMBER-RECOGNITION' }),
  ];
  const result = aggregateLearnerEvidence({
    learnerId: 'l6', learnerName: 'Bongi', subject: 'Mathematics', grade: '2', sessions,
  });
  const skill = result.skills[0];
  assert.equal(skill.pattern.trend, 'regressing', 'Should detect regressing trend');
});

test('distinguishes verified results from AI interpretation', () => {
  const sessions = [
    mockSession('number-hunt', 100, 3, 3, { createdAt: '2026-01-10T10:00:00Z', curriculumSkillId: 'MATHS-NUMBER-RECOGNITION' }),
  ];
  const result = aggregateLearnerEvidence({
    learnerId: 'l7', learnerName: 'Kabelo', subject: 'Mathematics', grade: '2', sessions,
  });
  const skill = result.skills[0];
  // verified array should contain the raw session data
  assert.ok(skill.verified, 'Should have verified array');
  assert.equal(skill.verified[0].score, 100);
  assert.equal(skill.verified[0].correct, 3);
  // observations array should contain AI-evaluated levels
  assert.ok(skill.observations, 'Should have observations array');
  assert.equal(skill.observations[0].level, OBSERVATION_LEVELS.DEMONSTRATED);
});

test('participation activities do not inflate scores', () => {
  const sessions = [
    mockSession('reading-time', null, 0, 0, { createdAt: '2026-01-10T10:00:00Z', curriculumSkillId: 'HL-READING-FLUENCY', transcriptAvailable: true }),
  ];
  const result = aggregateLearnerEvidence({
    learnerId: 'l8', learnerName: 'Sarah', subject: 'English', grade: '2', sessions,
  });
  assert.equal(result.averageScore, null, 'Participation activities should not produce an average score');
  assert.equal(result.participationSessions, 1);
  assert.equal(result.scoredSessions, 0);
});

// ── Class Analytics ─────────────────────────────────────────────────────────

test('class analytics returns tier distribution', () => {
  const learners = [
    { learnerId: 'l1', learnerName: 'A', overallTrend: 'stable', skills: [
      { skillId: 'MATHS-NUMBER-RECOGNITION', activityName: 'Number Hunt', mostCommonLevel: OBSERVATION_LEVELS.DEMONSTRATED, pattern: { pattern: 'mastered' } }
    ], skillGaps: [], strengths: [{ skillId: 'MATHS-NUMBER-RECOGNITION', activityName: 'Number Hunt' }], averageScore: 100, totalSessions: 2 },
    { learnerId: 'l2', learnerName: 'B', overallTrend: 'stagnant', skills: [
      { skillId: 'MATHS-NUMBER-RECOGNITION', activityName: 'Number Hunt', mostCommonLevel: OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE, pattern: { pattern: 'persistent_gap' } }
    ], skillGaps: [{ skillId: 'MATHS-NUMBER-RECOGNITION', activityName: 'Number Hunt', level: OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE, pattern: 'persistent_gap' }], strengths: [], averageScore: 0, totalSessions: 2 },
    { learnerId: 'l3', learnerName: 'C', overallTrend: 'stable', skills: [
      { skillId: 'MATHS-NUMBER-RECOGNITION', activityName: 'Number Hunt', mostCommonLevel: OBSERVATION_LEVELS.DEVELOPING, pattern: { pattern: 'mixed' } }
    ], skillGaps: [], strengths: [], averageScore: 50, totalSessions: 2 },
  ];
  const result = aggregateClassEvidence({
    grade: '2', subject: 'Mathematics', classroomName: 'Grade 2', learners,
  });
  assert.ok(result.tierDistribution);
  assert.equal(result.tierDistribution[OBSERVATION_LEVELS.DEMONSTRATED], 1);
  assert.equal(result.tierDistribution[OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE], 1);
  assert.equal(result.tierDistribution[OBSERVATION_LEVELS.DEVELOPING], 1);
});

test('class analytics identifies common skill gaps affecting 30%+ of learners', () => {
  const learners = [
    { learnerId: 'l1', learnerName: 'A', skills: [], skillGaps: [{ skillId: 'HL-RHYME-RECOGNITION', activityName: 'Rhyme Time', level: 'NEEDS_FURTHER_PRACTICE' }], strengths: [], overallTrend: 'stagnant', totalSessions: 2 },
    { learnerId: 'l2', learnerName: 'B', skills: [], skillGaps: [{ skillId: 'HL-RHYME-RECOGNITION', activityName: 'Rhyme Time', level: 'NEEDS_FURTHER_PRACTICE' }], strengths: [], overallTrend: 'stagnant', totalSessions: 2 },
    { learnerId: 'l3', learnerName: 'C', skills: [], skillGaps: [{ skillId: 'HL-RHYME-RECOGNITION', activityName: 'Rhyme Time', level: 'NEEDS_FURTHER_PRACTICE' }], strengths: [], overallTrend: 'stable', totalSessions: 2 },
    { learnerId: 'l4', learnerName: 'D', skills: [], skillGaps: [], strengths: [], overallTrend: 'stable', totalSessions: 2 },
  ];
  const result = aggregateClassEvidence({
    grade: '2', subject: 'English', classroomName: 'Grade 2', learners,
  });
  assert.ok(result.commonSkillGaps.length >= 1, 'Should identify rhyme recognition as a common gap');
  assert.equal(result.commonSkillGaps[0].skillId, 'HL-RHYME-RECOGNITION');
  assert.equal(result.commonSkillGaps[0].learnersAffected, 3);
  assert.equal(result.commonSkillGaps[0].percentage, 75);
});

test('class analytics generates teaching recommendations', () => {
  const learners = [
    { learnerId: 'l1', learnerName: 'A', skills: [], skillGaps: [{ skillId: 'MATHS-NUMBER-RECOGNITION', activityName: 'Number Hunt', level: 'NEEDS_FURTHER_PRACTICE' }], strengths: [], overallTrend: 'stagnant', averageScore: 20, totalSessions: 2 },
    { learnerId: 'l2', learnerName: 'B', skills: [], skillGaps: [{ skillId: 'MATHS-NUMBER-RECOGNITION', activityName: 'Number Hunt', level: 'NEEDS_FURTHER_PRACTICE' }], strengths: [], overallTrend: 'stagnant', averageScore: 30, totalSessions: 2 },
    { learnerId: 'l3', learnerName: 'C', skills: [], skillGaps: [{ skillId: 'MATHS-NUMBER-RECOGNITION', activityName: 'Number Hunt', level: 'NEEDS_FURTHER_PRACTICE' }], strengths: [], overallTrend: 'stable', averageScore: 25, totalSessions: 2 },
    { learnerId: 'l4', learnerName: 'D', skills: [], skillGaps: [], strengths: [{ skillId: 'MATHS-NUMBER-RECOGNITION', activityName: 'Number Hunt' }], overallTrend: 'stable', averageScore: 90, totalSessions: 2 },
  ];
  const result = aggregateClassEvidence({
    grade: '2', subject: 'Mathematics', classroomName: 'Grade 2', learners,
  });
  assert.ok(result.recommendations.length >= 1, 'Should generate at least one recommendation');
  const targeted = result.recommendations.find(r => r.type === 'targeted_teaching');
  assert.ok(targeted, 'Should include targeted teaching recommendation');
  assert.match(targeted.recommendation, /Number Hunt|group activity/i);
});

test('class analytics identifies learners needing attention', () => {
  const learners = [
    { learnerId: 'l1', learnerName: 'A', skills: [], skillGaps: [{ skillId: 'X', activityName: 'X' }], strengths: [], overallTrend: 'declining', totalSessions: 2 },
    { learnerId: 'l2', learnerName: 'B', skills: [], skillGaps: [], strengths: [], overallTrend: 'stable', totalSessions: 2 },
  ];
  const result = aggregateClassEvidence({
    grade: '2', subject: 'English', classroomName: 'Grade 2', learners,
  });
  assert.equal(result.learnersNeedingAttention.length, 1);
  assert.equal(result.learnersNeedingAttention[0].learnerName, 'A');
  assert.equal(result.learnersNeedingAttention[0].gapCount, 1);
});

test('class analytics calculates class average score', () => {
  const learners = [
    { learnerId: 'l1', learnerName: 'A', averageScore: 80, skills: [], skillGaps: [], strengths: [], overallTrend: 'stable', totalSessions: 2 },
    { learnerId: 'l2', learnerName: 'B', averageScore: 60, skills: [], skillGaps: [], strengths: [], overallTrend: 'stable', totalSessions: 2 },
    { learnerId: 'l3', learnerName: 'C', averageScore: null, skills: [], skillGaps: [], strengths: [], overallTrend: 'stable', totalSessions: 2 },
  ];
  const result = aggregateClassEvidence({
    grade: '2', subject: 'Mathematics', classroomName: 'Grade 2', learners,
  });
  assert.equal(result.classAverageScore, 70, 'Should average 80+60 (null excluded)');
});

test('empty class returns insufficient', () => {
  const result = aggregateClassEvidence({
    grade: '2', subject: 'English', classroomName: 'Grade 2', learners: [],
  });
  assert.equal(result.totalLearners, 0);
  assert.equal(result.confidence, 'insufficient');
});

// ── Draft Creation with Evaluation ─────────────────────────────────────────

beforeEach(() => {
  // Set up localStorage mock for appWorkflow tests
  const memory = new Map();
  globalThis.localStorage = {
    getItem: k => memory.get(k) || null,
    setItem: (k, v) => memory.set(k, v),
  };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class { constructor(name) { this.type = name; } };
});

test('evaluateObservation produces distinguishable levels from verified scores', () => {
  // DEMONSTRATED: high score, no hints
  const demo = evaluateObservation({
    activityId: 'number-hunt', score: 100, total: 3, correct: 3,
    sessionSummary: { maxLevelReached: 0, totalHints: 0, selfCorrections: 0 },
  });
  assert.equal(demo.level, OBSERVATION_LEVELS.DEMONSTRATED);

  // DEVELOPING: moderate score with hints
  const dev = evaluateObservation({
    activityId: 'rhyme-time', score: 33, total: 3, correct: 1,
    sessionSummary: { maxLevelReached: 2, totalHints: 2, selfCorrections: 0 },
  });
  assert.equal(dev.level, OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE);

  // INSUFFICIENT: no evidence
  const ins = evaluateObservation({
    activityId: 'reading-time', score: null, total: 0, correct: 0,
    transcriptAvailable: false, recordingCaptured: false, sessionSummary: null,
  });
  assert.equal(ins.level, OBSERVATION_LEVELS.INSUFFICIENT_EVIDENCE);
});

test('pattern detection from multiple observations identifies persistent gaps', () => {
  const result = evaluatePattern([
    { level: OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE },
    { level: OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE },
    { level: OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE },
  ]);
  assert.equal(result.pattern, 'persistent_gap');
  assert.equal(result.trend, 'stagnant');
});

test('analytics summary is explainable and traceable', () => {
  const sessions = [
    mockSession('number-hunt', 100, 3, 3, { createdAt: '2026-01-10T10:00:00Z', curriculumSkillId: 'MATHS-NUMBER-RECOGNITION' }),
    mockSession('number-hunt', 67, 3, 2, { createdAt: '2026-01-14T10:00:00Z', curriculumSkillId: 'MATHS-NUMBER-RECOGNITION' }),
  ];
  const result = aggregateLearnerEvidence({
    learnerId: 'l1', learnerName: 'Thando', subject: 'Mathematics', grade: '2', sessions,
  });
  // Summary should mention the learner name and session count
  assert.match(result.summary, /Thando/);
  assert.match(result.summary, /2 session/);
  // Each skill should have a patternReason explaining why
  assert.ok(result.skills[0].patternReason, 'Should have a pattern reason');
  assert.match(result.skills[0].patternReason, /2 session/);
});
