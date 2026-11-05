/**
 * hodIntelligence.js
 * HOD Quality Assurance Intelligence (Component 7).
 *
 * Generates explainable observations and recommendations for Heads of Department
 * monitoring Foundation Phase teaching and learning.
 *
 * KEY PRINCIPLES:
 *   - Do not conclude a teacher is underperforming solely because learner scores are low
 *   - Consider class size, attendance, available resources, language context, and barriers
 *   - For each flagged class: issue observed, supporting evidence, time period,
 *     curriculum area, possible reasons, suggested support actions
 *   - The HOD is responsible for decisions and interventions
 *   - Do not equate Pula's learning tiers with official DBE achievement codes
 *   - Generate summaries and explainable observations
 */

import { OBSERVATION_LEVELS } from '../../shared/activityDefinitions.js';

// ---------------------------------------------------------------------------
// Contextual factors that affect interpretation
// ---------------------------------------------------------------------------
const CONTEXTUAL_FACTORS = [
  { key: 'classSize', label: 'Class size', note: 'Large classes make individual attention harder' },
  { key: 'attendance', label: 'Attendance rate', note: 'Low attendance reduces practice opportunities' },
  { key: 'resources', label: 'Available resources', note: 'Limited resources affect activity variety' },
  { key: 'languageContext', label: 'Language context', note: 'Additional language learners may need more support' },
  { key: 'teacherExperience', label: 'Teacher experience', note: 'Newer teachers may need more HOD support' },
];

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Generate an HOD quality assurance report for a grade and subject.
 *
 * @param {object} ctx
 *   ctx.grade          — 'R' | '1' | '2' | '3'
 *   ctx.subject        — 'English' | 'Mathematics'
 *   ctx.classAnalytics — array of class analytics objects (from aggregateClassEvidence)
 *   ctx.context        — contextual factors (optional):
 *     { classSize, attendance, resources, languageContext, teacherExperience }
 *   ctx.interventionLog — array of recorded interventions (optional):
 *     [{ learnerId, date, action, followUpDate, resolved }]
 *   ctx.consentStats   — { total, withConsent, withoutConsent }
 * @returns {object} HOD QA report
 */
export function generateHodReport(ctx) {
  const {
    grade, subject, classAnalytics = [], context = {},
    interventionLog = [], consentStats = null,
  } = ctx;

  const report = {
    grade,
    subject,
    generatedAt: new Date().toISOString(),
    totalClasses: classAnalytics.length,
    totalLearners: classAnalytics.reduce((sum, c) => sum + (c.totalLearners || 0), 0),
    flags: [],
    strengths: [],
    recommendations: [],
    contextualFactors: assessContext(context),
    consentStatus: assessConsent(consentStats),
    interventionFollowUp: assessInterventions(interventionLog),
    summary: '',
    confidence: 'low',
  };

  // Analyse each class
  for (const cls of classAnalytics) {
    const classFlags = analyseClass(cls, context);
    report.flags.push(...classFlags);

    // Collect class strengths
    if (cls.classStrengths?.length > 0) {
      report.strengths.push({
        classroomName: cls.classroomName,
        strengths: cls.classStrengths,
      });
    }
  }

  // Generate recommendations
  report.recommendations = generateHodRecommendations(report, context);

  // Overall confidence
  const classesWithEvidence = classAnalytics.filter(c => c.confidence === 'medium').length;
  report.confidence = classesWithEvidence >= classAnalytics.length * 0.5 ? 'medium' : 'low';

  // Build summary
  report.summary = buildHodSummary(report);

  return report;
}

/**
 * Analyse a single class for HOD flags.
 * For each flag: issue, evidence, time period, curriculum area, possible reasons, suggested action.
 */
