/**
 * parentCopilot.js
 * Analytics-enhanced parent communication drafting.
 *
 * This module builds on the analytics engine (Phase 3) to draft
 * meaningful, evidence-based parent communications:
 *   - Progress updates (per session or multi-session summary)
 *   - Home-learning activities (linked to actual skill gaps)
 *   - Term progress reports (longer, comprehensive)
 *   - Response to parent questions (with context)
 *
 * KEY PRINCIPLES:
 *   - Nothing is automatically sent — teacher must approve
 *   - Never independently contact a parent
 *   - Do not compare to other children
 *   - Do not diagnose learning difficulties
 *   - Use plain language for parents
 *   - Make suggestions practical for South African households
 *   - Maintain draft → approved → sent statuses
 *   - All outputs are marked "Draft for teacher approval"
 */

import { getActivityDefinition } from '../../shared/activityDefinitions.js';
import { OBSERVATION_LEVELS } from '../../shared/activityDefinitions.js';

// ---------------------------------------------------------------------------
// Home-learning activity suggestions (practical for SA households)
// ---------------------------------------------------------------------------
const HOME_ACTIVITIES = {
  // Literacy
  'HL-READING-FLUENCY': [
    'Read one short page together each night. Ask your child to point to each word as they read.',
    'Share a story together before bed. Let your child turn the pages and talk about the pictures.',
    'Look at a food label or shop sign together. Ask your child to find letters they know.',
  ],
  'HL-RHYME-RECOGNITION': [
    'Say two words and ask your child if they sound the same at the end (cat/hat vs cat/dog).',
    'Make up silly rhymes together while cooking or walking. "What rhymes with pot? Dot, hot, lot!"',
    'Sing a nursery rhyme together. Pause and let your child fill in the rhyming word.',
  ],
  'HL-PHONEME-BLENDING': [
    'Say the sounds of a short word slowly (s-u-n) and ask your child to blend them together.',
    'Use fridge magnets or write letters on paper. Push them together as you say the sounds.',
    'Play "I Spy" with sounds: "I spy with my little eye something beginning with mmm."',
  ],
  // Mathematics
  'MATHS-NUMBER-RECOGNITION': [
    'Look for numbers around the house — on a clock, a phone, a bus. Ask your child to name them.',
    'Write numbers 1 to 10 on paper. Point to one and ask your child to find the same number of objects.',
    'Count steps as you walk up them together. Then count backwards coming down.',
  ],
  'MATHS-ONE-TO-ONE-COUNTING': [
    'Count five objects together at home — spoons, shoes, stones. Touch each one as you count.',
    'Ask your child to set the table: "Can you put out four plates? Count them as you go."',
    'Sort washing into piles and count each pile together.',
  ],
};

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Draft a short parent note based on a single session result.
 * Enhanced with observation level and evidence classification.
 *
 * @param {object} ctx
 *   ctx.learnerName     — child's first name
 *   ctx.activityName    — e.g. "Number Hunt"
 *   ctx.subject         — 'English' | 'Mathematics'
 *   ctx.score           — percentage or null for participation
 *   ctx.total           — total rounds
 *   ctx.correct         — correct first choices
 *   ctx.observationLevel — from evaluation engine
 *   ctx.curriculumSkillId — for home activity lookup
 *   ctx.transcriptAvailable — whether speech was captured
 * @returns {{ text: string, homeActivity: string|null, source: string, requiresApproval: boolean }}
 */
