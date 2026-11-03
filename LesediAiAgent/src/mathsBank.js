/**
 * mathsBank.js
 * Offline fixed phrases for Lesedi maths hint and tutor sessions.
 * Parallel structure to phraseBank.js — same resolver pattern, maths content.
 *
 * MATHS_CHILD_PHRASES  — hint ladder levels 1–3, keyed by [hintLevel][eventType]
 * MATHS_TUTOR_PHRASES  — one-to-one tutor session events
 * MATHS_PRAISE_PHRASES — praise when a child gets it right
 *
 * First name is injected at runtime.
 * Sources: CAPS Maths Gr R–3; dataset rows M-CH-001 onward
 *
 * HINT PHILOSOPHY (maths-specific)
 * Level 1 — draw attention to what the child already knows
 * Level 2 — model a simpler version of the same problem type
 * Level 3 — worked example using a different number, then child retries
 *            (no dead end — always invite retry before teacher handoff)
 */

// ---------------------------------------------------------------------------
// MATHS_CHILD_PHRASES — hint ladder, levels 1, 2, 3
// ---------------------------------------------------------------------------
export const MATHS_CHILD_PHRASES = {
  1: {
    // Child stops / no response
    no_response: (name) =>
      `Let's look at this together, ${name}. How many do you have on this side? Count them for me.`,

    // Child counts all from 1 even though they know the first number
    counts_all_from_one: (name) =>
      `Good counting, ${name}. Can you start from the bigger number and count on from there?`,

    // Child forgets to bridge through 10
    freezes_at_ten: (name) =>
      `How many more do you need to get to 10, ${name}? Start there first.`,

    // Child mixes up operation (adds instead of subtracts or vice versa)
    wrong_operation: (name) =>
      `Read the question again, ${name}. Are we putting together or taking away?`,

    // Child writes the wrong digit in the wrong column (place value error)
    place_value_error: (name) =>
      `Look at where you wrote that number, ${name}. Is it in the tens column or the units column?`,

    // Child uses tally lines / fingers past the point where mental should work
    semi_concrete_overuse: (name) =>
      `You know this one, ${name}. Try it in your head first — then check with your fingers if you need to.`,

    default: (name) =>
      `Let's try again, ${name}. What do you know about this problem already?`,
  },
  2: {
    no_response: (name) =>
      `Let me try a smaller one with you, ${name}. If I have 2 apples and get 1 more, how many? Good. Now try yours.`,

    counts_all_from_one: (name) =>
      `Watch me: I start at 5 and count on: 5… 6, 7, 8. Try starting at your bigger number, ${name}.`,

    freezes_at_ten: (name) =>
      `Let's go to 10 first, ${name}. How many steps to 10? Now how many are left over?`,

    wrong_operation: (name) =>
      `If you have 8 sweets and give away 3, do you have more or fewer? Same idea here, ${name}.`,

    place_value_error: (name) =>
      `The tens live in the left column and units live on the right, ${name}. Where does your answer live?`,

    semi_concrete_overuse: (name) =>
      `Cover your fingers, ${name}. 7 + 6 — say 7, then count on: 8, 9, 10, 11, 12, 13. Did you get 13?`,

    default: (name) =>
      `Let me show you a similar one, ${name}. Watch, then you try yours.`,
  },
  // Level 3 — worked example on a DIFFERENT number, then retry, THEN teacher
  3: {
    no_response: (name) =>
      `This one is tricky, and that is okay, ${name}. Watch me try 2 + 3: I put 2 in my head and count on 3 more — 3, 4, 5. Now try your problem the same way. If it is still hard, we will ask your teacher together.`,

    counts_all_from_one: (name) =>
      `This one is tricky, ${name}. Watch: for 5 + 4 I say 5, then 6, 7, 8, 9 — I never go back to 1. Try your sum that way. If you are still not sure, your teacher will help us.`,

    freezes_at_ten: (name) =>
      `This is the tricky bridge, ${name}. For 8 + 5: I go 8 → 10 (that is 2), then I have 3 left, so 10 + 3 = 13. Try yours the same way. If it is still hard, we will ask your teacher.`,

    wrong_operation: (name) =>
      `This one is tricky, ${name}. For 'I have 9 and give 4 away': 9 take away 4 is 5. Taking away means the answer is smaller. Now try yours. If you are still stuck, your teacher will help.`,

    place_value_error: (name) =>
      `This one is tricky, ${name}. In 34: the 3 means three tens (30), the 4 means four units (4). So 34 is 30 + 4. Try reading your number the same way. We can ask your teacher if you are still unsure.`,

    semi_concrete_overuse: (name) =>
      `This one is tricky, ${name}. For 14 + 8: I break 8 into 6 + 2. 14 + 6 = 20, then 20 + 2 = 22. Try breaking your number. If it is still hard, your teacher will help.`,

    default: (name) =>
      `This one is tricky, and that is okay, ${name}. Let me show you one like it, then you try yours. If it is still hard, we will ask your teacher together.`,
  },
};

