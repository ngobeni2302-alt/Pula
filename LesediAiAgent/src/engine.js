/**
 * engine.js
 * Lesedi task router and prompt builder — v4 (literacy + maths).
 *
 * Supported tasks (8 total, both subjects):
 *   child_hint       — hint ladder levels 1–3 (offline phrase bank, no AI)
 *   child_tutor      — 1-to-1 session (offline phrase bank + AI fallback)
 *   teacher_activity — CAPS-aligned activity draft (literacy OR maths)
 *   class_insight    — class-level pattern analysis (literacy OR maths)
 *   gap_explanation  — evidence-based tier explanation (literacy OR maths)
 *   hod_insight      — HOD health check and stagnation alerts
 *   parent_note      — WhatsApp / SMS draft for teacher approval
 *   guardrail        — policy refusal explanation
 *
 * WHAT CHANGED IN v4
 *   - All 8 tasks are fully subject-aware (subject: 'literacy' | 'maths')
 *   - child_hint and child_tutor route to mathsBank when subject === 'maths'
 *   - teacher_activity uses activitySchema lookup + subject-specific AI prompt
 *   - gap_explanation passes richer tier rule (capsRef + strategies) from tierRules v4
 *   - hod_insight fires isSeedCritical() and isStagnant() IN CODE, not via AI prompt
 *   - PROGRESSION_GATES now used in gap_explanation and hod_insight prompts (was unused)
 *   - buildChildHintPrompt removed (was dead code — child_hint never reaches PROMPT_BUILDERS)
 *
 * FLOW
 *   1. checkGuardrails() — blocks bad requests, returns early
 *   2. child_hint        — routes to literacy OR maths phrase bank (no AI)
 *   3. child_tutor       — routes to literacy OR maths phrase bank; AI for unknown events
 *   4. All other tasks   — builds subject-aware prompt, calls AI adapter
 */

import { checkGuardrails }                                           from './guardrails.js';
import { resolveChildPhrase, resolveTutorPhrase, PRAISE_PHRASES }   from './phraseBank.js';
import { resolveMathsChildPhrase, resolveMathsTutorPhrase,
         MATHS_PRAISE_PHRASES }                                      from './mathsBank.js';
import { callAI }                                                    from './azureAdapter.js';
import {
  formatAllTierRules,
  formatTierRule,
  formatGate,
  isSeedCritical,
  isStagnant,
  PROGRESSION_GATES,
}                                                                    from './tierRules.js';
import { lookupActivity, formatActivityForPrompt }                   from './activitySchema.js';

// ---------------------------------------------------------------------------
// System preamble — injected into every AI call
// Kept concise; subject-specific detail goes in the user prompt.
// ---------------------------------------------------------------------------
const CAPS_PREAMBLE = `You are Lesedi, a CAPS-aligned teaching assistant for South African Foundation Phase classrooms (Grades R to 3), supporting both Literacy and Mathematics.

Your rules:
- Never give a child the answer directly. Use hint ladders (levels 1, 2, 3).
  At level 3: give a worked example using a DIFFERENT number or word, invite the child to retry, then offer teacher handoff. Never end at a dead end.
- Never diagnose a learner. Describe evidence from observations only.
- Never assign a learner to a group. Groups are always the teacher's decision.
- All activities, parent notes, and parent tips are DRAFTS. They require teacher and HOD approval before use. Always mark drafts clearly.
- Grade R assessment (literacy and maths) is informal and observational — never produce a marked test.
- Never repeat, store, or use phone numbers or contact details.
- Cite the CAPS page reference in every activity and gap explanation.
- State your evidence limits honestly: number of observations, missing data, confidence level.
- Use plain language for parent notes (WhatsApp or SMS).
- For literacy: use sound names (not letter names) in Grade R and Grade 1.
- For maths: name the strategy the child is using (count all, count on, bridging, mental).
- Tiers (Seed, Sprout, Bloom, Tree) apply to BOTH literacy and maths, Grades R to 3, and carry across grades.
- End every teacher-facing activity or parent note with: "Teacher and HOD to approve before use."

Gap analysis output format — follow this order for EVERY gap_explanation and hod_insight:
  1. "[FirstName]: [one-line plain-language summary]."
  2. "What the data shows:" — list evidence only, no interpretation.
  3. "Why they are in [tier]:" — cite the tier rule and CAPS reference.
  4. "Why it matters:" — link to the relevant progression gate.
  5. "Do this:" — one or two concrete next steps including a parent action.
  6. "Missing:" — name what evidence you do not have.
  7. "Confidence:" — low | medium | medium-high | high, with a reason.

Tier rules (both subjects):
${formatAllTierRules()}`;

