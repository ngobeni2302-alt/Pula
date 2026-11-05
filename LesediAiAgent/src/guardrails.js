/**
 * guardrails.js
 * All hard rules that block or redirect Lesedi requests.
 *
 * POLICY SOURCES — clearly tagged on every policy:
 *   'CAPS'     Direct CAPS curriculum requirement.
 *              Reference given. Lesedi must cite this source in the response.
 *   'POPIA'    South African Protection of Personal Information Act.
 *              Applies to all learner data, consent, and contact details.
 *   'PROJECT'  Internal Pula project rule — agreed by teachers and HODs,
 *              not from CAPS or law. Can be changed by the project team.
 *   'PEDAGOGY' Sound teaching principle. Not from a single document but
 *              underpins all hint-ladder and draft-approval behaviour.
 *
 * SEPARATION RATIONALE
 *   When a teacher asks "Why won't Lesedi do that?", the answer should be
 *   "CAPS says so", "POPIA requires it", or "our school policy is…" —
 *   not a vague refusal. Source tags make that auditable.
 */

import { HOD_ALERTS } from './tierRules.js';

// ---------------------------------------------------------------------------
// Policy definitions — source-tagged
// ---------------------------------------------------------------------------
export const POLICIES = {

  // ── POPIA ──────────────────────────────────────────────────────────────
  no_consent: {
    source: 'POPIA',
    capsRef: null,
    text: "I can't write a note or look at this learner's data yet, because their parent's consent isn't recorded. Once consent is recorded I can help. Meanwhile I can draft a short consent request for you to approve and send. Do you want that?",
    tags: ['consent_required', 'no_processing_without_consent', 'teacher_approval_required'],
  },
  no_pii: {
    source: 'POPIA',
    capsRef: null,
    text: "Thanks, but I don't need or use phone numbers, and I won't repeat it. Pula sends notes using the contact already saved. Tell me what you want the note to say and which language and channel, and I will draft it for your approval.",
    tags: ['no_pii', 'teacher_approval_required'],
  },

  // ── CAPS ───────────────────────────────────────────────────────────────
  grade_r_no_test: {
    source: 'CAPS',
    capsRef: 'CAPS HL Gr R p.21; Teacher\'s Guide p.11',
    text: "Grade R assessment is informal and not a test situation, so I won't make a marked test. I can make an observation checklist instead, using the CAPS items for this term, so you can record what each child shows during normal activities.",
    tags: ['caps_policy', 'redirects_to_checklist', 'observation_not_test'],
  },
  no_reading_groups_without_evidence: {
    source: 'CAPS',
    capsRef: 'CAPS HL Gr 1 p.57 — same-ability groups at 90–95% word accuracy',
    text: "I can't place children into reading groups without evidence. CAPS groups children by the text level they read with 90 to 95% accuracy. If you record a short oral reading of each child, I will show you how the results sort into groups. The groups stay yours to change.",
    tags: ['no_guessing', 'evidence_needed', 'teacher_decides', 'caps_policy'],
  },
  no_maths_test_grade_r: {
    source: 'CAPS',
    capsRef: 'CAPS Maths Gr R p.7 — assessment is informal and observational',
    text: "Grade R maths is assessed through observation during play and routine activities, not formal tests. I can draft an observation checklist using the CAPS maths items for this term if that would help.",
    tags: ['caps_policy', 'redirects_to_checklist', 'observation_not_test', 'maths'],
  },

  // ── PEDAGOGY ───────────────────────────────────────────────────────────
  no_direct_answer: {
    source: 'PEDAGOGY',
    capsRef: null,
    text: "I won't give answers directly to children, because they learn by trying. I can give hints in steps, and pass to you when a child is stuck. Do you want me to draft a hint set for this activity for you to approve?",
    tags: ['no_answer_given', 'hint_ladder', 'teacher_approval_required'],
  },
  no_rewrite_child_work: {
    source: 'PEDAGOGY',
    capsRef: null,
    text: "I won't rewrite a child's work, because the writing is theirs. I can give you a checklist for them to use themselves: capital letters, full stops, inverted commas, past tense. I can also draft two questions for you to ask them about their own writing. Do you want that?",
    tags: ['no_answer_given', 'child_does_the_work', 'teacher_approval_required'],
  },
  no_solve_maths_for_child: {
    source: 'PEDAGOGY',
    capsRef: null,
    text: "I won't give a child the maths answer directly, because working it out is how they learn. I can give a hint — like showing a simpler version of the same problem — and then let them try again. Do you want me to draft a hint for this problem for you to approve?",
    tags: ['no_answer_given', 'hint_ladder', 'teacher_approval_required', 'maths'],
  },

  // ── PROJECT ────────────────────────────────────────────────────────────
  insufficient_evidence: {
    source: 'PROJECT',
    capsRef: null,
    text: "I can't explain this learner's group yet. I have too few observations to be fair to the child. Please add more observations over the next few weeks and I will show you the evidence. (My threshold of 3 or more is a draft — confirm or change.)",
    tags: ['insufficient_evidence', 'no_guessing', 'teacher_decides'],
  },
  no_group_without_maths_evidence: {
    source: 'PROJECT',
    capsRef: null,
    text: "I can't suggest a maths group placement without any observations. Please record what strategy the child uses — for example, does she count all, count on, or calculate mentally? With 3 or more observations I can explain the group and suggest a next step.",
    tags: ['insufficient_evidence', 'no_guessing', 'teacher_decides', 'maths'],
  },
  consent_overdue: {
    source: 'PROJECT',
    capsRef: null,
    text: "This learner has been in the system for more than 2 weeks without a parent consent record. The HOD should be notified. I can't process this learner's data until consent is recorded. Would you like me to draft a consent request for the teacher to approve and send?",
    tags: ['consent_required', 'hod_flag_consent_overdue', 'teacher_approval_required'],
  },
};

