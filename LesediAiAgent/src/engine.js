/**
 * engine.js
 * Lesedi task router and prompt builder — dataset v3.
 *
 * Supported tasks:
 *   child_hint       — hint ladder (offline phrase bank, levels 1–3)
 *   child_tutor      — 1-to-1 tutor session (offline phrase bank + AI for complex events)
 *   teacher_activity — CAPS-aligned activity draft
 *   class_insight    — class-level sound / tier pattern analysis
 *   gap_explanation  — evidence-based tier placement explanation (v3: insight_first format)
 *   hod_insight      — HOD classroom health and stagnation alerts
 *   parent_note      — WhatsApp / SMS draft for teacher approval
 *   guardrail        — policy refusal explanations
 *
 * Flow:
 *   1. checkGuardrails() — hard policy check, returns early if blocked
 *   2. child_hint / child_tutor — serve from phraseBank (no AI call)
 *   3. All other tasks — build system + user prompt and call the AI adapter
 *
 * The engine never reads data.json directly.
 */

import { checkGuardrails }                        from './guardrails.js';
import { resolveChildPhrase, resolveTutorPhrase, PRAISE_PHRASES } from './phraseBank.js';
import { callAI }                                 from './azureAdapter.js';
import { formatAllTierRules, formatTierRule, PROGRESSION_GATES } from './tierRules.js';

// ---------------------------------------------------------------------------
// System preamble — injected into every AI prompt
// ---------------------------------------------------------------------------
const CAPS_PREAMBLE = `You are Lesedi, a CAPS-aligned teaching assistant for South African Foundation Phase classrooms (Grades R to 3).

Your rules:
- Never give a child the answer directly. Use hint ladders (levels 1, 2, 3). At level 3 give a worked example, then let the child retry. Only hand off to the teacher after the retry fails.
- Never diagnose a learner. Describe evidence from observations only.
- Never assign a learner to a group. Groups are always the teacher's decision.
- All activities, parent notes, and parent tips are drafts. They require teacher and HOD approval before use.
- Grade R assessment is informal — never produce a marked test for Grade R.
- Never repeat, store, or use phone numbers or parent contact details.
- Always cite the CAPS page reference when suggesting an activity or noting a gap.
- State your evidence limits honestly (number of observations, missing data, confidence level).
- Use plain language suitable for a WhatsApp or SMS message when writing parent notes.
- Sound names, not letter names, for Grade R and Grade 1 phonics work.
- Tier groups (Seed, Sprout, Bloom, Tree) are used for Grades R to 3 and carry across grades.
- Gap analysis output format (always follow this order):
    1. One-line insight: "FirstName: [summary in plain language]."
    2. "What the data shows:" — list evidence only.
    3. "Why they are in [tier]:" — cite the tier rule.
    4. "Why it matters:" — link to the relevant progression gate if applicable.
    5. "Do this:" — one or two concrete next steps.
    6. "Missing:" — name what evidence you don't have.
    7. "Confidence:" — low | medium | medium-high | high, with a reason.
- HOD insights follow the same format but use classroom-level data (no individual names unless flagging a critical risk).
- End every teacher-facing activity or parent note with: "Teacher and HOD to approve before use."

Tier rules for placement explanations:
${formatAllTierRules()}`;

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildChildHintPrompt(ctx) {
  const { grade, term, learner, hintLevel, event, target } = ctx;
  return {
    system: CAPS_PREAMBLE,
    user: `Task: child_hint
Grade: ${grade} | Term: ${term}
Learner first name: ${learner?.firstName ?? 'unknown'}
Hint level: ${hintLevel}
Event: ${event}
Target skill: ${target}

Give a single short hint (one or two sentences maximum) suitable for a child of this age. Do not give the answer. If this is level 3, give a worked example using a different but related word or problem, then invite the child to retry before mentioning the teacher.`,
  };
}