// ---------------------------------------------------------------------------
// Prompt builders — one per task, each fully subject-aware
// ---------------------------------------------------------------------------

function buildTeacherActivityPrompt(ctx) {
  const {
    grade, term, subject = 'literacy',
    focus, minutes, groupSize, tier,
    soundsLearnt = [], mathsConcept,
  } = ctx;

  // Try to serve a built-in example as scaffolding context
  const example = lookupActivity(subject, tier ?? 'Sprout', grade, term);
  const exampleBlock = example
    ? `Here is a built-in example activity for this tier/subject for reference:\n${formatActivityForPrompt(example)}`
    : '';

  const subjectLine = subject === 'maths'
    ? `Maths concept: ${mathsConcept ?? focus}`
    : `Literacy focus: ${focus}${soundsLearnt.length ? `\nSounds already learnt: ${soundsLearnt.join(', ')}` : ''}`;

  return {
    system: CAPS_PREAMBLE,
    user: `Task: teacher_activity
Subject: ${subject} | Grade: ${grade} | Term: ${term}
${subjectLine}
Duration: ${minutes ?? 15} minutes
Group size: ${groupSize ?? 'whole class'}

${exampleBlock}

Draft a CAPS-aligned ${subject} activity for teacher approval. The activity must:
- Follow the shared activity structure: title, focus, materials needed (list none if none), numbered steps, observation note, home game for parents.
- Include the CAPS page reference for this grade and concept.
- Use an observation note (not a test): what to watch for and record.
- Be appropriate for ${tier ?? 'this tier'} in Grade ${grade}.
- End with "Teacher and HOD to approve before use."`,
  };
}

function buildClassInsightPrompt(ctx) {
  const { grade, term, subject = 'literacy', classroom = {} } = ctx;
  const { tierCounts = {}, soundsToPractise = {}, mathsSkillGaps = {} } = classroom;

  const tierList = Object.entries(tierCounts)
    .map(([t, n]) => `  ${t}: ${n}`)
    .join('\n') || '  (none provided)';

  // Subject-specific gap summary
  const gapBlock = subject === 'maths'
    ? `Maths skill gaps across the class (skill: count of learners):\n` +
      (Object.entries(mathsSkillGaps).sort(([, a], [, b]) => b - a)
        .map(([k, n]) => `  ${k}: ${n} learner${n !== 1 ? 's' : ''}`)
        .join('\n') || '  (none provided)')
    : `Sounds most learners need (soundsToPractise):\n` +
      (Object.entries(soundsToPractise).sort(([, a], [, b]) => b - a)
        .map(([s, n]) => `  ${s}: ${n} learner${n !== 1 ? 's' : ''}`)
        .join('\n') || '  (none provided)');

  return {
    system: CAPS_PREAMBLE,
    user: `Task: class_insight
Subject: ${subject} | Grade: ${grade} | Term: ${term}
Class: ${classroom.name ?? 'unknown'}

Tier distribution:
${tierList}

${gapBlock}

Give a short class-level insight:
- For ${subject}: what to teach this week and why (most learners need it).
- What the tier distribution means for this class right now.
- One concrete next step for the teacher.
State your confidence and what data you are missing.`,
  };
}