function analyseClass(cls, context) {
  const flags = [];

  // Flag 1: Common skill gaps affecting many learners
  for (const gap of (cls.commonSkillGaps || [])) {
    flags.push({
      classroomName: cls.classroomName,
      issue: `${gap.percentage}% of learners (${gap.learnersAffected}) are struggling with ${gap.activityName}`,
      evidence: `Class analytics: ${gap.learnersAffected} of ${cls.totalLearners} learners classified as NEEDS_FURTHER_PRACTICE`,
      timePeriod: 'Current term',
      curriculumArea: gap.skillId,
      possibleReasons: buildPossibleReasons(gap, context),
      suggestedActions: [
        `Observe a ${gap.activityName} lesson in this class to understand the teaching approach`,
        `Discuss with the teacher whether a different strategy or more practice time is needed`,
        `Consider providing additional resources or a small-group intervention for struggling learners`,
      ],
      severity: gap.percentage >= 60 ? 'high' : gap.percentage >= 40 ? 'medium' : 'low',
    });
  }

  // Flag 2: Low class average
  if (cls.classAverageScore != null && cls.classAverageScore < 50) {
    flags.push({
      classroomName: cls.classroomName,
      issue: `Class average is ${cls.classAverageScore}%, below the 50% threshold`,
      evidence: `Average across ${cls.totalLearners} learners' scored activities`,
      timePeriod: 'Current term',
      curriculumArea: 'General',
      possibleReasons: buildPossibleReasons({ activityName: 'general class performance' }, context),
      suggestedActions: [
        'Review whether the pace of curriculum coverage is appropriate for this class',
        'Discuss with the teacher what support would be most helpful',
        'Consider whether attendance or language barriers are a factor',
      ],
      severity: 'high',
    });
  }

  // Flag 3: Many learners needing attention
  const attentionCount = cls.learnersNeedingAttention?.length ?? 0;
  const attentionPct = cls.totalLearners > 0 ? Math.round((attentionCount / cls.totalLearners) * 100) : 0;
  if (attentionPct >= 40) {
    flags.push({
      classroomName: cls.classroomName,
      issue: `${attentionCount} learners (${attentionPct}%) need additional support`,
      evidence: `Learners with identified skill gaps in class analytics`,
      timePeriod: 'Current term',
      curriculumArea: 'Multiple',
      possibleReasons: [
        'Class size may be too large for individual attention',
        'Some learners may have missed earlier foundational instruction',
        ...buildPossibleReasons({ activityName: 'general' }, context),
      ],
      suggestedActions: [
        'Consider splitting the class into smaller groups for targeted practice',
        'Review whether a teacher assistant or volunteer could help during activity time',
        'Discuss with the teacher which learners need the most urgent support',
      ],
      severity: attentionPct >= 60 ? 'high' : 'medium',
    });
  }

  // Flag 4: Insufficient evidence
  const insufficient = cls.tierDistribution?.[OBSERVATION_LEVELS.INSUFFICIENT_EVIDENCE] ?? 0;
  if (insufficient > 0 && cls.totalLearners > 0) {
    const insPct = Math.round((insufficient / cls.totalLearners) * 100);
    if (insPct >= 30) {
      flags.push({
        classroomName: cls.classroomName,
        issue: `${insufficient} learners (${insPct}%) have insufficient recorded evidence`,
        evidence: `Class analytics: ${insufficient} learners with no scored sessions`,
        timePeriod: 'Current term',
        curriculumArea: 'All',
        possibleReasons: [
          'Activities may not have been recorded consistently',
          'Some learners may be absent frequently',
          'Consent may not be recorded for all learners',
        ],
        suggestedActions: [
          'Check whether all learners have consent recorded',
          'Discuss with the teacher whether activities are being completed regularly',
          'Prioritise recording sessions for learners with no evidence',
        ],
        severity: insPct >= 50 ? 'high' : 'medium',
      });
    }
  }

  return flags;
}

/**
 * Build possible reasons for a flag, considering contextual factors.
 * Key principle: do NOT conclude a teacher is underperforming solely because scores are low.
 */
function buildPossibleReasons(gap, context) {
  const reasons = [];

  // Curriculum-related reasons (not teacher-related)
  reasons.push(`${gap.activityName} is a foundational skill that some children take longer to master`);
  reasons.push('The concept may have been introduced recently and needs more practice time');

  // Contextual factors
  if (context.classSize && context.classSize > 35) {
    reasons.push(`Large class size (${context.classSize} learners) makes individual attention harder`);
  }
  if (context.attendance && context.attendance < 80) {
    reasons.push(`Low attendance rate (${context.attendance}%) reduces practice opportunities`);
  }
  if (context.languageContext === 'additional_language') {
    reasons.push('Some learners may be learning in an additional language, which can affect pace');
  }
  if (context.resources === 'limited') {
    reasons.push('Limited resources may affect the variety of teaching approaches available');
  }

  return reasons;
}

/**
 * Assess contextual factors and note which are present.
 */
function assessContext(context) {
  const factors = [];
  for (const f of CONTEXTUAL_FACTORS) {
    if (context[f.key] != null) {
      factors.push({
        factor: f.label,
        value: context[f.key],
        note: f.note,
      });
    }
  }
  return factors;
}

/**
 * Assess consent status across the grade.
 */