function buildChildTutorPrompt(ctx) {
  const { grade, term, learner, event, setting, target, errorPattern, sessions } = ctx;
  return {
    system: CAPS_PREAMBLE,
    user: `Task: child_tutor
Grade: ${grade} | Term: ${term}
Learner first name: ${learner?.firstName ?? 'unknown'} | Group: ${learner?.group ?? 'unknown'}
Setting: ${setting ?? 'one_to_one_with_Lesedi'}
Event: ${event}
${target       ? `Target: ${target}` : ''}
${errorPattern ? `Error pattern: ${errorPattern}` : ''}
${sessions     ? `Sessions so far: ${sessions}` : ''}

Reply in three parts separated by "|||":
CHILD: A short, warm, low-pressure reply directly to the child. Maximum two sentences. No answer given.
TEACHER_FLAG: A brief flag for the teacher dashboard (only if the event signals a pattern or risk). Leave blank if not needed.
PARENT_TIP: A short home activity tip, marked "Draft for teacher approval." Leave blank if not needed.`,
  };
}

function buildTeacherActivityPrompt(ctx) {
  const { grade, term, focus, minutes, groupSize, soundsLearnt = [] } = ctx;
  const sounds = soundsLearnt.length ? `Sounds already learnt: ${soundsLearnt.join(', ')}.` : '';
  const group  = groupSize ? `Group size: ${groupSize}.` : 'Whole class.';
  return {
    system: CAPS_PREAMBLE,
    user: `Task: teacher_activity
Grade: ${grade} | Term: ${term}
Focus: ${focus}
Duration: ${minutes} minutes
${group}
${sounds}

Draft a CAPS-aligned activity for teacher approval. Include: numbered steps, an observation note (what to look for, not a test), the CAPS page reference, and whether materials are needed. End with "Teacher and HOD to approve before use."`,
  };
}

function buildClassInsightPrompt(ctx) {
  const { grade, term, subject = 'literacy', classroom = {} } = ctx;
  const { soundsToPractise = {}, tierCounts = {} } = classroom;

  const soundList = Object.entries(soundsToPractise)
    .sort(([, a], [, b]) => b - a)
    .map(([s, n]) => `  ${s}: ${n} learner${n !== 1 ? 's' : ''}`)
    .join('\n') || '  (none provided)';

  const tierList = Object.entries(tierCounts)
    .map(([t, n]) => `  ${t}: ${n}`)
    .join('\n') || '  (none provided)';

  return {
    system: CAPS_PREAMBLE,
    user: `Task: class_insight
Grade: ${grade} | Term: ${term} | Subject: ${subject}
Class: ${classroom.name ?? 'unknown'}

Tier counts:
${tierList}

Sounds most learners need (from soundsToPractise):
${soundList}

Give a short class-level insight: which sound to teach this week and why, what the tier distribution means, and one concrete next step. State your confidence and what data you are missing.`,
  };
}

function buildGapExplanationPrompt(ctx) {
  const { grade, term, learner, weeks, subject = 'literacy' } = ctx;
  const observations = learner.observations  ?? [];
  const termProgress = learner.termProgress  ?? [];
  const weeksInTier  = learner.weeksInTier   ?? null;
  const dbeCode      = learner.dbeCode       ?? null;

  const obs = observations
    .map(o => {
      if ('correct' in o && 'of' in o) return `  - ${o.item}: ${o.correct} of ${o.of}`;
      if ('count' in o && 'of' in o)   return `  - ${o.item}: knows ${o.count} of ${o.of}`;
      if ('count' in o)                return `  - ${o.item}: ${o.count}`;
      if ('result' in o)               return `  - ${o.item}: ${o.result}`;
      if ('values' in o)               return `  - ${o.item}: ${o.values.join(', ')}`;
      return `  - ${o.item}`;
    })
    .join('\n');

  const progress = termProgress
    .map(t => `  Term ${t.term}: ${t.wpm} wpm, ${t.accuracy}% accuracy`)
    .join('\n');

  const tierRule = formatTierRule(learner.group, subject);

  return {
    system: CAPS_PREAMBLE,
    user: `Task: gap_explanation
Grade: ${grade} | Term: ${term} | Subject: ${subject}
Learner: ${learner.firstName} | Group: ${learner.group}
${dbeCode      ? `DBE code: ${dbeCode}`                             : 'DBE code: not yet recorded'}
${weeksInTier  ? `Weeks in current tier: ${weeksInTier}`           : ''}
Observation window: ${weeks || '?'} weeks

Relevant tier rule:
${tierRule}

Observations:
${obs || '  (none provided)'}

${progress ? `Term progress:\n${progress}` : ''}
${learner.checkInNote  ? `Teacher note: ${learner.checkInNote}`  : ''}
${learner.soundsToPractise?.length ? `Sounds to practise: ${learner.soundsToPractise.join(', ')}` : ''}

Use the gap analysis output format from your rules. Include a parent action in "Do this". State whether the Seed 4-week HOD alert applies if weeksInTier >= 4 and group is Seed.`,
  };
}

