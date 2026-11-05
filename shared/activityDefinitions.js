/**
 * activityDefinitions.js
 * Full pedagogical metadata for each Lesedi learning activity.
 *
 * This file extends the activity catalog (activityCatalog.js) with:
 *   - Learning objectives (CAPS-aligned)
 *   - Grade applicability
 *   - Curriculum skill IDs (traceable to CAPS source map)
 *   - Expected answer or behaviour
 *   - Evaluation method
 *   - Common observable misconceptions
 *   - Hint event mapping (which phraseBank/mathsBank events each activity uses)
 *   - Success criteria
 *   - Evidence types captured
 *   - Evidence classification (what the evidence tells us)
 *
 * SCAFFOLDING LEVELS (shared across all activities):
 *   0 — Independent attempt (no hint given)
 *   1 — Gentle prompt (draw attention to what the child already knows)
 *   2 — Guided hint (model a simpler version of the same problem)
 *   3 — Worked example with a DIFFERENT number/word, invite retry, offer teacher handoff
 *   F — Final stage: give the learner another opportunity to solve independently
 *
 * EVIDENCE TYPES (per the master spec):
 *   cognitive       — does the child understand the concept?
 *   visual_recognition — can the child identify/recognise visually?
 *   spoken_production — can the child say it correctly?
 *   reading_accuracy — does the child read the correct words?
 *   reading_fluency  — does the child read smoothly?
 *   comprehension    — does the child understand what they read?
 */

// ---------------------------------------------------------------------------
// Evidence type constants
// ---------------------------------------------------------------------------
export const EVIDENCE_TYPES = {
  COGNITIVE:         'cognitive',
  VISUAL_RECOGNITION:'visual_recognition',
  SPOKEN_PRODUCTION: 'spoken_production',
  READING_ACCURACY:  'reading_accuracy',
  READING_FLUENCY:   'reading_fluency',
  COMPREHENSION:     'comprehension',
};

// ---------------------------------------------------------------------------
// Observation levels (internal evidence descriptions, not DBE codes)
// ---------------------------------------------------------------------------
export const OBSERVATION_LEVELS = {
  DEMONSTRATED:            'DEMONSTRATED',
  DEVELOPING:              'DEVELOPING',
  NEEDS_FURTHER_PRACTICE:  'NEEDS_FURTHER_PRACTICE',
  INSUFFICIENT_EVIDENCE:   'INSUFFICIENT_EVIDENCE',
  TEACHER_REVIEW_REQUIRED: 'TEACHER_REVIEW_REQUIRED',
};