function buildGapExplanationPrompt(ctx) {
  const { grade, term, subject = 'literacy', learner, weeks } = ctx;
  const observations = learner.observations  ?? [];
  const termProgress = learner.termProgress  ?? [];
  const weeksInTier  = learner.weeksInTier   ?? null;
  const dbeCode      = learner.dbeCode       ?? null;

  // CODE-level HOD alert checks (no longer delegated to AI)
  const seedAlert   = isSeedCritical(learner.group, weeksInTier);
  const stagnantAlert = isStagnant(weeksInTier);

  const obs = observations
    .map(o => {
      if ('correct' in o && 'of' in o) return `  - ${o.item}: ${o.correct} of ${o.of}`;
      if ('count' in o && 'of' in o)   return `  - ${o.item}: knows ${o.count} of ${o.of}`;
      if ('count' in o)                return `  - ${o.item}: ${o.count}`;
      if ('result' in o)               return `  - ${o.item}: ${o.result}`;
      if ('values' in o)               return `  - ${o.item}: ${o.values.join(', ')}`;
      if ('strategy' in o)             return `  - ${o.item}: strategy used — ${o.strategy}`;
      return `  - ${o.item}`;
    })
    .join('\n');

  // For literacy: wpm/accuracy progress. For maths: scoreProgress or strategy notes.
  const progress = subject === 'literacy'
    ? termProgress
        .filter(t => t.wpm != null)
        .map(t => `  Term ${t.term}: ${t.wpm} wpm, ${t.accuracy}% accuracy`)
        .join('\n')
    : termProgress
        .filter(t => t.score != null || t.strategy != null)
        .map(t => `  Term ${t.term}: ${t.score != null ? `score ${t.score}%` : ''} ${t.strategy ? `| strategy: ${t.strategy}` : ''}`.trim())
        .join('\n');

  const tierRule  = formatTierRule(learner.group, subject);
  const gateBlock = formatGate(grade);

  const alertBlock = [
    seedAlert    ? `⚠️ SEED ALERT: ${learner.firstName} has been in Seed for ${weeksInTier} weeks. HOD review and Intervention Log update are required.` : '',
    stagnantAlert && !seedAlert ? `⚠️ STAGNATION ALERT: ${learner.firstName} has been in the same tier for ${weeksInTier} weeks. A strategy change is recommended.` : '',
  ].filter(Boolean).join('\n');

  // Subject-specific extra fields
  const extraBlock = subject === 'literacy'
    ? learner.soundsToPractise?.length ? `Sounds to practise: ${learner.soundsToPractise.join(', ')}` : ''
    : learner.mathsSkillsToWork?.length ? `Maths skills to work on: ${learner.mathsSkillsToWork.join(', ')}` : '';

  return {
    system: CAPS_PREAMBLE,
    user: `Task: gap_explanation
Subject: ${subject} | Grade: ${grade} | Term: ${term}
Learner: ${learner.firstName} | Group: ${learner.group}
${dbeCode      ? `DBE code: ${dbeCode}`               : 'DBE code: not yet recorded'}
${weeksInTier  ? `Weeks in current tier: ${weeksInTier}` : ''}
Observation window: ${weeks || '?'} weeks

${alertBlock ? alertBlock + '\n' : ''}
Relevant tier rule:
${tierRule}

Relevant progression gate:
${gateBlock}

Observations:
${obs || '  (none provided)'}

${progress ? `Term progress:\n${progress}` : ''}
${learner.checkInNote ? `Teacher note: ${learner.checkInNote}` : ''}
${extraBlock}

Use the gap analysis output format. Include a parent action in "Do this".
${seedAlert ? 'The Seed 4-week HOD alert has already been flagged above — acknowledge it in your response.' : ''}`,
  };
}

function buildHodInsightPrompt(ctx) {
  const { grade, term, subject = 'literacy', learner, classroom = {} } = ctx;
  const { tierCounts = {}, seedProgress = [], noConsent = 0, learners: total = 0 } = classroom;

  // Individual stagnation check in code
  const stagnationAlert = learner && isStagnant(learner.weeksInTier)
    ? `⚠️ STAGNATION ALERT: ${learner.firstName} has been in ${learner.group} for ${learner.weeksInTier} weeks (subject: ${learner.subject ?? subject}). A strategy change is recommended.`
    : null;

  const tierSummary = Object.entries(tierCounts)
    .map(([t, n]) => `  ${t}: ${n}`)
    .join('\n') || '  (none provided)';

  const seedRows = seedProgress
    .map((s, i) => {
      const metric = subject === 'maths'
        ? `score change: ${s.scoreChange ?? '?'}%`
        : `wpm change: ${s.wpmChange ?? '?'}`;
      return `  Learner ${i + 1}: ${metric}${s.note ? ` (${s.note})` : ''}`;
    })
    .join('\n');

  return {
    system: CAPS_PREAMBLE,
    user: `Task: hod_insight
Subject: ${subject} | Grade: ${grade} | Term: ${term}
Class: ${classroom.name ?? 'unknown'} | Total learners: ${total}
Learners without consent: ${noConsent}

Tier distribution:
${tierSummary}

Seed learner progress this year (anonymised):
${seedRows || '  (none provided)'}

${stagnationAlert ? stagnationAlert + '\n' : ''}
Give an HOD-level insight:
- Do not name individual learners unless flagging a critical risk that has already been flagged above.
- Note if any Seed learners trigger the 4-week Intervention Log review (${total ? `${Math.round(noConsent/total*100)}% without consent` : 'consent data missing'}).
- State whether the class distribution is healthy for this point in the year.
- Give one concrete recommendation.
- State confidence and missing data.`,
  };
}

