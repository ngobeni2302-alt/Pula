/**
 * analyticsEngine.js
 * Evidence aggregation and pattern detection across sessions.
 *
 * This is the core of the Learning Analytics Engine (Component 4).
 * It collects evidence across multiple sessions for a learner or class,
 * identifies patterns, and produces explainable analytics.
 *
 * KEY PRINCIPLES:
 *   - Use deterministic algorithms for scoring (never let the LLM invent scores)
 *   - Use AI only for interpretation and recommendations
 *   - Identify repeated patterns, not single mistakes
 *   - Show number of attempts and observation period
 *   - Consider evidence quality (validated scores vs participation only)
 *   - Preserve subject-specific learning histories
 *   - Identify progress and regression
 *   - Explain WHY a learning gap is suspected
 *   - Any AI-generated observation must be distinguishable from verified results
 *   - Response time alone is never a measure of ability
 *   - Where evidence is insufficient, say so explicitly
 */

import { evaluateObservation, evaluatePattern } from './evaluationEngine.js';
import { getActivityDefinition, OBSERVATION_LEVELS } from '../../shared/activityDefinitions.js';

// ---------------------------------------------------------------------------
// Per-learner analytics
// ---------------------------------------------------------------------------

/**
 * Aggregate evidence across multiple sessions for a single learner.
 *
 * @param {object} ctx
 *   ctx.learnerId       — learner identifier
 *   ctx.learnerName    — for display
 *   ctx.subject        — 'English' | 'Mathematics'
 *   ctx.grade          — 'R' | '1' | '2' | '3'
 *   ctx.sessions       — array of session objects:
 *     { activityId, activityName, score, total, correct, transcriptAvailable,
 *       recordingCaptured, hintsUsed, maxHintLevel, selfCorrections,
 *       createdAt, curriculumSkillId, evaluationMethod }
 * @returns {object} structured analytics report
 */
export function aggregateLearnerEvidence(ctx) {
  const { learnerId, learnerName, subject, grade, sessions = [] } = ctx;

  if (sessions.length === 0) {
    return {
      learnerId,
      learnerName,
      subject,
      grade,
      totalSessions: 0,
      skills: [],
      summary: 'No sessions recorded yet. Insufficient evidence for analytics.',
      confidence: 'insufficient',
    };
  }

  // Group sessions by curriculum skill
  const skillGroups = {};
  for (const s of sessions) {
    const skillId = s.curriculumSkillId ?? getActivityDefinition(s.activityId)?.curriculumSkillId ?? 'UNKNOWN';
    if (!skillGroups[skillId]) {
      skillGroups[skillId] = {
        skillId,
        activityName: s.activityName,
        sessions: [],
      };
    }
    skillGroups[skillId].sessions.push(s);
  }

  // Analyse each skill group
  const skills = Object.values(skillGroups).map(group => analyseSkillGroup(group, grade));

  // Overall learner summary
  const totalSessions = sessions.length;
  const scoredSessions = sessions.filter(s => s.score != null);
  const participationSessions = sessions.filter(s => s.score == null);
  const avgScore = scoredSessions.length > 0
    ? Math.round(scoredSessions.reduce((sum, s) => sum + s.score, 0) / scoredSessions.length)
    : null;

  // Observation period
  const dates = sessions.map(s => new Date(s.createdAt)).sort((a, b) => a - b);
  const observationStart = dates[0]?.toISOString().slice(0, 10) ?? null;
  const observationEnd = dates[dates.length - 1]?.toISOString().slice(0, 10) ?? null;
  const weeksObserved = dates.length > 1
    ? Math.max(1, Math.round((dates[dates.length - 1] - dates[0]) / (7 * 24 * 60 * 60 * 1000)))
    : 1;

  // Overall trend
  const allPatterns = skills.map(s => s.pattern);
  const improvingCount = allPatterns.filter(p => p.trend === 'improving').length;
  const decliningCount = allPatterns.filter(p => p.trend === 'regressing').length;
  const stagnantCount = allPatterns.filter(p => p.trend === 'stagnant').length;

  let overallTrend = 'stable';
  if (improvingCount > decliningCount) overallTrend = 'improving';
  else if (decliningCount > improvingCount) overallTrend = 'declining';

  // Skill gaps (skills with NEEDS_FURTHER_PRACTICE or persistent_gap pattern)
  const skillGaps = skills.filter(s =>
    s.mostCommonLevel === OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE ||
    s.pattern.pattern === 'persistent_gap'
  );

  // Strengths (skills with DEMONSTRATED or mastered pattern)
  const strengths = skills.filter(s =>
    s.mostCommonLevel === OBSERVATION_LEVELS.DEMONSTRATED ||
    s.pattern.pattern === 'mastered'
  );

  return {
    learnerId,
    learnerName,
    subject,
    grade,
    totalSessions,
    scoredSessions: scoredSessions.length,
    participationSessions: participationSessions.length,
    averageScore: avgScore,
    observationPeriod: { start: observationStart, end: observationEnd, weeks: weeksObserved },
    overallTrend,
    skills,
    skillGaps: skillGaps.map(s => ({
      skillId: s.skillId,
      activityName: s.activityName,
      level: s.mostCommonLevel,
      pattern: s.pattern.pattern,
      sessions: s.sessionCount,
      reason: s.patternReason,
    })),
    strengths: strengths.map(s => ({
      skillId: s.skillId,
      activityName: s.activityName,
      level: s.mostCommonLevel,
      sessions: s.sessionCount,
    })),
    summary: buildLearnerSummary({
      learnerName, totalSessions, avgScore, overallTrend,
      skillGaps: skillGaps.length, strengths: strengths.length,
      weeksObserved, confidence: skills.length >= 3 ? 'medium' : 'low',
    }),
    confidence: skills.length >= 3 && totalSessions >= 3 ? 'medium' : 'low',
  };
}

