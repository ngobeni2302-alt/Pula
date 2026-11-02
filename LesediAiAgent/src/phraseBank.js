/**
 * phraseBank.js
 * Offline fixed phrases for Lesedi child-voice hints and child-tutor sessions.
 * Served without calling the AI model — fast, safe, consistent.
 *
 * CHILD_PHRASES  — keyed [hintLevel][eventType], used by child_hint task
 * TUTOR_PHRASES  — keyed [eventType], used by child_tutor task
 * PRAISE_PHRASES — used when event === 'correct'
 *
 * First name is injected at runtime.
 * Source rows: CH-001 to CH-003, G1-CH-001, G2-CH-001, G3-CH-001, T-001 to T-005 (dataset v3)
 */

// ---------------------------------------------------------------------------
// child_hint phrases — hint ladder levels 1, 2, 3
// ---------------------------------------------------------------------------
export const CHILD_PHRASES = {
  1: {
    no_response:           (name) => `Good try, ${name}. Say your name slowly, like a snail. What sound do you hear first?`,
    stuck_on_word:         (name) => `Good stopping to think, ${name}. Look at the picture first. Then say the first sounds. Does your word sound right and make sense?`,
    says_separate_sounds:  (name) => `Let's say the sounds slowly, ${name}. Now say them again, closer together, like a train. What word do you hear?`,
    wrong_word_no_sense:   (name) => `Hmm, let's check that sentence, ${name}. Read it again and listen. Does it make sense?`,
    // aliases for dataset v2 event names
    says_separate:         (name) => `Let's say the sounds slowly, ${name}. Now say them again, closer together, like a train. What word do you hear?`,
    wrong_word:            (name) => `Hmm, let's check that sentence, ${name}. Read it again and listen. Does it make sense?`,
    default:               (name) => `Good try, ${name}. Look again and think about what makes sense here.`,
  },
  2: {
    no_response:           (name) => `Let's try together, ${name}. Clap the sounds in your name. What do you clap first?`,
    stuck_on_word:         (name) => `Look at the first letter, ${name}. Say that sound. Then look at the rest of the word.`,
    says_separate_sounds:  (name) => `Great, ${name} — you know the sounds! Now squash them together fast, like one word. Try it.`,
    wrong_word_no_sense:   (name) => `Let's go back, ${name}. Read that part again. Ask yourself: does it make sense?`,
    says_separate:         (name) => `Great, ${name} — you know the sounds! Now squash them together fast, like one word. Try it.`,
    wrong_word:            (name) => `Let's go back, ${name}. Read that part again. Ask yourself: does it make sense?`,
    default:               (name) => `Keep going, ${name}. You are almost there. What do you notice about that word?`,
  },
  // Level 3: v3 dataset (CH-002) — give a worked example first, then retry, THEN hand off.
  // No more dead-end. "no_dead_end" tag from v3.
  3: {
    default:               (name) => `This one is tricky, and that is okay, ${name}. Let me show you with another word: 'sun' starts with the sound 'sss'. Now say your name slowly, and listen for the first sound. If it's still hard, we'll do it with your teacher together.`,
    no_response:           (name) => `This one is tricky, and that is okay, ${name}. Let me show you with another word: 'sun' starts with the sound 'sss'. Now say your name slowly, and listen for the first sound. If it's still hard, we'll do it with your teacher together.`,
    stuck_on_word:         (name) => `This one is tricky, and that is okay, ${name}. Let me show you one like it. Look at 'red': r-e-d, red. Some words don't sound the way they look, so we learn them by heart. Try once more. If it's still hard, we'll ask your teacher together.`,
    says_separate_sounds:  (name) => `This one is tricky, and that is okay, ${name}. Listen: 'c' 'a' 't' — now fast: cat. Try your word the same way. If it's still hard, we'll do it with your teacher together.`,
    wrong_word_no_sense:   (name) => `This one is tricky, and that is okay, ${name}. Let's re-read the sentence together slowly. If it's still hard, we'll ask your teacher together.`,
    says_separate:         (name) => `This one is tricky, and that is okay, ${name}. Listen: 'c' 'a' 't' — now fast: cat. Try your word the same way. If it's still hard, we'll do it with your teacher together.`,
    wrong_word:            (name) => `This one is tricky, and that is okay, ${name}. Let's re-read the sentence together slowly. If it's still hard, we'll ask your teacher together.`,
    three_tries_unsure:    (name) => `This one is tricky, and that is okay, ${name}. Let me show you with another word: 'sun' starts with the sound 'sss'. Now say your name slowly, and listen for the first sound. If it's still hard, we'll do it with your teacher together.`,
  },
};