export function draftParentNote(ctx) {
  const {
    learnerName, activityName, subject, score, total, correct,
    observationLevel, curriculumSkillId, transcriptAvailable,
  } = ctx;

  const homeActivity = pickHomeActivity(curriculumSkillId, subject);
  const parts = [];

  // Opening — warm and personal
  parts.push(`${learnerName} practised ${activityName} today.`);

  // Evidence summary — plain language, no diagnosis
  if (score != null && total > 0) {
    if (observationLevel === OBSERVATION_LEVELS.DEMONSTRATED) {
      parts.push(`${learnerName} did well — ${correct} of ${total} correct on the first try.`);
    } else if (observationLevel === OBSERVATION_LEVELS.DEVELOPING) {
      parts.push(`${learnerName} is getting there — ${correct} of ${total} correct, with some help from Lesedi.`);
    } else if (observationLevel === OBSERVATION_LEVELS.NEEDS_FURTHER_PRACTICE) {
      parts.push(`${learnerName} tried hard and got ${correct} of ${total}. We will keep practising this skill.`);
    } else {
      parts.push(`${learnerName} completed the activity. Teacher will review the details.`);
    }
  } else {
    // Participation activity
    if (transcriptAvailable) {
      parts.push(`${learnerName} read aloud and did their best. Listen to them read at home to see how they are doing.`);
    } else {
      parts.push(`${learnerName} participated and tried their best today.`);
    }
  }

  // Home activity suggestion — practical and specific
  if (homeActivity) {
    parts.push(`At home: ${homeActivity}`);
  }

  // Closing
  parts.push(`Thank you for your support.`);

  const text = parts.join(' ');

  return {
    text,
    homeActivity,
    source: 'parent_copilot',
    requiresApproval: true,
    metadata: {
      observationLevel,
      curriculumSkillId,
      charCount: text.length,
      channel: text.length <= 160 ? 'SMS' : 'WhatsApp',
    },
  };
}

/**
 * Draft a term progress report for a learner.
 * This is a longer, comprehensive summary based on aggregated analytics.
 *
 * @param {object} ctx
 *   ctx.learnerName    — child's first name
 *   ctx.subject        — 'English' | 'Mathematics'
 *   ctx.grade          — 'R' | '1' | '2' | '3'
 *   ctx.term           — 1–4
 *   ctx.analytics      — output from aggregateLearnerEvidence()
 *   ctx.teacherName    — for the closing line
 * @returns {{ text: string, source: string, requiresApproval: boolean, sections: object }}
 */
export function draftTermReport(ctx) {
  const { learnerName, subject, grade, term, analytics, teacherName } = ctx;

  const sections = {
    opening: `Dear family,\n\nHere is a summary of ${learnerName}'s ${subject} progress for Term ${term}, Grade ${grade}.`,
    overview: '',
    strengths: [],
    areas: [],
    homeActivities: [],
    closing: '',
  };

  // Overview
  if (analytics.totalSessions === 0) {
    sections.overview = `${learnerName} has not yet completed any recorded activities this term. I encourage you to support ${learnerName} at home with the activities below.`;
  } else {
    const weeks = analytics.observationPeriod?.weeks ?? 1;
    sections.overview = `${learnerName} completed ${analytics.totalSessions} activit${analytics.totalSessions !== 1 ? 'ies' : 'y'} over ${weeks} week${weeks !== 1 ? 's' : ''} this term.`;
    if (analytics.averageScore != null) {
      sections.overview += ` Average score: ${analytics.averageScore}%.`;
    }
    if (analytics.overallTrend === 'improving') {
      sections.overview += ` ${learnerName} is making good progress.`;
    } else if (analytics.overallTrend === 'declining') {
      sections.overview += ` ${learnerName} may need some extra support at home.`;
    } else {
      sections.overview += ` ${learnerName} is progressing steadily.`;
    }
  }

  // Strengths
  for (const s of (analytics.strengths || [])) {
    sections.strengths.push(`${learnerName} is doing well with ${s.activityName}.`);
  }

  // Areas for growth
  for (const g of (analytics.skillGaps || [])) {
    const activity = pickHomeActivity(g.skillId, subject);
    sections.areas.push(`${learnerName} is still learning ${g.activityName.toLowerCase()}. This is normal — we are working on it together at school.`);
    if (activity) {
      sections.homeActivities.push(activity);
    }
  }

  // If no specific gaps, add a general home activity
  if (sections.homeActivities.length === 0) {
    const generalActivity = subject === 'Mathematics'
      ? 'Count familiar objects together at home — spoons, steps, or stones. Touch each one as you count.'
      : 'Read a short story together each night. Let your child point to the words as you read.';
    sections.homeActivities.push(generalActivity);
  }

  // Build the full text
  const lines = [sections.opening, '', sections.overview];

  if (sections.strengths.length > 0) {
    lines.push('', 'What ' + learnerName + ' is doing well:');
    lines.push(...sections.strengths.map(s => `  • ${s}`));
  }

  if (sections.areas.length > 0) {
    lines.push('', 'Areas we are working on:');
    lines.push(...sections.areas.map(a => `  • ${a}`));
  }

  lines.push('', 'Home activities to support learning:');
  lines.push(...sections.homeActivities.map(a => `  • ${a}`));

  lines.push('', `Please contact me if you have any questions about ${learnerName}'s progress.`);
  lines.push('', `Warm regards,`, teacherName || 'Your child\'s teacher');

  const text = lines.join('\n');

  return {
    text,
    source: 'parent_copilot',
    requiresApproval: true,
    sections,
    metadata: {
      type: 'term_report',
      term,
      subject,
      grade,
      charCount: text.length,
    },
  };
}