/**
 * Analyse a group of sessions for the same skill.
 */
function analyseSkillGroup(group, grade) {
  const sessions = group.sessions;
  const sessionCount = sessions.length;

  // Evaluate each session individually
  const observations = sessions.map(s => evaluateObservation({
    activityId: s.activityId,
    score: s.score ?? null,
    total: s.total ?? 0,
    correct: s.correct ?? 0,
    transcriptAvailable: s.transcriptAvailable ?? false,
    recordingCaptured: s.recordingCaptured ?? false,
    sessionSummary: {
      maxLevelReached: s.maxHintLevel ?? 0,
      totalHints: s.hintsUsed ?? 0,
      selfCorrections: s.selfCorrections ?? 0,
    },
  }));

  // Pattern across sessions
  const pattern = evaluatePattern(observations);

  // Most common observation level
  const levelCounts = {};
  for (const obs of observations) {
    levelCounts[obs.level] = (levelCounts[obs.level] || 0) + 1;
  }
  const mostCommonLevel = Object.entries(levelCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? OBSERVATION_LEVELS.INSUFFICIENT_EVIDENCE;

  // Score trend (if scored sessions exist)
  const scoredSessions = sessions.filter(s => s.score != null);
  let scoreTrend = 'no_scored_data';
  if (scoredSessions.length >= 2) {
    const scores = scoredSessions.map(s => s.score);
    const first = scores[0];
    const last = scores[scores.length - 1];
    if (last > first + 10) scoreTrend = 'improving';
    else if (last < first - 10) scoreTrend = 'declining';
    else scoreTrend = 'stable';
  }

  // Evidence quality
  const validatedSessions = sessions.filter(s => s.score != null).length;
  const participationOnly = sessions.filter(s => s.score == null).length;
  const evidenceQuality = validatedSessions >= 2 ? 'adequate' : 'limited';

  // Build pattern reason
  let patternReason = '';
  switch (pattern.pattern) {
    case 'persistent_gap':
      patternReason = `${sessionCount} sessions show repeated difficulty with this skill. A learning gap is suspected — teacher review recommended.`;
      break;
    case 'improving':
      patternReason = `${sessionCount} sessions show improvement. The child is progressing with this skill.`;
      break;
    case 'regressing':
      patternReason = `${sessionCount} sessions show regression. The child may be losing confidence or facing a new challenge. Teacher review recommended.`;
      break;
    case 'mastered':
      patternReason = `${sessionCount} sessions consistently demonstrate this skill. Consider enrichment or progression to the next skill.`;
      break;
    case 'insufficient_data':
      patternReason = `Only ${sessionCount} session(s) recorded. More evidence is needed before drawing conclusions.`;
      break;
    default:
      patternReason = `${sessionCount} sessions show mixed results. Continue monitoring.`;
  }

  return {
    skillId: group.skillId,
    activityName: group.activityName,
    sessionCount,
    mostCommonLevel,
    pattern,
    scoreTrend,
    patternReason,
    evidenceQuality,
    validatedSessions,
    participationOnly,
    observations: observations.map(o => ({ level: o.level, reason: o.reason, confidence: o.confidence })),
    // Distinguish verified results from AI interpretation
    verified: sessions.map(s => ({
      activityId: s.activityId,
      score: s.score,
      total: s.total,
      correct: s.correct,
      date: s.createdAt,
    })),
  };
}

/**
 * Build a plain-language summary for the learner analytics.
 */
function buildLearnerSummary({ learnerName, totalSessions, avgScore, overallTrend,
                               skillGaps, strengths, weeksObserved, confidence }) {
  const parts = [];

  parts.push(`${learnerName}: ${totalSessions} session${totalSessions !== 1 ? 's' : ''} recorded over ${weeksObserved} week${weeksObserved !== 1 ? 's' : ''}.`);

  if (avgScore != null) {
    parts.push(`Average score: ${avgScore}% across scored activities.`);
  }

  if (overallTrend === 'improving') {
    parts.push('Overall trend: improving. The child is making progress.');
  } else if (overallTrend === 'declining') {
    parts.push('Overall trend: declining. Teacher review recommended.');
  } else {
    parts.push('Overall trend: stable.');
  }

  if (skillGaps > 0) {
    parts.push(`${skillGaps} skill area${skillGaps !== 1 ? 's' : ''} need${skillGaps === 1 ? 's' : ''} further practice.`);
  }
  if (strengths > 0) {
    parts.push(`${strengths} skill area${strengths !== 1 ? 's' : ''} demonstrated${strengths === 1 ? '' : ''}.`);
  }

  if (confidence === 'insufficient') {
    parts.push('Confidence: insufficient — more sessions needed before drawing conclusions.');
  } else if (confidence === 'low') {
    parts.push('Confidence: low — continue gathering evidence.');
  } else {
    parts.push('Confidence: medium — patterns are becoming visible.');
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Class-level analytics
// ---------------------------------------------------------------------------

/**
 * Aggregate evidence across all learners in a class.
 *
 * @param {object} ctx
 *   ctx.grade         — 'R' | '1' | '2' | '3'
 *   ctx.subject       — 'English' | 'Mathematics'
 *   ctx.classroomName — for display
 *   ctx.learners      — array of learner analytics objects (from aggregateLearnerEvidence)
 * @returns {object} class-level analytics report
 */
export function aggregateClassEvidence(ctx) {
  const { grade, subject, classroomName, learners = [] } = ctx;

  if (learners.length === 0) {
    return {
      classroomName, grade, subject,
      totalLearners: 0,
      summary: 'No learner data available for this class.',
      confidence: 'insufficient',
    };
  }

  const totalLearners = learners.length;

  // Tier distribution (from learners' most common levels)
  const tierDistribution = {
    [OBSERVATION_LEVELS.DEMONSTRATED]: 0,
    [OBSERVATION_LEVELS.DEVELOPING]: 0,
    [OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE]: 0,
    [OBSERVATION_LEVELS.INSUFFICIENT_EVIDENCE]: 0,
    [OBSERVATION_LEVELS.TEACHER_REVIEW_REQUIRED]: 0,
  };

  for (const l of learners) {
    for (const skill of (l.skills || [])) {
      tierDistribution[skill.mostCommonLevel] = (tierDistribution[skill.mostCommonLevel] || 0) + 1;
    }
  }

  // Common skill gaps (skills that appear as gaps for multiple learners)
  const skillGapCounts = {};
  for (const l of learners) {
    for (const gap of (l.skillGaps || [])) {
      skillGapCounts[gap.skillId] = (skillGapCounts[gap.skillId] || 0) + 1;
    }
  }

  const commonSkillGaps = Object.entries(skillGapCounts)
    .filter(([, count]) => count >= Math.ceil(totalLearners * 0.3)) // 30%+ of learners
    .sort(([, a], [, b]) => b - a)
    .map(([skillId, count]) => {
      const def = learners.flatMap(l => l.skills || []).find(s => s.skillId === skillId);
      return {
        skillId,
        activityName: def?.activityName ?? skillId,
        learnersAffected: count,
        percentage: Math.round((count / totalLearners) * 100),
      };
    });

  // Class strengths
  const strengthCounts = {};
  for (const l of learners) {
    for (const s of (l.strengths || [])) {
      strengthCounts[s.skillId] = (strengthCounts[s.skillId] || 0) + 1;
    }
  }

  const classStrengths = Object.entries(strengthCounts)
    .filter(([, count]) => count >= Math.ceil(totalLearners * 0.5)) // 50%+ of learners
    .sort(([, a], [, b]) => b - a)
    .map(([skillId, count]) => ({
      skillId,
      learnersDemonstrating: count,
      percentage: Math.round((count / totalLearners) * 100),
    }));

  // Learners needing attention
  const learnersNeedingAttention = learners
    .filter(l => (l.skillGaps || []).length > 0)
    .map(l => ({
      learnerId: l.learnerId,
      learnerName: l.learnerName,
      gapCount: l.skillGaps.length,
      trend: l.overallTrend,
    }));

  // Average score across class
  const scoredLearners = learners.filter(l => l.averageScore != null);
  const classAverageScore = scoredLearners.length > 0
    ? Math.round(scoredLearners.reduce((sum, l) => sum + l.averageScore, 0) / scoredLearners.length)
    : null;

  // Teaching recommendations
  const recommendations = buildClassRecommendations({
    commonSkillGaps, classStrengths, totalLearners, classAverageScore,
    tierDistribution, learnersNeedingAttention,
  });

  return {
    classroomName,
    grade,
    subject,
    totalLearners,
    classAverageScore,
    tierDistribution,
    commonSkillGaps,
    classStrengths,
    learnersNeedingAttention,
    recommendations,
    summary: buildClassSummary({
      classroomName, totalLearners, classAverageScore,
      commonSkillGaps: commonSkillGaps.length, classStrengths: classStrengths.length,
      learnersNeedingAttention: learnersNeedingAttention.length,
    }),
    confidence: learners.filter(l => l.totalSessions >= 2).length >= Math.ceil(totalLearners / 2) ? 'medium' : 'low',
  };
}

/**
 * Build teaching recommendations from class analytics.
 */
function buildClassRecommendations({ commonSkillGaps, classStrengths, totalLearners,
                                      classAverageScore, tierDistribution, learnersNeedingAttention }) {
  const recs = [];

  // If there are common skill gaps, recommend targeted teaching
  for (const gap of commonSkillGaps) {
    const def = getActivityDefinition(gap.skillId) ?? getActivityDefinition(gap.activityId);
    recs.push({
      type: 'targeted_teaching',
      skill: gap.activityName,
      learnersAffected: gap.learnersAffected,
      percentage: gap.percentage,
      capsRef: def?.capsRef ?? null,
      recommendation: `${gap.percentage}% of the class (${gap.learnersAffected} learners) are struggling with ${gap.activityName}. Consider a focused group activity this week.`,
    });
  }

  // If class average is low, recommend review
  if (classAverageScore != null && classAverageScore < 50) {
    recs.push({
      type: 'class_review',
      recommendation: `Class average is ${classAverageScore}%. Consider reviewing foundational concepts before moving to new material.`,
    });
  }

  // If many learners need attention, recommend grouping
  if (learnersNeedingAttention.length >= Math.ceil(totalLearners * 0.4)) {
    recs.push({
      type: 'differentiated_grouping',
      recommendation: `${learnersNeedingAttention.length} learners need additional support. Consider small-group instruction for targeted practice.`,
    });
  }

  // If there are class strengths, recommend enrichment
  for (const strength of classStrengths) {
    recs.push({
      type: 'enrichment',
      skill: strength.skillId,
      recommendation: `${strength.percentage}% of the class has demonstrated ${strength.skillId}. Consider enrichment activities for these learners.`,
    });
  }

  // If insufficient evidence, recommend more sessions
  const insufficientCount = (tierDistribution[OBSERVATION_LEVELS.INSUFFICIENT_EVIDENCE] || 0);
  if (insufficientCount > totalLearners * 0.3) {
    recs.push({
      type: 'gather_evidence',
      recommendation: 'Many learners have insufficient evidence. Continue recording activity sessions to build a clearer picture.',
    });
  }

  return recs;
}

/**
 * Build a plain-language class summary.
 */
function buildClassSummary({ classroomName, totalLearners, classAverageScore,
                               commonSkillGaps, classStrengths, learnersNeedingAttention }) {
  const parts = [];
  parts.push(`${classroomName}: ${totalLearners} learners analysed.`);

  if (classAverageScore != null) {
    parts.push(`Class average: ${classAverageScore}%.`);
  }

  if (commonSkillGaps > 0) {
    parts.push(`${commonSkillGaps} common skill gap${commonSkillGaps !== 1 ? 's' : ''} identified across the class.`);
  }
  if (classStrengths > 0) {
    parts.push(`${classStrengths} class strength${classStrengths !== 1 ? 's' : ''}.`);
  }
  if (learnersNeedingAttention > 0) {
    parts.push(`${learnersNeedingAttention} learner${learnersNeedingAttention !== 1 ? 's' : ''} need${learnersNeedingAttention === 1 ? 's' : ''} additional support.`);
  }

  return parts.join(' ');
}