// ---------------------------------------------------------------------------
// Activity definitions
// ---------------------------------------------------------------------------
export const ACTIVITY_DEFINITIONS = {

  // ═══════════════════════════════════════════════════════════════════════
  // 1. READING TIME — oral reading fluency
  // ═══════════════════════════════════════════════════════════════════════
  'reading-time': {
    name: 'Reading Time',
    subject: 'English',
    grades: ['R', '1', '2', '3'],

    learningObjective:
      'Read a short age-appropriate passage aloud with fluency and expression.',
    capsRef:
      'CAPS HL Gr R p.20–21 (listening and speaking); Gr 1 p.55 (reads aloud); Gr 2 p.82 (instructional reading level); Gr 3 p.107 (fluency and comprehension)',
    curriculumSkillId: 'HL-READING-FLUENCY',

    expectedBehaviour:
      'Child reads the passage aloud. Teacher or Lesedi listens. No visible score is shown to the child.',

    evaluationMethod: 'participation',
    // Reading Time has no answer key — evaluation is based on participation
    // and optional speech transcript analysis (Phase 5).
    // Score is null (participation only) until speech intelligence is wired.

    evidenceTypes: [
      EVIDENCE_TYPES.READING_ACCURACY,
      EVIDENCE_TYPES.READING_FLUENCY,
      EVIDENCE_TYPES.COMPREHENSION,
    ],

    misconceptions: [
      'Child reads too fast and skips words (fluency issue, not comprehension issue)',
      'Child reads every word correctly but cannot retell the story (accuracy without comprehension)',
      'Child sounds out each letter separately without blending (phonics stage, not fluency)',
      'Child reads the passage silently — needs encouragement to read aloud',
    ],

    hintEvents: {
      // Reading Time uses literacy phrase bank events
      no_response:      'no_response',      // child won't read
      stuck_on_word:    'stuck_on_word',    // child stops at a word
      wrong_word:       'wrong_word_no_sense', // child reads a wrong word
      default:          'default',
    },

    // Activity-specific hint phrases (override generic phraseBank where needed)
    hintOverrides: {
      1: {
        no_response: (name) =>
          `Take your time, ${name}. Let's look at the first word together. Can you say just that one word?`,
        stuck_on_word: (name) =>
          `Good stopping, ${name}. Look at the first letter. What sound does it make?`,
        default: (name) =>
          `You're doing well, ${name}. Keep reading — I'm listening.`,
      },
      2: {
        no_response: (name) =>
          `Let's try together, ${name}. Point to the first word and I'll help you start.`,
        stuck_on_word: (name) =>
          `Look at the first letter, ${name}. Say that sound, then look at the next letter.`,
        default: (name) =>
          `Keep going, ${name}. You're reading a story — let's hear what happens next.`,
      },
      3: {
        no_response: (name) =>
          `This one is tricky, and that is okay, ${name}. Watch: I'll read the first sentence slowly. "The sun is up." Now you try the next sentence. If it's still hard, we'll ask your teacher together.`,
        stuck_on_word: (name) =>
          `This one is tricky, and that is okay, ${name}. Let me show you: for "cat" I say c-a-t, cat. Try your word the same way. If it's still hard, we'll ask your teacher together.`,
        default: (name) =>
          `This one is tricky, and that is okay, ${name}. Let me read one sentence, then you try the next. If it's still hard, we'll ask your teacher together.`,
      },
      // Final stage: invite independent retry
      F: (name) =>
        `Let's try once more, ${name}. You go first this time — I'm right here if you need me.`,
      // Praise
      correct: (name) =>
        `You read that beautifully, ${name}! Want to read the next part too?`,
    },

    successCriteria: [
      'Child attempts to read the passage aloud',
      'Child reads some or all words (participation is the primary measure)',
      'Optional: speech transcript shows increasing accuracy',
    ],

    evidenceToRecord: [
      'Participation (attempted reading or not)',
      'Speech transcript (if voice consent and microphone available)',
      'Duration of reading attempt',
      'Whether recording was captured',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 2. NUMBER HUNT — number recognition
  // ═══════════════════════════════════════════════════════════════════════
  'number-hunt': {
    name: 'Number Hunt',
    subject: 'Mathematics',
    grades: ['R', '1', '2'],

    learningObjective:
      'Identify and select a target number from a set of options (1–10).',
    capsRef:
      'CAPS Maths Gr R p.10 (number recognition to 5); Gr 1 p.12 (counting and number recognition to 20)',
    curriculumSkillId: 'MATHS-NUMBER-RECOGNITION',

    expectedBehaviour:
      'Child sees a target number and selects the matching option from 1–10.',

    evaluationMethod: 'objective',
    // Score = correct first choices / total rounds

    evidenceTypes: [
      EVIDENCE_TYPES.VISUAL_RECOGNITION,
      EVIDENCE_TYPES.COGNITIVE,
    ],

    misconceptions: [
      'Child confuses similar-looking numbers (6/9, 3/8)',
      'Child counts from 1 to find the target instead of recognising it instantly',
      'Child selects based on position rather than number value',
      'Child reverses digits (reads 12 as 21) — expected in Grade R/1',
    ],

    hintEvents: {
      // Number Hunt uses maths phrase bank events
      no_response:    'no_response',     // child doesn't select
      wrong_selection:'counts_all_from_one', // child counts from 1 instead of recognising
      default:        'default',
    },

    hintOverrides: {
      1: {
        no_response: (name) =>
          `Let's look together, ${name}. Can you find the number I'm showing you? It's right there on the screen.`,
        wrong_selection: (name) =>
          `Good try, ${name}. Look at the number I showed you. Can you find the same one down here?`,
        default: (name) =>
          `Take your time, ${name}. Which one looks the same as the number up top?`,
      },
      2: {
        no_response: (name) =>
          `Let me try a smaller one with you, ${name}. This is number 3. Can you find another 3?`,
        wrong_selection: (name) =>
          `Watch me: I see the number 5 up top. Now I look down here and find 5. Try yours the same way, ${name}.`,
        default: (name) =>
          `Look at the number at the top, ${name}. Now find the same one below.`,
      },
      3: {
        no_response: (name) =>
          `This one is tricky, and that is okay, ${name}. Watch: this is number 4. One, two, three, four — four! Now try finding yours. If it's still hard, we'll ask your teacher together.`,
        wrong_selection: (name) =>
          `This one is tricky, and that is okay, ${name}. The number up top is 7. Let me count: 1, 2, 3, 4, 5, 6, 7. Now find 7 down here. If it's still hard, we'll ask your teacher together.`,
        default: (name) =>
          `This one is tricky, and that is okay, ${name}. Let me show you one, then you try. If it's still hard, we'll ask your teacher together.`,
      },
      F: (name) =>
        `Let's try once more, ${name}. You find the number this time — I know you can do it.`,
      correct: (name) =>
        `You found it, ${name}! Can you find another one?`,
    },

    successCriteria: [
      'Child selects the correct number on first attempt',
      'Child selects the correct number after hints',
      'Child demonstrates number recognition (not just counting)',
    ],

    evidenceToRecord: [
      'First choice per round',
      'Total correct first choices / total rounds',
      'Whether hints were needed',
      'Hint level reached',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 3. COUNT AND PICK — one-to-one correspondence counting
  // ═══════════════════════════════════════════════════════════════════════
  'count-and-pick': {
    name: 'Count and Pick',
    subject: 'Mathematics',
    grades: ['R', '1', '2'],

    learningObjective:
      'Count a set of objects with one-to-one correspondence and select the correct total.',
    capsRef:
      'CAPS Maths Gr R p.10 (count to 5, one-to-one correspondence); Gr 1 p.12 (count to 20)',
    curriculumSkillId: 'MATHS-ONE-TO-ONE-COUNTING',

    expectedBehaviour:
      'Child sees a group of objects (elephants, taxis, mielies) and selects the correct count from three options.',

    evaluationMethod: 'objective',

    evidenceTypes: [
      EVIDENCE_TYPES.VISUAL_RECOGNITION,
      EVIDENCE_TYPES.COGNITIVE,
    ],

    misconceptions: [
      'Child counts too fast and skips an object (counting error, not knowledge gap)',
      'Child counts the same object twice',
      'Child guesses without counting',
      'Child counts correctly but selects the wrong number (counting ≠ number recognition)',
      'Child touches objects randomly without one-to-one correspondence',
    ],

    hintEvents: {
      no_response:    'no_response',
      wrong_selection:'counts_all_from_one',
      default:        'default',
    },

    hintOverrides: {
      1: {
        no_response: (name) =>
          `Let's count together, ${name}. Point to each one as we count. One, two...`,
        wrong_selection: (name) =>
          `Good try, ${name}. Let's count again slowly. Touch each one as you count.`,
        default: (name) =>
          `Count them one by one, ${name}. Touch each picture as you say the number.`,
      },
      2: {
        no_response: (name) =>
          `Let me try with you, ${name}. I'll point: one elephant, two elephants... Your turn — keep going!`,
        wrong_selection: (name) =>
          `Watch me count, ${name}: one, two, three, four. I touched each one once. Now try yours.`,
        default: (name) =>
          `Point and count, ${name}. Each picture gets one number. Don't skip any.`,
      },
      3: {
        no_response: (name) =>
          `This one is tricky, and that is okay, ${name}. Watch: for 3 elephants I point and say one, two, three. Three! Now try yours. If it's still hard, we'll ask your teacher together.`,
        wrong_selection: (name) =>
          `This one is tricky, and that is okay, ${name}. Let me count these: one, two, three, four. The answer is four. Now try yours the same way — touch each one. If it's still hard, we'll ask your teacher together.`,
        default: (name) =>
          `This one is tricky, and that is okay, ${name}. Let me show you with a smaller group, then you try. If it's still hard, we'll ask your teacher together.`,
      },
      F: (name) =>
        `Let's try once more, ${name}. Point to each one and count. You can do it!`,
      correct: (name) =>
        `You counted them all, ${name}! Can you count another group?`,
    },

    successCriteria: [
      'Child counts objects with one-to-one correspondence',
      'Child selects the correct total',
      'Child demonstrates counting strategy (touching/pointing, not guessing)',
    ],

    evidenceToRecord: [
      'First choice per round',
      'Total correct first choices / total rounds',
      'Whether hints were needed',
      'Hint level reached',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 4. RHYME TIME — phonological awareness (rhyme recognition)
  // ═══════════════════════════════════════════════════════════════════════
  'rhyme-time': {
    name: 'Rhyme Time',
    subject: 'English',
    grades: ['R', '1', '2'],

    learningObjective:
      'Identify which word rhymes with a given target word from three options.',
    capsRef:
      'CAPS HL Gr R p.34 (phonological awareness, rhyming); Gr 1 p.56 (phonics, word families)',
    curriculumSkillId: 'HL-RHYME-RECOGNITION',

    expectedBehaviour:
      'Child sees a target word (e.g. "cat") and selects the rhyming word from three options.',

    evaluationMethod: 'objective',

    evidenceTypes: [
      EVIDENCE_TYPES.COGNITIVE,
      EVIDENCE_TYPES.SPOKEN_PRODUCTION,
      EVIDENCE_TYPES.VISUAL_RECOGNITION,
    ],

    misconceptions: [
      'Child confuses rhyming with alliteration (e.g. picks "car" for "cat" because both start with /k/)',
      'Child picks based on visual similarity rather than sound (e.g. picks "cap" for "cat")',
      'Child does not yet understand the concept of rhyming — expected in early Grade R',
      'Child guesses randomly without listening to the words',
    ],

    hintEvents: {
      no_response:      'no_response',
      wrong_selection:  'wrong_word_no_sense',
      default:          'default',
    },

    hintOverrides: {
      1: {
        no_response: (name) =>
          `Let's listen, ${name}. I'll say the word: cat. Now which one sounds the same at the end?`,
        wrong_selection: (name) =>
          `Good try, ${name}. Listen again: cat... hat. Do they sound the same at the end? Let's try another.`,
        default: (name) =>
          `Listen to the ending sound, ${name}. Which word ends the same way?`,
      },
      2: {
        no_response: (name) =>
          `Let's try together, ${name}. Cat and hat — they both end with "-at". Can you find another word that ends the same?`,
        wrong_selection: (name) =>
          `Listen carefully, ${name}: cat... hat. They rhyme because they both end with "at". Now find the word that rhymes with the one up top.`,
        default: (name) =>
          `Say the word out loud, ${name}. Now say each option. Which one sounds the same at the end?`,
      },
      3: {
        no_response: (name) =>
          `This one is tricky, and that is okay, ${name}. Watch: "cat" rhymes with "hat" because they both end with "at". Like cat-hat, sun-run. Now try yours. If it's still hard, we'll ask your teacher together.`,
        wrong_selection: (name) =>
          `This one is tricky, and that is okay, ${name}. Rhyming words end the same way: cat-hat, sun-run. Your word is up top — which one ends the same way? If it's still hard, we'll ask your teacher together.`,
        default: (name) =>
          `This one is tricky, and that is okay, ${name}. Let me show you: dog rhymes with log. They both end with "og". Now try yours. If it's still hard, we'll ask your teacher together.`,
      },
      F: (name) =>
        `Let's try once more, ${name}. Say the word out loud and listen to the ending. Which one rhymes?`,
      correct: (name) =>
        `You found the rhyme, ${name}! Can you think of another word that rhymes?`,
    },

    successCriteria: [
      'Child selects the correct rhyming word on first attempt',
      'Child selects the correct rhyming word after hints',
      'Child demonstrates understanding of rhyming (not just visual matching)',
    ],

    evidenceToRecord: [
      'First choice per round',
      'Total correct first choices / total rounds',
      'Whether hints were needed',
      'Hint level reached',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 5. SOUND IT OUT — phoneme blending (CVC words)
  // ═══════════════════════════════════════════════════════════════════════
  'sound-it-out': {
    name: 'Sound It Out',
    subject: 'English',
    grades: ['R', '1', '2'],

    learningObjective:
      'Tap individual letter sounds, then blend them together to form a CVC word.',
    capsRef:
      'CAPS HL Gr 1 p.56 (blending and segmenting CVC words); Gr R p.34 (phonological awareness)',
    curriculumSkillId: 'HL-PHONEME-BLENDING',

    expectedBehaviour:
      'Child taps each letter to hear/explore its sound, then blends all sounds together to form the word.',

    evaluationMethod: 'participation',
    // Sound It Out has no answer key in the public catalog — evaluation is
    // based on whether the child explored all letters and attempted to blend.
    // Score is null (participation only).

    evidenceTypes: [
      EVIDENCE_TYPES.COGNITIVE,
      EVIDENCE_TYPES.VISUAL_RECOGNITION,
      EVIDENCE_TYPES.SPOKEN_PRODUCTION,
    ],

    misconceptions: [
      'Child taps letters in wrong order (right-to-left instead of left-to-right)',
      'Child names the letter instead of saying its sound (e.g. says "em" instead of /m/)',
      'Child says each sound separately but cannot blend them together',
      'Child recognises the picture and guesses the word without blending sounds',
      'Child skips letters and tries to blend an incomplete set',
    ],

    hintEvents: {
      no_response:      'says_separate_sounds', // child tapped letters but won't blend
      incomplete:       'no_response',          // child didn't tap all letters
      wrong_blend:      'wrong_word_no_sense',  // child blended but got wrong word
      default:          'default',
    },

    hintOverrides: {
      1: {
        no_response: (name) =>
          `Good exploring, ${name}. Now say the sounds fast, all together, like one word. What do you hear?`,
        incomplete: (name) =>
          `Tap each letter, ${name}. Don't skip any — each one has a sound. Start from the left.`,
        wrong_blend: (name) =>
          `Good try, ${name}. Say the sounds again, but this time push them together faster.`,
        default: (name) =>
          `Say each sound, ${name}, then slide them together. What word do you hear?`,
      },
      2: {
        no_response: (name) =>
          `Let's try together, ${name}. I'll say the sounds: v-a-n. Now fast: van! Your turn.`,
        incomplete: (name) =>
          `You missed a letter, ${name}. Point to each one from left to right. Tap them all.`,
        wrong_blend: (name) =>
          `Listen, ${name}: c-a-t... cat. I said each sound and pushed them together. Try yours the same way.`,
        default: (name) =>
          `Say each sound slowly, ${name}, then say them faster and faster until they make a word.`,
      },
      3: {
        no_response: (name) =>
          `This one is tricky, and that is okay, ${name}. Watch: s-u-n... sun! I said each sound and pushed them together. Now try yours. If it's still hard, we'll ask your teacher together.`,
        incomplete: (name) =>
          `This one is tricky, and that is okay, ${name}. Every letter has a sound. Let me tap them: s, u, n. Three sounds, one word. Now try yours — tap all three. If it's still hard, we'll ask your teacher together.`,
        wrong_blend: (name) =>
          `This one is tricky, and that is okay, ${name}. Watch: c-a-t... cat. I pushed the sounds together fast. Now try your word the same way. If it's still hard, we'll ask your teacher together.`,
        default: (name) =>
          `This one is tricky, and that is okay, ${name}. Let me show you with a different word, then you try yours. If it's still hard, we'll ask your teacher together.`,
      },
      F: (name) =>
        `Let's try once more, ${name}. Tap each letter, say each sound, then slide them all together. You can do it!`,
      correct: (name) =>
        `You blended it, ${name}! Can you try another word?`,
    },

    successCriteria: [
      'Child taps all letters in the word',
      'Child attempts to blend the sounds',
      'Child says the correct word (or a close approximation)',
      'Participation is the primary measure (no validated phonics score until speech intelligence)',
    ],

    evidenceToRecord: [
      'Whether child explored all letters',
      'Order of letter exploration (left-to-right or other)',
      'Whether child attempted to blend',
      'Whether child said the word aloud (if microphone available)',
    ],
  },
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Get the activity definition for a given activity ID.
 * @param {string} activityId
 * @returns {object|null}
 */
export function getActivityDefinition(activityId) {
  return ACTIVITY_DEFINITIONS[activityId] ?? null;
}

/**
 * Get all activity IDs for a given subject.
 * @param {string} subject 'English' | 'Mathematics'
 * @returns {string[]}
 */
export function getActivitiesBySubject(subject) {
  return Object.entries(ACTIVITY_DEFINITIONS)
    .filter(([, def]) => def.subject === subject)
    .map(([id]) => id);
}

/**
 * Get all activity IDs for a given grade.
 * @param {string} grade 'R' | '1' | '2' | '3'
 * @returns {string[]}
 */
export function getActivitiesByGrade(grade) {
  return Object.entries(ACTIVITY_DEFINITIONS)
    .filter(([, def]) => def.grades.includes(grade))
    .map(([id]) => id);
}

/**
 * Check if an activity is applicable for a given grade and subject.
 * @param {string} activityId
 * @param {string} grade
 * @param {string} subject
 * @returns {boolean}
 */
export function isActivityApplicable(activityId, grade, subject) {
  const def = ACTIVITY_DEFINITIONS[activityId];
  if (!def) return false;
  if (subject && def.subject !== subject) return false;
  return def.grades.includes(grade);
}

/**
 * Get the hint event for a given activity and observed behaviour.
 * Maps an observed game event to the phrase bank event key.
 * @param {string} activityId
 * @param {string} observedEvent  e.g. 'no_response', 'wrong_selection', 'correct'
 * @returns {string|null}
 */
export function getHintEvent(activityId, observedEvent) {
  const def = ACTIVITY_DEFINITIONS[activityId];
  if (!def) return null;
  return def.hintEvents[observedEvent] ?? def.hintEvents['default'] ?? 'default';
}

/**
 * Get an activity-specific hint phrase, falling back to the generic phrase bank.
 * @param {string} activityId
 * @param {number|string} hintLevel  0 | 1 | 2 | 3 | F (final)
 * @param {string} observedEvent
 * @param {string} firstName
 * @returns {string|null}  The hint text, or null if no override exists
 */
export function getActivityHint(activityId, hintLevel, observedEvent, firstName) {
  const def = ACTIVITY_DEFINITIONS[activityId];
  if (!def || !def.hintOverrides) return null;

  const levelKey = String(hintLevel).toUpperCase() === 'F' ? 'F' : Number(hintLevel);
  const level = def.hintOverrides[levelKey];

  // 'correct' event → praise (stored at top level, not inside each level)
  if (observedEvent === 'correct') {
    const praiseFn = def.hintOverrides.correct ?? (typeof level === 'object' ? level.correct : null);
    return praiseFn ? praiseFn(firstName) : null;
  }

  // Level 'F' is a single function (not an object with event keys)
  if (typeof level === 'function') {
    return level(firstName);
  }

  if (!level || typeof level !== 'object') return null;

  const bankEvent = getHintEvent(activityId, observedEvent);
  const fn = level[bankEvent] ?? level[observedEvent] ?? level['default'];
  return fn ? fn(firstName) : null;
}