// ---------------------------------------------------------------------------
// child_tutor phrases — one-to-one tutor session events (T-001 to T-005)
// ---------------------------------------------------------------------------
export const TUTOR_PHRASES = {
  // T-001: shy / silent child
  whispers_or_stays_silent: (name) =>
    `Hi ${name}. It's just you and me, and nobody else can hear. You can whisper if you like. Shall we look at the picture first, and you tell me one thing you see? Any answer is a good answer.`,

  // T-002: same error three sessions in a row (b/d confusion)
  // Returns { child, teacherFlag, parentTip } — engine splits these
  same_error_third_session: (name, target, errorPattern) => ({
    child:       `That one is a sneaky pair, ${target} and ${errorPattern?.replace('says ', '') ?? 'd'}. Let's try another way. Make a fist with your left hand and put your thumb up: that's a b, with the belly on the right. Now try again.`,
    teacherFlag: `${name} said ${errorPattern ?? 'the wrong sound'} for ${target} in 3 sessions. Suggest a ${target}/${errorPattern?.replace('says ', '') ?? 'd'} activity in the sand tray.`,
    parentTip:   `Draft for teacher approval: Please trace ${target} and ${errorPattern?.replace('says ', '') ?? 'd'} with your finger on ${name}'s back and say the sound out loud.`,
  }),

  // T-003: child asks for the answer directly (hint level 3)
  asks_for_the_answer: (name) =>
    `I want you to be able to do this yourself, so let me show you one like it. Look at 'red': r-e-d, red. Some words, like 'said', don't sound the way they look, so we learn them by heart. Try 'said' once more. If it's still tricky, we'll ask your teacher together.`,

  // T-004: child writes one sentence and stops
  writes_one_sentence_and_stops: (name) =>
    `Nice first sentence, ${name}! Now tell me out loud what happens next, and I will wait. Then try to write the first word of that part. You decide how many sentences it needs.`,

  // T-005: child finishes reading a page
  read_one_page: (name) =>
    `You read a whole page, ${name}! I heard you work on the 'th' words. Want to read it again, or try the next page?`,

  default: (name) =>
    `Good work, ${name}. Let's keep going. What do you notice next?`,
};

// ---------------------------------------------------------------------------
// Praise phrases
// ---------------------------------------------------------------------------
export const PRAISE_PHRASES = {
  correct:  (name) => `You listened carefully, ${name}! Can you think of another word that starts with that sound?`,
  good_try: (name) => `Good try, ${name}! Let's keep going.`,
};

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

/**
 * Resolve a child_hint phrase from the bank.
 * @param {number} hintLevel  1 | 2 | 3
 * @param {string} event
 * @param {string} firstName
 * @returns {{ text: string, source: 'phrase_bank', handoff: boolean }}
 */
export function resolveChildPhrase(hintLevel, event, firstName) {
  const level = CHILD_PHRASES[hintLevel] ?? CHILD_PHRASES[1];
  const fn    = level[event] ?? level['default'];
  return {
    text:    fn(firstName),
    source:  'phrase_bank',
    handoff: hintLevel >= 3,
  };
}

/**
 * Resolve a child_tutor phrase.
 * @param {string} event
 * @param {string} firstName
 * @param {string} [target]       e.g. 'b' (for b/d confusion)
 * @param {string} [errorPattern] e.g. 'says d for b'
 * @returns {{ text: string, teacherFlag?: string, parentTip?: string, source: 'phrase_bank', handoff: boolean }}
 */
export function resolveTutorPhrase(event, firstName, target, errorPattern) {
  const fn = TUTOR_PHRASES[event] ?? TUTOR_PHRASES['default'];

  // same_error_third_session returns a structured object
  if (event === 'same_error_third_session') {
    const parts = fn(firstName, target, errorPattern);
    return {
      text:        parts.child,
      teacherFlag: parts.teacherFlag,
      parentTip:   parts.parentTip,
      source:      'phrase_bank',
      handoff:     false,
      requiresApproval: true, // parentTip is a draft
    };
  }

  return {
    text:    fn(firstName),
    source:  'phrase_bank',
    handoff: false,
  };
}