/**
 * Draft a response to a parent's question.
 * Uses learner context to give a helpful, evidence-based answer.
 *
 * @param {object} ctx
 *   ctx.learnerName    — child's first name
 *   ctx.parentQuestion — the parent's question text
 *   ctx.analytics      — learner analytics (from aggregateLearnerEvidence)
 *   ctx.subject        — 'English' | 'Mathematics'
 * @returns {{ text: string, source: string, requiresApproval: boolean }}
 */
export function draftParentResponse(ctx) {
  const { learnerName, parentQuestion, analytics, subject } = ctx;

  const q = (parentQuestion || '').toLowerCase();
  const parts = [];

  // Acknowledge the question
  parts.push(`Thank you for asking about ${learnerName}.`);

  // Categorise the question and respond
  if (/how.*doing|progress|how is|how's/.test(q)) {
    if (analytics && analytics.totalSessions > 0) {
      parts.push(`${learnerName} has completed ${analytics.totalSessions} activit${analytics.totalSessions !== 1 ? 'ies' : 'y'} this term.`);
      if (analytics.averageScore != null) {
        parts.push(`The average score is ${analytics.averageScore}%.`);
      }
      if (analytics.overallTrend === 'improving') {
        parts.push(`${learnerName} is improving.`);
      } else if (analytics.overallTrend === 'declining') {
        parts.push(`${learnerName} may need some extra support. Here are some things you can do at home.`);
      } else {
        parts.push(`${learnerName} is progressing steadily.`);
      }
    } else {
      parts.push(`${learnerName} is still getting started with the activities. I will share more once we have a few sessions recorded.`);
    }
  } else if (/help|home|practise|support|what can i do/.test(q)) {
    const homeActivities = (analytics?.skillGaps || []).map(g => pickHomeActivity(g.skillId, subject)).filter(Boolean);
    if (homeActivities.length > 0) {
      parts.push(`Here are some things you can do at home:`);
      parts.push(...homeActivities.slice(0, 2).map(a => `  • ${a}`));
    } else {
      parts.push(subject === 'Mathematics'
        ? 'Count familiar objects together at home — spoons, steps, or stones. Touch each one as you count.'
        : 'Read a short story together each night. Let your child point to the words as you read.');
    }
  } else if (/concern|worried|struggling|behind|difficulty/.test(q)) {
    parts.push(`Thank you for sharing your concern. ${learnerName} is working hard in class.`);
    if (analytics?.skillGaps?.length > 0) {
      parts.push(`We are focusing on ${analytics.skillGaps.map(g => g.activityName).join(' and ')} at school.`);
      parts.push(`With some practice at home, ${learnerName} can build confidence in these areas.`);
    } else {
      parts.push(`Every child learns at their own pace. Let's keep working together to support ${learnerName}.`);
    }
  } else {
    // Generic response
    parts.push(`I appreciate you reaching out. ${learnerName} is a valued member of our class.`);
    if (analytics?.totalSessions > 0) {
      parts.push(`I will share specific details about ${learnerName}'s activities when I have the next update ready.`);
    }
  }

  parts.push(`Please feel free to message me anytime.`);
  parts.push(`Draft for teacher approval.`);

  return {
    text: parts.join(' '),
    source: 'parent_copilot',
    requiresApproval: true,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pick a practical home-learning activity for a skill.
 * @param {string} curriculumSkillId
 * @param {string} subject — fallback subject
 * @returns {string|null}
 */
function pickHomeActivity(curriculumSkillId, subject) {
  const activities = HOME_ACTIVITIES[curriculumSkillId];
  if (!activities || activities.length === 0) {
    // Fallback based on subject
    return subject === 'Mathematics'
      ? 'Count five familiar objects together at home. Touch each one as you count.'
      : 'Share a short story together tonight. Let your child point to each word.';
  }
  // Pick a random activity from the list (variety each time)
  return activities[Math.floor(Math.random() * activities.length)];
}
