import test from 'node:test';
import assert from 'node:assert/strict';

import { draftParentNote, draftTermReport, draftParentResponse } from '../../LesediAiAgent/src/parentCopilot.js';
import { generateHodReport } from '../../LesediAiAgent/src/hodIntelligence.js';
import { aggregateLearnerEvidence } from '../../LesediAiAgent/src/analyticsEngine.js';
import { OBSERVATION_LEVELS } from '../../shared/activityDefinitions.js';
import { ACTIVITIES } from '../../shared/activityCatalog.js';

// ── Parent Communication Copilot ────────────────────────────────────────────

test('parent note for DEMONSTRATED is positive and practical', () => {
  const result = draftParentNote({
    learnerName: 'Thando', activityName: 'Number Hunt', subject: 'Mathematics',
    score: 100, total: 3, correct: 3,
    observationLevel: OBSERVATION_LEVELS.DEMONSTRATED,
    curriculumSkillId: 'MATHS-NUMBER-RECOGNITION',
  });
  assert.match(result.text, /Thando/);
  assert.match(result.text, /Number Hunt/);
  assert.match(result.text, /3 of 3/);
  assert.match(result.text, /did well/i);
  assert.ok(result.homeActivity, 'Should include a home activity');
  assert.ok(result.requiresApproval, 'Must require teacher approval');
  assert.equal(result.source, 'parent_copilot');
});

test('parent note for NEEDS_FURTHER_PRACTICE is encouraging not negative', () => {
  const result = draftParentNote({
    learnerName: 'Sarah', activityName: 'Rhyme Time', subject: 'English',
    score: 0, total: 3, correct: 0,
    observationLevel: OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE,
    curriculumSkillId: 'HL-RHYME-RECOGNITION',
  });
  assert.match(result.text, /tried hard/i);
  assert.ok(!/bad|fail|behind|poor/i.test(result.text), 'Must not contain negative language');
  assert.ok(result.homeActivity, 'Should still suggest a practical home activity');
});

test('parent note for participation activity mentions listening', () => {
  const result = draftParentNote({
    learnerName: 'Bongi', activityName: 'Reading Time', subject: 'English',
    score: null, total: 0, correct: 0,
    observationLevel: OBSERVATION_LEVELS.INSUFFICIENT_EVIDENCE,
    curriculumSkillId: 'HL-READING-FLUENCY',
    transcriptAvailable: true,
  });
  assert.match(result.text, /read aloud/i);
  assert.match(result.text, /listen.*home/i);
});

test('parent note does not compare to other children', () => {
  const result = draftParentNote({
    learnerName: 'Kabelo', activityName: 'Number Hunt', subject: 'Mathematics',
    score: 67, total: 3, correct: 2,
    observationLevel: OBSERVATION_LEVELS.DEVELOPING,
    curriculumSkillId: 'MATHS-NUMBER-RECOGNITION',
  });
  assert.ok(!/other children|classmates|compared to/i.test(result.text), 'Must not compare to other children');
});

test('parent note does not diagnose', () => {
  const result = draftParentNote({
    learnerName: 'Lebo', activityName: 'Sound It Out', subject: 'English',
    score: null, total: 0, correct: 0,
    observationLevel: OBSERVATION_LEVELS.INSUFFICIENT_EVIDENCE,
    curriculumSkillId: 'HL-PHONEME-BLENDING',
  });
  assert.ok(!/dyslex|disorder|disability|diagnos|delay/i.test(result.text), 'Must not contain diagnostic language');
});

test('home activities are practical for South African households', () => {
  const result = draftParentNote({
    learnerName: 'Thando', activityName: 'Count and Pick', subject: 'Mathematics',
    score: 100, total: 3, correct: 3,
    observationLevel: OBSERVATION_LEVELS.DEMONSTRATED,
    curriculumSkillId: 'MATHS-ONE-TO-ONE-COUNTING',
  });
  // Home activity should mention familiar objects (spoons, shoes, stones, etc.)
  assert.match(result.homeActivity, /spoon|shoe|stone|plate|step|count/i);
});