function assessConsent(consentStats) {
  if (!consentStats || consentStats.total === 0) return { status: 'unknown', note: 'Consent data not available.' };
  const pct = Math.round((consentStats.withConsent / consentStats.total) * 100);
  if (pct < 80) {
    return {
      status: 'attention_required',
      percentage: pct,
      note: `${consentStats.withoutConsent} learners (${100 - pct}%) do not have consent recorded. No consent-dependent data can be processed for these learners.`,
    };
  }
  return {
    status: 'good',
    percentage: pct,
    note: `${pct}% of learners have consent recorded.`,
  };
}

/**
 * Assess intervention follow-up status.
 */
function assessInterventions(interventionLog) {
  if (!interventionLog || interventionLog.length === 0) {
    return { total: 0, pending: 0, resolved: 0, note: 'No interventions recorded.' };
  }
  const pending = interventionLog.filter(i => !i.resolved);
  const resolved = interventionLog.filter(i => i.resolved);
  return {
    total: interventionLog.length,
    pending: pending.length,
    resolved: resolved.length,
    overdue: pending.filter(i => i.followUpDate && new Date(i.followUpDate) < new Date()).length,
    note: pending.length > 0
      ? `${pending.length} intervention${pending.length !== 1 ? 's' : ''} pending follow-up.`
      : 'All recorded interventions have been followed up.',
  };
}

/**
 * Generate HOD-level recommendations.
 */
function generateHodRecommendations(report, context) {
  const recs = [];

  // High-severity flags need urgent attention
  const highFlags = report.flags.filter(f => f.severity === 'high');
  if (highFlags.length > 0) {
    recs.push({
      priority: 'urgent',
      recommendation: `${highFlags.length} high-severity flag${highFlags.length !== 1 ? 's' : ''} require immediate HOD review. Schedule a meeting with the affected teacher(s) this week.`,
    });
  }

  // Consent issues
  if (report.consentStatus?.status === 'attention_required') {
    recs.push({
      priority: 'high',
      recommendation: `Consent follow-up needed: ${report.consentStatus.note} Contact families or arrange a parent meeting to complete consent forms.`,
    });
  }

  // Intervention follow-up
  if (report.interventionFollowUp?.overdue > 0) {
    recs.push({
      priority: 'high',
      recommendation: `${report.interventionFollowUp.overdue} intervention${report.interventionFollowUp.overdue !== 1 ? 's' : ''} overdue for follow-up. Review the intervention log and schedule follow-up sessions.`,
    });
  }

  // Resource needs
  if (context.resources === 'limited' && report.flags.length > 0) {
    recs.push({
      priority: 'medium',
      recommendation: 'Limited resources may be contributing to the identified issues. Consider requesting additional teaching materials or sharing resources across classes.',
    });
  }

  // Curriculum coverage
  if (report.totalClasses > 0 && report.flags.length === 0) {
    recs.push({
      priority: 'low',
      recommendation: 'No significant issues flagged. Continue monitoring and encourage consistent recording of activity sessions.',
    });
  }

  // Strengths recognition
  if (report.strengths.length > 0) {
    recs.push({
      priority: 'low',
      recommendation: `Recognise teachers whose classes show strengths: ${report.strengths.map(s => s.classroomName).join(', ')}. Consider sharing successful approaches with other teachers.`,
    });
  }

  return recs;
}

/**
 * Build the HOD summary in plain language.
 */
function buildHodSummary(report) {
  const parts = [];

  parts.push(`HOD Quality Assurance Report: Grade ${report.grade}, ${report.subject}.`);
  parts.push(`${report.totalClasses} class${report.totalClasses !== 1 ? 'es' : ''}, ${report.totalLearners} learners analysed.`);

  if (report.flags.length === 0) {
    parts.push('No significant issues flagged this term.');
  } else {
    const high = report.flags.filter(f => f.severity === 'high').length;
    const med = report.flags.filter(f => f.severity === 'medium').length;
    parts.push(`${report.flags.length} flag${report.flags.length !== 1 ? 's' : ''} identified${high > 0 ? ` (${high} high severity)` : ''}.`);
  }

  if (report.consentStatus?.status === 'attention_required') {
    parts.push(`Consent: ${report.consentStatus.note}`);
  }

  if (report.interventionFollowUp?.pending > 0) {
    parts.push(`${report.interventionFollowUp.pending} intervention${report.interventionFollowUp.pending !== 1 ? 's' : ''} pending follow-up.`);
  }

  if (report.strengths.length > 0) {
    parts.push(`${report.strengths.length} class strength${report.strengths.length !== 1 ? 's' : ''} identified.`);
  }

  parts.push(`Confidence: ${report.confidence}.`);

  return parts.join(' ');
}
