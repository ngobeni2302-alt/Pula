/**
 * activitySchema.js
 * One shared activity structure for both Literacy and Maths.
 *
 * WHY THIS EXISTS
 * Lesedi previously had no reusable activity shape. Adding a new game or subject
 * meant rebuilding the AI architecture. This file defines a single ActivitySpec
 * that works for any subject, any grade, any tier — the engine reads one schema,
 * the frontend reads one schema, and new activities need no new code paths.
 *
 * ACTIVITY SPEC FIELDS
 * ─────────────────────
 * id          Unique string — e.g. 'LIT-SEED-GR1-T1-001', 'MTH-SPROUT-GR2-T3-001'
 * subject     'literacy' | 'maths'
 * grade       'R' | '1' | '2' | '3'
 * term        1 | 2 | 3 | 4
 * tier        'Seed' | 'Sprout' | 'Bloom' | 'Tree'
 * capsRef     CAPS page reference, e.g. 'CAPS HL Gr 1 p.56' or 'CAPS Maths Gr 2 p.38'
 * title       Short name shown in the UI
 * focus       What skill this develops, e.g. 'blending', 'place value to 20'
 * minutes     Recommended duration (number)
 * groupSize   'individual' | 'pair' | 'small_group' | 'whole_class'
 * materials   string[] — what the teacher needs. Empty array = no materials.
 * steps       ActivityStep[] — numbered instructions
 * observe     string — what to watch for (not a test, an observation)
 * homeGame    string | null — optional parent-facing version
 * tags        string[] — guardrail and training tags
 * source      'caps_aligned' | 'project_game' | 'ai_draft' | 'teacher_edit'
 * requiresApproval  boolean — always true for ai_draft; false for built-in
 *
 * ACTIVITY STEP FIELDS
 * ─────────────────────
 * order       Step number (1-indexed)
 * instruction The teacher-facing step text
 * childFacing Optional child-facing version (used in child_tutor context)
 * duration    Optional minutes for this step
 */