// ── Term Progress Report ────────────────────────────────────────────────────

test('term report includes overview, strengths, areas, and home activities', () => {
  const analytics = aggregateLearnerEvidence({
    learnerId: 'l1', learnerName: 'Thando', subject: 'Mathematics', grade: '2',
    sessions: [
      { activityId: 'number-hunt', activityName: 'Number Hunt', score: 100, total: 3, correct: 3,
        transcriptAvailable: false, recordingCaptured: false, hintsUsed: 0, maxHintLevel: 0,
        selfCorrections: 0, createdAt: '2026-01-10T10:00:00Z', curriculumSkillId: 'MATHS-NUMBER-RECOGNITION' },
      { activityId: 'count-and-pick', activityName: 'Count and Pick', score: 0, total: 3, correct: 0,
        transcriptAvailable: false, recordingCaptured: false, hintsUsed: 3, maxHintLevel: 3,
        selfCorrections: 0, createdAt: '2026-01-14T10:00:00Z', curriculumSkillId: 'MATHS-ONE-TO-ONE-COUNTING' },
      { activityId: 'count-and-pick', activityName: 'Count and Pick', score: 0, total: 3, correct: 0,
        transcriptAvailable: false, recordingCaptured: false, hintsUsed: 3, maxHintLevel: 3,
        selfCorrections: 0, createdAt: '2026-01-18T10:00:00Z', curriculumSkillId: 'MATHS-ONE-TO-ONE-COUNTING' },
    ],
  });
  const result = draftTermReport({
    learnerName: 'Thando', subject: 'Mathematics', grade: '2', term: 1,
    analytics, teacherName: 'Mrs Khumalo',
  });
  assert.match(result.text, /Term 1/i);
  assert.match(result.text, /Thando/);
  assert.ok(result.sections.opening, 'Should have opening section');
  assert.ok(result.sections.overview, 'Should have overview section');
  assert.ok(result.sections.strengths.length > 0 || result.sections.areas.length > 0, 'Should have strengths or areas');
  assert.ok(result.sections.homeActivities.length > 0, 'Should have home activities');
  assert.match(result.text, /Mrs Khumalo/);
  assert.ok(result.requiresApproval);
});

test('term report for learner with no sessions encourages support', () => {
  const result = draftTermReport({
    learnerName: 'Bongi', subject: 'English', grade: '1', term: 2,
    analytics: { totalSessions: 0, strengths: [], skillGaps: [], observationPeriod: {} },
    teacherName: 'Mr Smith',
  });
  assert.match(result.text, /not yet completed/i);
  assert.ok(result.sections.homeActivities.length > 0, 'Should still suggest home activities');
});

// ── Parent Question Response ───────────────────────────────────────────────

test('response to "how is my child doing" uses analytics', () => {
  const result = draftParentResponse({
    learnerName: 'Thando',
    parentQuestion: 'How is Thando doing in maths?',
    analytics: { totalSessions: 5, averageScore: 75, overallTrend: 'improving', skillGaps: [] },
    subject: 'Mathematics',
  });
  assert.match(result.text, /5 activit/i);
  assert.match(result.text, /75%/);
  assert.match(result.text, /improving/i);
  assert.ok(result.requiresApproval);
});

test('response to "how can I help at home" provides practical activities', () => {
  const result = draftParentResponse({
    learnerName: 'Sarah',
    parentQuestion: 'What can I do to help at home?',
    analytics: { totalSessions: 3, skillGaps: [{ skillId: 'HL-RHYME-RECOGNITION', activityName: 'Rhyme Time' }] },
    subject: 'English',
  });
  assert.match(result.text, /home/i);
  // Should include a practical activity
  assert.ok(result.text.length > 50, 'Should provide a substantive response');
});

