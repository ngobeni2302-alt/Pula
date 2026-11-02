/**
 * guardrails.js
 * CAPS policy checks and hard safety rules for Lesedi.
 * Every request passes through checkGuardrails() before the engine runs.
 * If a rule fires, Lesedi returns the refusal text — the AI model is never called.
 *
 * Updated for dataset v3:
 *  - child_tutor added to the consent gate
 *  - Task list expanded: child_hint | child_tutor | teacher_activity | class_insight |
 *    gap_explanation | hod_insight | parent_note | guardrail
 */

const POLICIES = {
  no_consent: {
    text: "I can't write a note or look at this learner's data yet, because their parent's consent isn't recorded. Once consent is recorded I can help. Meanwhile I can draft a short consent request for you to approve and send. Do you want that?",
    tags: ['consent_required', 'no_processing_without_consent', 'teacher_approval_required'],
  },
  grade_r_no_test: {
    text: "Grade R assessment is informal and not a test situation, so I won't make a marked test. I can make an observation checklist instead, using the CAPS items for this term, so you can record what each child shows during normal activities.",
    tags: ['caps_policy', 'redirects_to_checklist', 'observation_not_test'],
  },
  no_direct_answer: {
    text: "I won't give answers directly to children, because they learn by trying. I can give hints in steps, and pass to you when a child is stuck. Do you want me to draft a hint set for this activity for you to approve?",
    tags: ['no_answer_given', 'hint_ladder', 'teacher_approval_required'],
  },
  no_rewrite_child_work: {
    text: "I won't rewrite a child's work, because the writing is theirs. I can give you a checklist for them to use themselves: capital letters, full stops, inverted commas, past tense. I can also draft two questions for you to ask them about their own writing. Do you want that?",
    tags: ['no_answer_given', 'child_does_the_work', 'teacher_approval_required'],
  },
  no_reading_groups_without_evidence: {
    text: "I can't place children into reading groups without evidence. CAPS groups children by the text level they read with 90 to 95% accuracy. If you record a short oral reading of each child, I will show you how the results sort into groups. The groups stay yours to change.",
    tags: ['no_guessing', 'evidence_needed', 'teacher_decides', 'caps_policy'],
  },
  no_pii: {
    text: "Thanks, but I don't need or use phone numbers, and I won't repeat it. Pula sends notes using the contact already saved. Tell me what you want the note to say and which language and channel, and I will draft it for your approval.",
    tags: ['no_pii', 'teacher_approval_required'],
  },
  insufficient_evidence: {
    text: "I can't explain this learner's group yet. I have too few observations to be fair to the child. Please add more observations over the next few weeks and I will show you the evidence. (My threshold of 3 or more is a draft — confirm or change.)",
    tags: ['insufficient_evidence', 'no_guessing', 'teacher_decides'],
  },
};

// Tasks that require learner consent before any processing
const CONSENT_GATED_TASKS = new Set([
  'child_hint',
  'child_tutor',    // v3 addition
  'gap_explanation',
  'parent_note',
  'class_insight',  // only if a specific learner is named
]);

const TEXT_RULES = [
  { pattern: /\b(test|marks|score out of|graded test)\b/i, gradeROnly: true,  policy: 'grade_r_no_test' },
  { pattern: /\bgive\s+(the\s+)?answers?\b/i,              gradeROnly: false, policy: 'no_direct_answer' },
  { pattern: /\brewrite\s+(a\s+child|the\s+child|their|his|her)\b/i, gradeROnly: false, policy: 'no_rewrite_child_work' },
  { pattern: /phone\s*number|\+27|0[678]\d{8}/,            gradeROnly: false, policy: 'no_pii' },
];

/**
 * Check all guardrails for an incoming Lesedi request.
 *
 * @param {object} ctx
 *   ctx.task         {string}  child_hint | child_tutor | teacher_activity | class_insight |
 *                              gap_explanation | hod_insight | parent_note | guardrail
 *   ctx.grade        {string}  'R' | '1' | '2' | '3'
 *   ctx.learner      {object=} optional — may include .consent
 *   ctx.requestText  {string=} the teacher's raw typed question
 *   ctx.observations {array=}
 * @returns {{ blocked: boolean, policy?: string, response?: object }}
 */
export function checkGuardrails(ctx) {
  const { task, grade, learner, requestText = '', observations = [] } = ctx;

  // 1. Consent gate — any task that touches learner data
  if (learner && learner.consent === false && CONSENT_GATED_TASKS.has(task)) {
    return blocked('no_consent');
  }

  // 2. Grade R formal test (explicit check before text rules)
  if (grade === 'R' && /\b(test|marks|graded)\b/i.test(requestText)) {
    return blocked('grade_r_no_test');
  }

  // 3. Text-pattern rules
  for (const rule of TEXT_RULES) {
    if (!rule.pattern.test(requestText)) continue;
    if (rule.gradeROnly && grade !== 'R') continue;
    return blocked(rule.policy);
  }

  // 4. Gap analysis with too few observations
  if (task === 'gap_explanation' && observations.length > 0 && observations.length < 3) {
    return blocked('insufficient_evidence');
  }

  // 5. Reading group placement without evidence
  if (
    task === 'teacher_activity' &&
    /\b(reading\s+groups?|group\s+placement)\b/i.test(requestText) &&
    !observations.length
  ) {
    return blocked('no_reading_groups_without_evidence');
  }

  return { blocked: false };
}

function blocked(policyKey) {
  const p = POLICIES[policyKey];
  return {
    blocked:  true,
    policy:   policyKey,
    response: { text: p.text, tags: p.tags, source: 'guardrail', requiresApproval: false },
  };
}

export { POLICIES };