// ---------------------------------------------------------------------------
// Built-in activity library — Literacy
// ---------------------------------------------------------------------------
export const LITERACY_ACTIVITIES = {
  Seed: [
    {
      id:       'LIT-SEED-GRR-T1-001',
      subject:  'literacy',
      grade:    'R',
      term:     1,
      tier:     'Seed',
      capsRef:  'CAPS HL Gr R p.34',
      title:    'Name sound circle',
      focus:    'first sound of own name',
      minutes:  5,
      groupSize: 'whole_class',
      materials: [],
      steps: [
        { order: 1, instruction: "Say a sound, for example /m/. Children whose names start with that sound step forward." },
        { order: 2, instruction: "Say 'What sound does your name start with?' Child says the sound, not the letter name." },
        { order: 3, instruction: "Repeat with two more sounds. Keep it short — stop before children lose focus." },
      ],
      observe:  'Who can say the first sound of their own name without a prompt?',
      homeGame: 'Ask your child to say their name slowly and clap once for the very first sound.',
      tags:     ['caps_aligned', 'sound_not_letter_name', 'observation_not_test'],
      source:   'caps_aligned',
      requiresApproval: false,
    },
    {
      id:       'LIT-SEED-GR1-T1-001',
      subject:  'literacy',
      grade:    '1',
      term:     1,
      tier:     'Seed',
      capsRef:  'CAPS HL Gr 1 p.56',
      title:    'Sound & letter hunt',
      focus:    'matching letters to sounds',
      minutes:  3,
      groupSize: 'small_group',
      materials: ['letter cards (taught letters only)'],
      steps: [
        { order: 1, instruction: "Say three simple letter sounds together. Children repeat." },
        { order: 2, instruction: "Hold up a letter card. Child says the sound, finds a classroom object starting with it." },
        { order: 3, instruction: "Blend a short CVC word aloud together: 'c-a-t, cat'." },
      ],
      observe:  'Who matches letters to sounds independently? Who still needs the class model?',
      homeGame: 'Tap letters on a cereal box. Ask your child to say the sound each letter makes.',
      tags:     ['caps_aligned', 'observation_not_test', 'seed_tier'],
      source:   'caps_aligned',
      requiresApproval: false,
    },
  ],
  Sprout: [
    {
      id:       'LIT-SPROUT-GR1-T1-001',
      subject:  'literacy',
      grade:    '1',
      term:     1,
      tier:     'Sprout',
      capsRef:  'CAPS HL Gr 1 p.56',
      title:    'Sound swap',
      focus:    'blending and segmenting CVC words',
      minutes:  15,
      groupSize: 'whole_class',
      materials: [],
      steps: [
        { order: 1, instruction: "Say 'hat' and have the class segment it: h-a-t." },
        { order: 2, instruction: "Say 'Change the h to b. What is the new word?' Children answer together." },
        { order: 3, instruction: "Repeat with c-at, m-at, b-at and talk about the rhyme." },
        { order: 4, instruction: "Let a child choose the next sound swap." },
      ],
      observe:  'Who can blend and who can only segment? Record on your checklist.',
      homeGame: "Say a word in sounds (b-u-s). Ask your child to say the whole word fast.",
      tags:     ['caps_aligned', 'child_leads', 'observation_not_test'],
      source:   'caps_aligned',
      requiresApproval: false,
    },
    {
      id:       'LIT-SPROUT-GR2-T1-001',
      subject:  'literacy',
      grade:    '2',
      term:     1,
      tier:     'Sprout',
      capsRef:  'CAPS HL Gr 2 p.81',
      title:    'Word builders',
      focus:    '-at and -am word families',
      minutes:  15,
      groupSize: 'small_group',
      materials: ['letter cards: c, h, m, p, s, r, a, t'],
      steps: [
        { order: 1, instruction: "Give each group letter cards. Children build as many -at and -am words as they can." },
        { order: 2, instruction: "Each child reads one word aloud." },
        { order: 3, instruction: "Each group puts one word in a sentence." },
        { order: 4, instruction: "Groups share a word that another group did not build." },
      ],
      observe:  'Who builds words alone? Who copies? Record on your checklist.',
      homeGame: "Write -at on paper. Ask your child to put different letters in front: c-at, h-at, m-at.",
      tags:     ['caps_aligned', 'word_families', 'observation_not_test'],
      source:   'caps_aligned',
      requiresApproval: false,
    },
  ],
  Bloom: [
    {
      id:       'LIT-BLOOM-GR2-T1-001',
      subject:  'literacy',
      grade:    '2',
      term:     1,
      tier:     'Bloom',
      capsRef:  'CAPS HL Gr 2 p.82',
      title:    'Story builders',
      focus:    'reading fluency and retelling',
      minutes:  10,
      groupSize: 'small_group',
      materials: ['levelled reader at instructional level'],
      steps: [
        { order: 1, instruction: "Read a short paragraph aloud at a steady pace." },
        { order: 2, instruction: "Identify the main idea and three story details." },
        { order: 3, instruction: "Retell the story with a partner in home language or English." },
      ],
      observe:  'Does the child pause at full stops? Decode unfamiliar words using context?',
      homeGame: "Read one page of any book. Ask: 'What happened? Who was there?'",
      tags:     ['caps_aligned', 'fluency', 'observation_not_test'],
      source:   'caps_aligned',
      requiresApproval: false,
    },
  ],
  Tree: [
    {
      id:       'LIT-TREE-GR3-T1-001',
      subject:  'literacy',
      grade:    '3',
      term:     1,
      tier:     'Tree',
      capsRef:  'CAPS HL Gr 3 p.107',
      title:    'Reading detectives',
      focus:    'deep comprehension and higher-order questions',
      minutes:  15,
      groupSize: 'individual',
      materials: ['unfamiliar passage at challenge level'],
      steps: [
        { order: 1, instruction: "Child reads the passage independently and fluently." },
        { order: 2, instruction: "Find evidence for two comprehension questions." },
        { order: 3, instruction: "Explain the meaning of three new vocabulary words from context." },
      ],
      observe:  'Can the child infer meaning? Support answers with evidence from the text?',
      homeGame: "After a story, ask: 'Why do you think that happened? What would you have done?'",
      tags:     ['caps_aligned', 'higher_order', 'observation_not_test'],
      source:   'caps_aligned',
      requiresApproval: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// Built-in activity library — Maths
// ---------------------------------------------------------------------------
export const MATHS_ACTIVITIES = {
  Seed: [
    {
      id:       'MTH-SEED-GRR-T1-001',
      subject:  'maths',
      grade:    'R',
      term:     1,
      tier:     'Seed',
      capsRef:  'CAPS Maths Gr R p.10',
      title:    'Counting bodies',
      focus:    'one-to-one correspondence to 5',
      minutes:  5,
      groupSize: 'whole_class',
      materials: [],
      steps: [
        { order: 1, instruction: "Hold up 3 fingers slowly, counting aloud: 1, 2, 3. Children copy." },
        { order: 2, instruction: "Ask 'How many fingers?' Children answer. Confirm by counting again together." },
        { order: 3, instruction: "Try with objects: put 3 blocks in a row, touch each one as you count." },
        { order: 4, instruction: "Ask a child to show you 4 fingers. Observe: do they count from 1 each time?" },
      ],
      observe:  'Who touches each object once while counting? Who skips or double-counts?',
      homeGame: 'Count 5 raisins or buttons with your child. Touch each one as you count.',
      tags:     ['caps_aligned', 'one_to_one_correspondence', 'observation_not_test', 'concrete'],
      source:   'caps_aligned',
      requiresApproval: false,
    },
    {
      id:       'MTH-SEED-GR1-T1-001',
      subject:  'maths',
      grade:    '1',
      term:     1,
      tier:     'Seed',
      capsRef:  'CAPS Maths Gr 1 p.12',
      title:    'Number line walk',
      focus:    'counting to 20, number order',
      minutes:  10,
      groupSize: 'small_group',
      materials: ['chalk or tape number line on floor 1–20'],
      steps: [
        { order: 1, instruction: "Walk the number line together, stepping on each number and saying it aloud." },
        { order: 2, instruction: "Call a number. Child jumps to it and holds up that many fingers." },
        { order: 3, instruction: "Remove one number card. 'What number is missing?'" },
        { order: 4, instruction: "Count backwards from 10. Clap at each number." },
      ],
      observe:  'Who can count past 10 without support? Who hesitates at 10 → 11?',
      homeGame: 'Count steps up the stairs together. Stop at 10 and count back down.',
      tags:     ['caps_aligned', 'number_order', 'concrete', 'observation_not_test'],
      source:   'caps_aligned',
      requiresApproval: false,
    },
    {
      id:       'MTH-SEED-GR2-T1-001',
      subject:  'maths',
      grade:    '2',
      term:     1,
      tier:     'Seed',
      capsRef:  'CAPS Maths Gr 2 p.16',
      title:    'Counters add-on',
      focus:    'single-digit addition with concrete objects',
      minutes:  10,
      groupSize: 'pair',
      materials: ['counters or bottle tops (at least 20 per pair)', 'number cards 1–9'],
      steps: [
        { order: 1, instruction: "Child picks two number cards and makes both numbers with counters in two groups." },
        { order: 2, instruction: "Slide the groups together and count the total." },
        { order: 3, instruction: "Write the number sentence: e.g. 4 + 3 = 7." },
        { order: 4, instruction: "Repeat with a new pair of cards. Aim for 5 rounds." },
      ],
      observe:  'Does the child count all from 1, or count on from the bigger number?',
      homeGame: 'Put 4 spoons on one side, 3 on the other. Count them all together and say the sum.',
      tags:     ['caps_aligned', 'addition', 'concrete', 'observation_not_test'],
      source:   'caps_aligned',
      requiresApproval: false,
    },
  ],
  Sprout: [
    {
      id:       'MTH-SPROUT-GR1-T2-001',
      subject:  'maths',
      grade:    '1',
      term:     2,
      tier:     'Sprout',
      capsRef:  'CAPS Maths Gr 1 p.22',
      title:    'Jump the 10 bridge',
      focus:    'bridging through 10 (e.g. 8 + 5)',
      minutes:  10,
      groupSize: 'small_group',
      materials: ['number line 0–20'],
      steps: [
        { order: 1, instruction: "Show 8 + 5 on the number line. 'How far to 10 from 8?' (2 jumps)." },
        { order: 2, instruction: "'We used 2. How many left from 5?' (3 left). Land on 13." },
        { order: 3, instruction: "Children copy with 7 + 6, then 9 + 4." },
        { order: 4, instruction: "One child explains the jumps to the group." },
      ],
      observe:  'Who freezes crossing 10? Who can split the second number automatically?',
      homeGame: "Fingers game: hold up 8, then 5 more. How many altogether? Show the bridge.",
      tags:     ['caps_aligned', 'bridging_10', 'semi_concrete', 'observation_not_test'],
      source:   'caps_aligned',
      requiresApproval: false,
    },
    {
      id:       'MTH-SPROUT-GR2-T3-001',
      subject:  'maths',
      grade:    '2',
      term:     3,
      tier:     'Sprout',
      capsRef:  'CAPS Maths Gr 2 p.38',
      title:    'Lines and dots subtraction',
      focus:    'two-digit subtraction using semi-concrete strategy',
      minutes:  15,
      groupSize: 'pair',
      materials: ['mini whiteboards or scrap paper'],
      steps: [
        { order: 1, instruction: "Show 34 − 12 as lines (tens) and dots (units): III• and cross out I•• ." },
        { order: 2, instruction: "Count what remains. Write the number sentence." },
        { order: 3, instruction: "Try 45 − 23. Children draw first, then calculate." },
        { order: 4, instruction: "Challenge: 'Can you do 52 − 17 without drawing lines?'" },
      ],
      observe:  'Who moves from drawing to mental calculation? Who still needs every line?',
      homeGame: 'Draw 23 lines and dots on paper. Cross out 11. Count what is left.',
      tags:     ['caps_aligned', 'subtraction', 'semi_concrete', 'observation_not_test'],
      source:   'caps_aligned',
      requiresApproval: false,
    },
  ],
  Bloom: [
    {
      id:       'MTH-BLOOM-GR2-T3-001',
      subject:  'maths',
      grade:    '2',
      term:     3,
      tier:     'Bloom',
      capsRef:  'CAPS Maths Gr 2 p.40',
      title:    'Smart strategies race',
      focus:    'mental calculation — doubles, near-doubles, breaking apart',
      minutes:  15,
      groupSize: 'pair',
      materials: ['problem cards'],
      steps: [
        { order: 1, instruction: "Pose 28 + 7. Ask: 'Does anyone see a shortcut?' Collect strategies aloud." },
        { order: 2, instruction: "Model: 28 + 2 = 30, then 30 + 5 = 35." },
        { order: 3, instruction: "Pairs race to solve the next three problems using any smart strategy." },
        { order: 4, instruction: "Each pair explains their method to the class." },
      ],
      observe:  'Who uses a mental strategy vs. who counts on? Can they explain the strategy?',
      homeGame: "Ask: '17 + 8 — can you do it in your head? Show me how.'",
      tags:     ['caps_aligned', 'mental_maths', 'place_value', 'observation_not_test'],
      source:   'caps_aligned',
      requiresApproval: false,
    },
    {
      id:       'MTH-BLOOM-GR3-T1-001',
      subject:  'maths',
      grade:    '3',
      term:     1,
      tier:     'Bloom',
      capsRef:  'CAPS Maths Gr 3 p.24',
      title:    'Place value flip',
      focus:    'understanding hundreds, tens, units (HTU)',
      minutes:  15,
      groupSize: 'small_group',
      materials: ['base-10 blocks or drawn HTU cards'],
      steps: [
        { order: 1, instruction: "Build 234 with blocks: 2 hundreds, 3 tens, 4 units." },
        { order: 2, instruction: "'What does the 3 stand for?' Children answer in full: 'three tens' or '30'." },
        { order: 3, instruction: "Swap one piece: change 234 to 244. What changed? Why?" },
        { order: 4, instruction: "Children build their own 3-digit number and explain each digit." },
      ],
      observe:  'Can the child name the value of each digit, not just its face value?',
      homeGame: "Look at a price tag. Ask: 'What does the middle number mean?'",
      tags:     ['caps_aligned', 'place_value', 'HTU', 'observation_not_test'],
      source:   'caps_aligned',
      requiresApproval: false,
    },
  ],
  Tree: [
    {
      id:       'MTH-TREE-GR3-T2-001',
      subject:  'maths',
      grade:    '3',
      term:     2,
      tier:     'Tree',
      capsRef:  'CAPS Maths Gr 3 p.28',
      title:    'Problem detectives',
      focus:    'multi-step word problems and pattern recognition',
      minutes:  20,
      groupSize: 'pair',
      materials: ['word problem cards'],
      steps: [
        { order: 1, instruction: "Read a multi-step problem aloud: 'There are 125 learners. 48 go home early. Then 17 more arrive. How many now?'" },
        { order: 2, instruction: "Children underline the key numbers and the question." },
        { order: 3, instruction: "Each pair solves it and writes the number sentences that show each step." },
        { order: 4, instruction: "'Is there another way to solve it?' Pairs share different routes to the same answer." },
        { order: 5, instruction: "Pose an open question: 'Can you write your own two-step problem for the class?'" },
      ],
      observe:  'Can the child identify which operation to use? Can they explain why?',
      homeGame: "Make up a shopping problem: 'We have R50. Bread is R14, milk is R18. How much change?'",
      tags:     ['caps_aligned', 'multi_step', 'word_problems', 'observation_not_test'],
      source:   'caps_aligned',
      requiresApproval: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// Shared activity resolver
// ---------------------------------------------------------------------------

/**
 * Look up a built-in activity.
 * Returns the first matching activity for the given subject/tier/grade/term,
 * or null if none exists (Lesedi will generate one via AI instead).
 *
 * @param {'literacy'|'maths'} subject
 * @param {'Seed'|'Sprout'|'Bloom'|'Tree'} tier
 * @param {string} grade   'R' | '1' | '2' | '3'
 * @param {number} term    1–4
 * @returns {object|null}
 */
export function lookupActivity(subject, tier, grade, term) {
  const bank = subject === 'maths' ? MATHS_ACTIVITIES : LITERACY_ACTIVITIES;
  const tierActivities = bank[tier] ?? [];
  return (
    tierActivities.find(a => a.grade === String(grade) && a.term === term) ??
    tierActivities.find(a => a.grade === String(grade)) ??
    tierActivities[0] ??
    null
  );
}

/**
 * Format an activity spec as a readable string for injection into AI prompts.
 * Used when Lesedi drafts an AI activity and needs existing examples as context.
 */
export function formatActivityForPrompt(activity) {
  if (!activity) return '';
  return [
    `Title: ${activity.title}`,
    `Focus: ${activity.focus}`,
    `CAPS ref: ${activity.capsRef}`,
    `Duration: ${activity.minutes} minutes`,
    `Group size: ${activity.groupSize}`,
    `Materials: ${activity.materials.length ? activity.materials.join(', ') : 'none'}`,
    `Steps:`,
    activity.steps.map(s => `  ${s.order}. ${s.instruction}`).join('\n'),
    `Observe: ${activity.observe}`,
    activity.homeGame ? `Home game: ${activity.homeGame}` : '',
  ].filter(Boolean).join('\n');
}

/**
 * The canonical ActivitySpec shape — used as a JSDoc typedef reference.
 * @typedef {object} ActivitySpec
 * @property {string}   id
 * @property {'literacy'|'maths'} subject
 * @property {string}   grade
 * @property {number}   term
 * @property {string}   tier
 * @property {string}   capsRef
 * @property {string}   title
 * @property {string}   focus
 * @property {number}   minutes
 * @property {'individual'|'pair'|'small_group'|'whole_class'} groupSize
 * @property {string[]} materials
 * @property {{ order: number, instruction: string, childFacing?: string, duration?: number }[]} steps
 * @property {string}   observe
 * @property {string|null} homeGame
 * @property {string[]} tags
 * @property {'caps_aligned'|'project_game'|'ai_draft'|'teacher_edit'} source
 * @property {boolean}  requiresApproval
 */