test('response to concern is reassuring and non-diagnostic', () => {
  const result = draftParentResponse({
    learnerName: 'Kabelo',
    parentQuestion: 'I am worried that Kabelo is struggling',
    analytics: { totalSessions: 4, skillGaps: [{ skillId: 'MATHS-NUMBER-RECOGNITION', activityName: 'Number Hunt' }] },
    subject: 'Mathematics',
  });
  assert.match(result.text, /thank you for sharing/i);
  assert.ok(!/dyslex|disorder|disability|diagnos/i.test(result.text), 'Must not diagnose');
  assert.match(result.text, /Number Hunt/);
});

// ── HOD Quality Assurance ──────────────────────────────────────────────────

test('HOD report with no issues returns clean summary', () => {
  const result = generateHodReport({
    grade: '2', subject: 'Mathematics',
    classAnalytics: [
      { classroomName: 'Grade 2A', totalLearners: 20, classAverageScore: 75,
        commonSkillGaps: [], classStrengths: [], learnersNeedingAttention: [],
        tierDistribution: { DEMONSTRATED: 15, DEVELOPING: 5 }, confidence: 'medium' },
    ],
    context: {}, interventionLog: [], consentStats: { total: 20, withConsent: 20, withoutConsent: 0 },
  });
  assert.equal(result.totalClasses, 1);
  assert.equal(result.totalLearners, 20);
  assert.equal(result.flags.length, 0);
  assert.match(result.summary, /No significant issues/i);
});

test('HOD report flags common skill gaps with supporting evidence', () => {
  const result = generateHodReport({
    grade: '1', subject: 'English',
    classAnalytics: [
      { classroomName: 'Grade 1A', totalLearners: 10,
        commonSkillGaps: [{ skillId: 'HL-RHYME-RECOGNITION', activityName: 'Rhyme Time', learnersAffected: 7, percentage: 70 }],
        classStrengths: [], learnersNeedingAttention: [],
        tierDistribution: {}, classAverageScore: 40, confidence: 'medium' },
    ],
    context: { classSize: 35, attendance: 75 },
  });
  assert.ok(result.flags.length >= 1, 'Should flag the skill gap');
  const rhymeFlag = result.flags.find(f => f.curriculumArea === 'HL-RHYME-RECOGNITION');
  assert.ok(rhymeFlag, 'Should have rhyme recognition flag');
  assert.match(rhymeFlag.issue, /70%/);
  assert.match(rhymeFlag.issue, /Rhyme Time/);
  assert.ok(rhymeFlag.evidence, 'Flag should have supporting evidence');
  assert.ok(rhymeFlag.possibleReasons.length > 0, 'Flag should have possible reasons');
  assert.ok(rhymeFlag.suggestedActions.length > 0, 'Flag should have suggested actions');
  assert.equal(rhymeFlag.severity, 'high');
});

test('HOD report considers contextual factors and does not blame teacher', () => {
  const result = generateHodReport({
    grade: '2', subject: 'Mathematics',
    classAnalytics: [
      { classroomName: 'Grade 2B', totalLearners: 40,
        commonSkillGaps: [{ skillId: 'MATHS-NUMBER-RECOGNITION', activityName: 'Number Hunt', learnersAffected: 25, percentage: 63 }],
        classStrengths: [], learnersNeedingAttention: [],
        tierDistribution: {}, classAverageScore: 30, confidence: 'medium' },
    ],
    context: { classSize: 40, attendance: 70, resources: 'limited', languageContext: 'additional_language' },
  });
  const flag = result.flags.find(f => f.curriculumArea === 'MATHS-NUMBER-RECOGNITION');
  // Should mention class size, attendance, and language as possible reasons
  assert.ok(flag.possibleReasons.some(r => /40/i.test(r)), 'Should mention class size');
  assert.ok(flag.possibleReasons.some(r => /70%/i.test(r)), 'Should mention attendance');
  assert.ok(flag.possibleReasons.some(r => /additional language/i.test(r)), 'Should mention language context');
  // Should NOT say the teacher is underperforming
  assert.ok(!flag.possibleReasons.some(r => /teacher.*underperform|teacher.*poor|teacher.*bad/i.test(r)),
    'Must not blame the teacher');
});