// ---------------------------------------------------------------------------
// MATHS_TUTOR_PHRASES — one-to-one tutor events
// ---------------------------------------------------------------------------
export const MATHS_TUTOR_PHRASES = {
  // Child is silent / anxious about maths
  silent_or_anxious: (name) =>
    `Hi ${name}. There are no wrong answers right now — we are just exploring. Can you show me with your fingers how many 3 is? Any answer helps me.`,

  // Child keeps writing the same wrong strategy (e.g. counting all from 1 in Gr 2)
  same_error_third_session: (name, target, errorPattern) => ({
    child:       `${name}, you are remembering the steps well. This time, let's try starting from the bigger number instead of going back to 1. Ready? Say the bigger number out loud first.`,
    teacherFlag: `${name} has used the '${errorPattern ?? 'count all from 1'}' strategy for ${target ?? 'addition'} in 3 sessions. Consider a 'count on' or 'bridging through 10' activity.`,
    parentTip:   `Draft for teacher approval: Ask ${name} to hold up 5 fingers on one hand and count on 3 more from 5 — not from 1. Praise the try.`,
  }),

  // Child asks for the maths answer directly
  asks_for_the_answer: (name) =>
    `I want you to be able to do this yourself, ${name}. Let me show you one like it: 4 + 3. I start at 4 and count on 3: 5, 6, 7. Now try your sum the same way. If it is still tricky, we will ask your teacher together.`,

  // Child completes one problem and stops ("I'm done")
  finishes_early: (name) =>
    `Good work on that one, ${name}! Now tell me — how did you work it out? Then let's try the next one.`,

  // Child gets the right answer but can't explain how
  correct_no_explanation: (name) =>
    `Well done, ${name}! Now teach me: how did you get that answer? I want to learn your way.`,

  // Child uses concrete objects past the expected stage
  still_using_fingers_gr3: (name) =>
    `Your fingers are always there, ${name}. This time, try it in your head first. If you get the same answer without fingers, you will know you've really got it.`,

  default: (name) =>
    `Good effort, ${name}. Let's look at this one more time. What do you know already?`,
};

// ---------------------------------------------------------------------------
// MATHS_PRAISE_PHRASES
// ---------------------------------------------------------------------------
export const MATHS_PRAISE_PHRASES = {
  correct: (name) =>
    `You worked that out, ${name}! Can you show me another way to get the same answer?`,

  correct_mental: (name) =>
    `You did that in your head, ${name}! How did you know where to start?`,

  good_try: (name) =>
    `Good try, ${name}. You are nearly there — let's check one step.`,
};

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

/**
 * Resolve a maths child_hint phrase.
 * @param {number} hintLevel  1 | 2 | 3
 * @param {string} event      event key from MATHS_CHILD_PHRASES
 * @param {string} firstName
 * @returns {{ text: string, source: 'maths_bank', handoff: boolean }}
 */
export function resolveMathsChildPhrase(hintLevel, event, firstName) {
  const level = MATHS_CHILD_PHRASES[hintLevel] ?? MATHS_CHILD_PHRASES[1];
  const fn    = level[event] ?? level['default'];
  return {
    text:    fn(firstName),
    source:  'maths_bank',
    handoff: hintLevel >= 3,
  };
}

/**
 * Resolve a maths child_tutor phrase.
 * @param {string} event
 * @param {string} firstName
 * @param {string} [target]       e.g. 'addition'
 * @param {string} [errorPattern] e.g. 'count all from 1'
 * @returns {{ text: string, teacherFlag?: string, parentTip?: string, source: 'maths_bank', handoff: boolean }}
 */
export function resolveMathsTutorPhrase(event, firstName, target, errorPattern) {
  const fn = MATHS_TUTOR_PHRASES[event] ?? MATHS_TUTOR_PHRASES['default'];

  if (event === 'same_error_third_session') {
    const parts = fn(firstName, target, errorPattern);
    return {
      text:        parts.child,
      teacherFlag: parts.teacherFlag,
      parentTip:   parts.parentTip,
      source:      'maths_bank',
      handoff:     false,
      requiresApproval: true,
    };
  }

  return {
    text:    fn(firstName),
    source:  'maths_bank',
    handoff: false,
  };
}