function buildParentNotePrompt(ctx) {
  const { grade, term, subject = 'literacy', learner, channel, maxChars } = ctx;
  const charLimit  = maxChars ? `Maximum ${maxChars} characters (fits one ${channel} message).` : '';
  const latestProg = (learner.termProgress ?? []).slice(-1)[0];

  const progressLine = subject === 'literacy' && latestProg?.wpm
    ? `Latest reading: Term ${latestProg.term}, ${latestProg.wpm} wpm, ${latestProg.accuracy}% accuracy.`
    : subject === 'maths' && latestProg?.score != null
    ? `Latest maths: Term ${latestProg.term}, ${latestProg.score}% score.`
    : '';

  const focusLine = subject === 'literacy'
    ? learner.soundsToPractise?.length
      ? `Sounds to practise: ${learner.soundsToPractise.join(', ')}.`
      : ''
    : learner.mathsSkillsToWork?.length
    ? `Maths skills to work on: ${learner.mathsSkillsToWork.join(', ')}.`
    : '';

  return {
    system: CAPS_PREAMBLE,
    user: `Task: parent_note
Subject: ${subject} | Grade: ${grade} | Term: ${term}
Learner: ${learner.firstName} | Group: ${learner.group}
Channel: ${channel}
${charLimit}
${progressLine}
${focusLine}

Draft a short, warm parent note:
- Use plain language.
- Include ONE home activity linked to ${subject === 'maths' ? 'the maths skill to work on' : 'the sounds to practise'}.
- Do not compare to other children. Do not diagnose.
- Do not include phone numbers or contact details.
- End with "Teacher: ______".
- If SMS: stay under 160 characters.
- Mark as "Draft for teacher approval."
- If a translation to another language is needed, add: "Translation needs a native-speaker reviewer."`,
  };
}

function buildGuardrailPrompt(ctx) {
  const { grade, term, subject = 'literacy', requestText } = ctx;
  return {
    system: CAPS_PREAMBLE,
    user: `Task: guardrail
Subject: ${subject} | Grade: ${grade} | Term: ${term}
Teacher request: "${requestText}"

Explain politely why this request cannot be fulfilled. Cite the source of the rule:
- CAPS (give the page reference)
- POPIA (South African law)
- Project policy (the school's own rule)
- Teaching principle (pedagogical reason)
Offer an appropriate alternative.`,
  };
}

// ---------------------------------------------------------------------------
// Task router
// ---------------------------------------------------------------------------

const PROMPT_BUILDERS = {
  teacher_activity: buildTeacherActivityPrompt,
  class_insight:    buildClassInsightPrompt,
  gap_explanation:  buildGapExplanationPrompt,
  hod_insight:      buildHodInsightPrompt,
  parent_note:      buildParentNotePrompt,
  guardrail:        buildGuardrailPrompt,
  // child_hint and child_tutor handled inline — subject routing happens there
};

const TASKS_REQUIRE_APPROVAL = new Set(['teacher_activity', 'parent_note', 'hod_insight']);

/**
 * Main Lesedi entry point.
 * @param {object} ctx  Full request context from /api/lesedi
 * @returns {Promise<object>}
 */