test('HOD report flags low class average', () => {
  const result = generateHodReport({
    grade: '3', subject: 'English',
    classAnalytics: [
      { classroomName: 'Grade 3A', totalLearners: 15, classAverageScore: 35,
        commonSkillGaps: [], classStrengths: [], learnersNeedingAttention: [],
        tierDistribution: {}, confidence: 'medium' },
    ],
  });
  const avgFlag = result.flags.find(f => /Class average.*35%/.test(f.issue));
  assert.ok(avgFlag, 'Should flag low class average');
  assert.equal(avgFlag.severity, 'high');
});

test('HOD report flags insufficient evidence', () => {
  const result = generateHodReport({
    grade: 'R', subject: 'English',
    classAnalytics: [
      { classroomName: 'Grade RA', totalLearners: 20,
        commonSkillGaps: [], classStrengths: [], learnersNeedingAttention: [],
        tierDistribution: { INSUFFICIENT_EVIDENCE: 12, DEVELOPING: 8 },
        classAverageScore: null, confidence: 'low' },
    ],
  });
  const insFlag = result.flags.find(f => /insufficient.*evidence/i.test(f.issue));
  assert.ok(insFlag, 'Should flag insufficient evidence');
  assert.match(insFlag.issue, /12/);
});

test('HOD report flags consent issues', () => {
  const result = generateHodReport({
    grade: '2', subject: 'Mathematics',
    classAnalytics: [],
    consentStats: { total: 20, withConsent: 12, withoutConsent: 8 },
  });
  assert.equal(result.consentStatus.status, 'attention_required');
  assert.match(result.consentStatus.note, /8/);
  // Should have a recommendation about consent
  const consentRec = result.recommendations.find(r => /consent/i.test(r.recommendation));
  assert.ok(consentRec, 'Should recommend consent follow-up');
});

test('HOD report tracks intervention follow-up', () => {
  const result = generateHodReport({
    grade: '2', subject: 'English',
    classAnalytics: [],
    interventionLog: [
      { learnerId: 'l1', date: '2026-01-10', action: 'Small group practice', followUpDate: '2026-01-20', resolved: false },
      { learnerId: 'l2', date: '2026-01-15', action: 'Parent meeting', followUpDate: '2026-01-25', resolved: true },
    ],
  });
  assert.equal(result.interventionFollowUp.total, 2);
  assert.equal(result.interventionFollowUp.pending, 1);
  assert.equal(result.interventionFollowUp.resolved, 1);
});

test('HOD report recognises class strengths', () => {
  const result = generateHodReport({
    grade: '2', subject: 'Mathematics',
    classAnalytics: [
      { classroomName: 'Grade 2A', totalLearners: 20, classAverageScore: 80,
        commonSkillGaps: [], classStrengths: [{ skillId: 'MATHS-NUMBER-RECOGNITION', learnersDemonstrating: 18, percentage: 90 }],
        learnersNeedingAttention: [], tierDistribution: { DEMONSTRATED: 18, DEVELOPING: 2 }, confidence: 'medium' },
    ],
  });
  assert.ok(result.strengths.length >= 1, 'Should recognise class strengths');
  assert.equal(result.strengths[0].classroomName, 'Grade 2A');
  // Should have a low-priority recommendation about recognising the teacher
  const strengthRec = result.recommendations.find(r => /recognise/i.test(r.recommendation));
  assert.ok(strengthRec, 'Should recommend recognising strengths');
});

test('HOD report does not equate Pula tiers with DBE codes', () => {
  const result = generateHodReport({
    grade: '2', subject: 'English',
    classAnalytics: [],
  });
  assert.ok(!/DBE code|achievement code/i.test(result.summary), 'Must not reference DBE codes in summary');
});