function buildHodInsightPrompt(ctx) {
  const { grade, term, subject = 'literacy', learner, classroom = {} } = ctx;
  const { tierCounts = {}, seedProgress = [], noConsent = 0, learners: total = 0 } = classroom;

  const tierSummary = Object.entries(tierCounts)
    .map(([t, n]) => `  ${t}: ${n}`)
    .join('\n') || '  (none provided)';

  const seedRows = seedProgress
    .map((s, i) => `  Learner ${i + 1}: +${s.wpmChange ?? '?'} wpm${s.note ? ` (${s.note})` : ''}`)
    .join('\n');

  // Individual stagnation alert (HOD-002 pattern)
  const stagnationBlock = learner
    ? `Individual learner: ${learner.firstName} | Group: ${learner.group} | Subject: ${learner.subject ?? subject} | Weeks in tier: ${learner.weeksInTier ?? 'unknown'}`
    : '';

  return {
    system: CAPS_PREAMBLE,
    user: `Task: hod_insight
Grade: ${grade} | Term: ${term} | Subject: ${subject}
Class: ${classroom.name ?? 'unknown'} | Total learners: ${total}
Learners without consent: ${noConsent}

Tier distribution:
${tierSummary}

Seed learner progress this year (wpm change, anonymised):
${seedRows || '  (none provided)'}

${stagnationBlock}

Give an HOD-level insight following the gap analysis format. Do not use individual learner names unless flagging a critical risk. State whether any Seed learners exceed 4 weeks and trigger the Intervention Log review. Give one concrete recommendation. State confidence and missing data.`,
  };
}

function buildParentNotePrompt(ctx) {
  const { grade, term, learner, channel, maxChars } = ctx;
  const charLimit     = maxChars ? `Maximum ${maxChars} characters (fits one ${channel} message).` : '';
  const latestProg    = (learner.termProgress ?? []).slice(-1)[0];
  const latestLine    = latestProg
    ? `Latest reading: Term ${latestProg.term}, ${latestProg.wpm} wpm, ${latestProg.accuracy}% accuracy.`
    : '';
  const soundsLine    = learner.soundsToPractise?.length
    ? `Sounds to practise: ${learner.soundsToPractise.join(', ')}.`
    : '';

  return {
    system: CAPS_PREAMBLE,
    user: `Task: parent_note
Grade: ${grade} | Term: ${term}
Learner: ${learner.firstName} | Group: ${learner.group}
Channel: ${channel}
${charLimit}
${latestLine}
${soundsLine}

Draft a short, warm parent note. Use plain language. Include one home activity linked to the sounds to practise or the current focus. Do not compare to other children. Do not diagnose. Do not include phone numbers or contact details. End with "Teacher: ______". If the channel is SMS stay under 160 characters. Mark as "Draft for teacher approval." Add a note if translation to another language needs a native-speaker reviewer.`,
  };
}