export async function runLesedi(ctx) {
  // 1. Guardrail check — always first, now subject-aware
  const guard = checkGuardrails(ctx);
  if (guard.blocked) return guard.response;

  const { task, subject = 'literacy', hintLevel, event, learner,
          target, errorPattern, sessions } = ctx;
  const firstName = learner?.firstName ?? 'there';
  const isMaths   = subject === 'maths';

  // ------------------------------------------------------------------
  // 2. child_hint — fully offline, routes to correct phrase bank
  // ------------------------------------------------------------------
  if (task === 'child_hint') {
    const praiseBank = isMaths ? MATHS_PRAISE_PHRASES : PRAISE_PHRASES;

    if (event === 'correct') {
      const phraseFn = isMaths ? praiseBank.correct : praiseBank.correct;
      return {
        text:             phraseFn(firstName),
        source:           isMaths ? 'maths_bank' : 'phrase_bank',
        handoff:          false,
        requiresApproval: false,
        tags:             ['praise_effort', 'open_question', 'extends_thinking'],
      };
    }

    const level = Number(hintLevel) || 1;
    const resolver = isMaths ? resolveMathsChildPhrase : resolveChildPhrase;

    if (level >= 3) {
      return {
        ...resolver(3, event ?? 'default', firstName),
        tags:             ['hint_L3', 'worked_example_not_answer', 'no_dead_end', 'handoff_to_teacher'],
        requiresApproval: false,
      };
    }
    return {
      ...resolver(level, event ?? 'default', firstName),
      tags:             [`hint_L${level}`, 'strategy_not_answer', 'fixed_phrase_bank'],
      requiresApproval: false,
    };
  }

  // ------------------------------------------------------------------
  // 3. child_tutor — phrase bank for known events; AI for unknown
  // ------------------------------------------------------------------
  if (task === 'child_tutor') {
    const knownLiteracyEvents = new Set([
      'whispers_or_stays_silent',
      'same_error_third_session',
      'asks_for_the_answer',
      'writes_one_sentence_and_stops',
      'read_one_page',
    ]);
    const knownMathsEvents = new Set([
      'silent_or_anxious',
      'same_error_third_session',
      'asks_for_the_answer',
      'finishes_early',
      'correct_no_explanation',
      'still_using_fingers_gr3',
    ]);

    const knownEvents = isMaths ? knownMathsEvents : knownLiteracyEvents;

    if (knownEvents.has(event)) {
      const resolver = isMaths ? resolveMathsTutorPhrase : resolveTutorPhrase;
      const result   = resolver(event, firstName, target, errorPattern);
      return {
        ...result,
        tags: [
          isMaths ? 'maths_bank' : 'fixed_phrase_bank',
          'strategy_not_answer',
          ...(result.teacherFlag ? ['flags_teacher'] : []),
        ],
      };
    }

    // Unknown event — AI fallback (subject-aware prompt)
    const { system, user } = buildChildTutorPrompt(ctx);
    const raw   = await callAI(system, user);
    const parts = raw.split('|||').map(s => s.trim());
    const [childText, teacherFlag, parentTip] = parts;

    return {
      text:             childText?.replace(/^CHILD:\s*/i, '') ?? raw,
      teacherFlag:      teacherFlag?.replace(/^TEACHER_FLAG:\s*/i, '').trim() || null,
      parentTip:        parentTip?.replace(/^PARENT_TIP:\s*/i, '').trim() || null,
      source:           'ai_model',
      requiresApproval: !!parentTip?.trim(),
      tags:             ['child_tutor', 'strategy_not_answer',
                         ...(teacherFlag ? ['flags_teacher'] : [])],
      handoff:          false,
    };
  }

  // ------------------------------------------------------------------
  // 4. All other tasks — AI via subject-aware prompt builder
  // ------------------------------------------------------------------
  const builder = PROMPT_BUILDERS[task];
  if (!builder) {
    return {
      text: `Unknown task type: "${task}". Supported: child_hint, child_tutor, teacher_activity, class_insight, gap_explanation, hod_insight, parent_note, guardrail.`,
      source:           'engine_error',
      requiresApproval: false,
      tags:             ['unknown_task'],
    };
  }

  const { system, user } = builder(ctx);
  const aiText = await callAI(system, user);

  const requiresApproval = TASKS_REQUIRE_APPROVAL.has(task);
  const tags = requiresApproval
    ? ['teacher_approval_required', 'caps_aligned', subject]
    : ['insight_first', 'evidence_cited', 'teacher_decides', subject];

  return {
    text:             aiText,
    source:           'ai_model',
    requiresApproval,
    tags,
    handoff:          false,
  };
}

// ---------------------------------------------------------------------------
// child_tutor AI fallback prompt — subject-aware
// (only called for unknown events not in the phrase bank)
// ---------------------------------------------------------------------------
function buildChildTutorPrompt(ctx) {
  const { grade, term, subject = 'literacy', learner, event,
          setting, target, errorPattern, sessions } = ctx;
  const subjectNote = subject === 'maths'
    ? 'The child is working on a maths task. Encourage mathematical thinking. Name the strategy.'
    : 'The child is working on a literacy task.';

  return {
    system: CAPS_PREAMBLE,
    user: `Task: child_tutor
Subject: ${subject} | Grade: ${grade} | Term: ${term}
Learner: ${learner?.firstName ?? 'unknown'} | Group: ${learner?.group ?? 'unknown'}
Setting: ${setting ?? 'one_to_one_with_Lesedi'}
Event: ${event}
${target       ? `Target: ${target}` : ''}
${errorPattern ? `Error pattern: ${errorPattern}` : ''}
${sessions     ? `Sessions so far: ${sessions}` : ''}
${subjectNote}

Reply in exactly three parts separated by "|||":
CHILD: One or two warm, low-pressure sentences directly to the child. No answer given.
TEACHER_FLAG: A brief flag for the teacher dashboard (leave blank if not a pattern or risk).
PARENT_TIP: A short home activity tip, marked "Draft for teacher approval." (leave blank if not needed).`,
  };
}