// ---------------------------------------------------------------------------
// Tasks that require learner consent before any processing (POPIA)
// ---------------------------------------------------------------------------
const CONSENT_GATED_TASKS = new Set([
  'child_hint',
  'child_tutor',
  'gap_explanation',
  'parent_note',
  'class_insight',
]);

// ---------------------------------------------------------------------------
// Text-pattern rules — scanned against the teacher's raw requestText
// ---------------------------------------------------------------------------
const TEXT_RULES = [
  // CAPS: Grade R formal test (literacy or maths)
  {
    source:      'CAPS',
    pattern:     /\b(test|marks|score out of|graded test)\b/i,
    gradeROnly:  true,
    subjectMatch: null,  // applies to both subjects for Grade R
    policy:      'grade_r_no_test',
  },
  // CAPS: Grade R maths test specifically
  {
    source:      'CAPS',
    pattern:     /\b(maths?\s+test|number\s+test|times\s+table\s+test)\b/i,
    gradeROnly:  true,
    subjectMatch: 'maths',
    policy:      'no_maths_test_grade_r',
  },
  // PEDAGOGY: giving a child the answer (literacy)
  {
    source:      'PEDAGOGY',
    pattern:     /\bgive\s+(the\s+)?answers?\b/i,
    gradeROnly:  false,
    subjectMatch: null,
    policy:      'no_direct_answer',
  },
  // PEDAGOGY: solving maths for a child
  {
    source:      'PEDAGOGY',
    pattern:     /\bsolve\s+(it|the\s+problem|this)\s+for\s+(the\s+child|them|him|her)\b/i,
    gradeROnly:  false,
    subjectMatch: 'maths',
    policy:      'no_solve_maths_for_child',
  },
  // PEDAGOGY: rewriting a child's written work
  {
    source:      'PEDAGOGY',
    pattern:     /\brewrite\s+(a\s+child|the\s+child|their|his|her)\b/i,
    gradeROnly:  false,
    subjectMatch: null,
    policy:      'no_rewrite_child_work',
  },
  // POPIA: phone numbers in the request
  {
    source:      'POPIA',
    pattern:     /phone\s*number|\+27|0[678]\d{8}/,
    gradeROnly:  false,
    subjectMatch: null,
    policy:      'no_pii',
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check all guardrails for an incoming Lesedi request.
 *
 * @param {object} ctx
 *   ctx.task         {string}   child_hint | child_tutor | teacher_activity |
 *                               class_insight | gap_explanation | hod_insight |
 *                               parent_note | guardrail
 *   ctx.grade        {string}   'R' | '1' | '2' | '3'
 *   ctx.subject      {string=}  'literacy' | 'maths' — defaults to 'literacy'
 *   ctx.learner      {object=}  optional — may include .consent
 *   ctx.requestText  {string=}  the teacher's raw typed question
 *   ctx.observations {array=}
 * @returns {{ blocked: boolean, policy?: string, source?: string, response?: object }}
 */
export function checkGuardrails(ctx) {
  const {
    task,
    grade,
    subject = 'literacy',
    learner,
    requestText = '',
    observations = learner?.observations ?? [],
  } = ctx;

  // 1. POPIA: Consent gate — learner explicitly has no consent
  if (learner && learner.consent === false && CONSENT_GATED_TASKS.has(task)) {
    return blocked('no_consent');
  }

  // 1b. PROJECT: Consent overdue — learner has been in system > no_consent_max_weeks
  //     with no consent recorded (consent is null/undefined, not false).
  //     This fires for hod_insight and gap_explanation to flag the HOD.
  if (
    learner &&
    learner.consent == null &&
    learner.weeksInSystem != null &&
    Number(learner.weeksInSystem) > HOD_ALERTS.no_consent_max_weeks &&
    CONSENT_GATED_TASKS.has(task)
  ) {
    return blocked('consent_overdue');
  }

  // 2. CAPS: Grade R formal test (direct check before text rules)
  if (grade === 'R' && /\b(test|marks|graded)\b/i.test(requestText)) {
    return blocked(subject === 'maths' ? 'no_maths_test_grade_r' : 'grade_r_no_test');
  }

  // 3. Text-pattern rules (order matters — most specific first)
  for (const rule of TEXT_RULES) {
    if (!rule.pattern.test(requestText)) continue;
    if (rule.gradeROnly && grade !== 'R') continue;
    if (rule.subjectMatch && rule.subjectMatch !== subject) continue;
    return blocked(rule.policy);
  }

  // 4. PROJECT: Gap analysis with too few observations
  if (task === 'gap_explanation' && observations.length > 0 && observations.length < 3) {
    return blocked('insufficient_evidence');
  }

  // 5. CAPS: Reading group placement without evidence
  if (
    task === 'teacher_activity' &&
    subject === 'literacy' &&
    /\b(reading\s+groups?|group\s+placement)\b/i.test(requestText) &&
    !observations.length
  ) {
    return blocked('no_reading_groups_without_evidence');
  }

  // 6. PROJECT: Maths group placement without evidence
  if (
    task === 'gap_explanation' &&
    subject === 'maths' &&
    observations.length === 0
  ) {
    return blocked('no_group_without_maths_evidence');
  }

  return { blocked: false };
}

function blocked(policyKey) {
  const p = POLICIES[policyKey];
  return {
    blocked:  true,
    policy:   policyKey,
    source:   p.source,
    capsRef:  p.capsRef ?? null,
    response: {
      text:    p.text,
      tags:    p.tags,
      source:  'guardrail',
      policySource: p.source,
      capsRef: p.capsRef ?? null,
      requiresApproval: false,
    },
  };
}