function buildGuardrailPrompt(ctx) {
  const { grade, term, requestText } = ctx;
  return {
    system: CAPS_PREAMBLE,
    user: `Task: guardrail
Grade: ${grade} | Term: ${term}
Teacher request: "${requestText}"

Explain politely why this request cannot be fulfilled, citing the relevant CAPS or project policy. Offer an appropriate alternative.`,
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
  // child_hint and child_tutor are handled inline below (phrase bank first)
};

const TASKS_REQUIRE_APPROVAL = new Set(['teacher_activity', 'parent_note', 'hod_insight']);

/**
 * Main Lesedi entry point.
 * @param {object} ctx  Full request context from /api/lesedi
 * @returns {Promise<object>}  Lesedi response
 */
export async function runLesedi(ctx) {
  // 1. Guardrail check — always first
  const guard = checkGuardrails(ctx);
  if (guard.blocked) return guard.response;

  const { task, hintLevel, event, learner, target, errorPattern, sessions } = ctx;
  const firstName = learner?.firstName ?? 'there';

  // 2. child_hint — fully offline via phrase bank
  if (task === 'child_hint') {
    if (event === 'correct') {
      return {
        text:             PRAISE_PHRASES.correct(firstName),
        source:           'phrase_bank',
        handoff:          false,
        requiresApproval: false,
        tags:             ['praise_effort', 'open_question', 'extends_thinking'],
      };
    }
    const level = Number(hintLevel) || 1;
    if (level >= 3) {
      return {
        ...resolveChildPhrase(3, event ?? 'default', firstName),
        tags:             ['hint_L3', 'worked_example_not_answer', 'no_dead_end', 'handoff_to_teacher'],
        requiresApproval: false,
      };
    }
    return {
      ...resolveChildPhrase(level, event ?? 'default', firstName),
      tags:             [`hint_L${level}`, 'strategy_not_answer', 'fixed_phrase_bank'],
      requiresApproval: false,
    };
  }

  // 3. child_tutor — phrase bank for known events, AI for unknown
  if (task === 'child_tutor') {
    const knownEvents = new Set([
      'whispers_or_stays_silent',
      'same_error_third_session',
      'asks_for_the_answer',
      'writes_one_sentence_and_stops',
      'read_one_page',
    ]);

    if (knownEvents.has(event)) {
      const result = resolveTutorPhrase(event, firstName, target, errorPattern);
      return {
        ...result,
        tags: ['fixed_phrase_bank', 'strategy_not_answer', ...(result.teacherFlag ? ['flags_teacher'] : [])],
      };
    }

    // Unknown tutor event — fall through to AI with child_tutor prompt builder
    const { system, user } = buildChildTutorPrompt(ctx);
    const raw = await callAI(system, user);

    // Parse the three-part response
    const parts = raw.split('|||').map(s => s.trim());
    const [childText, teacherFlag, parentTip] = parts;

    return {
      text:             childText?.replace(/^CHILD:\s*/i, '') ?? raw,
      teacherFlag:      teacherFlag?.replace(/^TEACHER_FLAG:\s*/i, '').trim() || null,
      parentTip:        parentTip?.replace(/^PARENT_TIP:\s*/i, '').trim() || null,
      source:           'ai_model',
      requiresApproval: !!parentTip?.trim(),
      tags:             ['child_tutor', 'strategy_not_answer', ...(teacherFlag ? ['flags_teacher'] : [])],
      handoff:          false,
    };
  }

  // 4. All other tasks — AI via prompt builder
  const builder = PROMPT_BUILDERS[task];
  if (!builder) {
    return {
      text:             `Unknown task type: "${task}". Supported: child_hint, child_tutor, teacher_activity, class_insight, gap_explanation, hod_insight, parent_note, guardrail.`,
      source:           'engine_error',
      requiresApproval: false,
      tags:             ['unknown_task'],
    };
  }

  const { system, user } = builder(ctx);
  const aiText = await callAI(system, user);

  const requiresApproval = TASKS_REQUIRE_APPROVAL.has(task);
  const tags = requiresApproval
    ? ['teacher_approval_required', 'caps_aligned']
    : ['insight_first', 'evidence_cited', 'teacher_decides'];

  return {
    text:             aiText,
    source:           'ai_model',
    requiresApproval,
    tags,
    handoff:          false,
  };
}
