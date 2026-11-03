/**
 * tierRules.js
 * Seed / Sprout / Bloom / Tree placement rules for Literacy and Maths.
 *
 * SOURCES
 *   Tier rules     — Pula project document (internal, agreed by teachers and HODs)
 *   CAPS refs      — cited per gate and per rule for transparency
 *   HOD flags      — internal Pula alert thresholds
 *
 * These are separate from CAPS policy guardrails (see guardrails.js).
 * Tier rules explain placement. Guardrails block bad requests.
 */

// ---------------------------------------------------------------------------
// Core tier rules — literacy and maths, per tier
// ---------------------------------------------------------------------------
export const TIER_RULES = {
  Seed: {
    dbeCodes: [1, 2],
    literacy: {
      description: "Can't match basic letters to sounds (b/d/p/q past age 7) or shows no emergent reading.",
      capsRef:     'CAPS HL Gr R–1 p.34, p.56 (phonological awareness; letter-sound matching)',
      strategies:  ['sand tray for b/d/p/q', 'name-sound circle daily', 'shared reading with pointer'],
    },
    maths: {
      description: "Lacks one-to-one correspondence or can't count past 10 (Gr R/1); can't add or subtract single digits without concrete objects (Gr 2/3).",
      capsRef:     'CAPS Maths Gr R p.10 (count to 5); Gr 1 p.12 (count to 20); Gr 2 p.16 (single-digit operations)',
      strategies:  ['counting bodies and objects daily', 'number line walk', 'counters add-on game'],
    },
    hodFlag: {
      level:   'CRITICAL RISK',
      trigger: 'More than 4 consecutive weeks in Seed.',
      action:  'Review the Intervention Log. Confirm a strategy change has been tried. Alert the HOD.',
    },
  },
  Sprout: {
    dbeCodes: [3, 4],
    literacy: {
      description: 'Sounds out letters but struggles to blend; reads short phrases but forgets sight words (said, the, one).',
      capsRef:     'CAPS HL Gr 1 p.56–57 (blending, segmenting, sight words); Gr 2 p.81 (word families)',
      strategies:  ['daily 5-minute blending practice', 'sight-word card flip', 'word family -at/-am/-it'],
    },
    maths: {
      description: 'Relies on semi-concrete strategies (tally lines, fingers, number line); freezes when crossing 10 or 20.',
      capsRef:     'CAPS Maths Gr 1 p.22 (bridging through 10); Gr 2 p.38 (two-digit operations)',
      strategies:  ['jump the 10 bridge game', 'lines-and-dots subtraction', 'bead string to 20'],
    },
    hodFlag: {
      level:   'ON TRACK WITH MONITORING',
      trigger: 'Child in Sprout and progressing.',
      action:  'Push strategies to move toward Bloom. Re-observe in 2 weeks.',
    },
  },
  Bloom: {
    dbeCodes: [5, 6],
    literacy: {
      description: 'Reads levelled text fluently; uses punctuation cues; decodes unfamiliar words (sh-, ch-, -ight); passes written comprehension.',
      capsRef:     'CAPS HL Gr 2 p.82 (instructional level 90–95%); Gr 3 p.107 (higher-order questions)',
      strategies:  ['levelled reader at instructional level', 'story builders', 'reading detectives'],
    },
    maths: {
      description: 'Calculates mentally with smart strategies (28+7 as 28+2+5); understands place value; adds and subtracts 2-digit numbers without concrete objects.',
      capsRef:     'CAPS Maths Gr 2 p.40 (mental maths strategies); Gr 3 p.24 (place value HTU)',
      strategies:  ['smart strategies race', 'place value flip cards', 'mental maths chain'],
    },
    hodFlag: {
      level:   'STRENGTH AREA',
      trigger: 'Class average should sit here.',
      action:  'Maintain. Identify children close to Tree and check if enrichment is needed.',
    },
  },
  Tree: {
    dbeCodes: [7],
    literacy: {
      description: 'Advanced texts with expression; 8+ sentence creative stories with accurate grammar and tenses; deep comprehension.',
      capsRef:     'CAPS HL Gr 3 p.107–109 (higher-order comprehension; extended writing)',
      strategies:  ['open-ended reading detective tasks', 'independent writing with self-check', 'peer discussion'],
    },
    maths: {
      description: 'Multi-step word problems; spots patterns; explains why a rule works.',
      capsRef:     'CAPS Maths Gr 3 p.28 (multi-step problems); p.32 (patterns and relationships)',
      strategies:  ['problem detectives', 'make-your-own-problem challenge', 'pattern rule explanation'],
    },
    hodFlag: {
      level:   'ENRICHMENT READY',
      trigger: 'Child in Tree tier.',
      action:  'Provide enrichment activities. Confirm with teacher that the placement is accurate.',
    },
  },
};

// ---------------------------------------------------------------------------
// Progression gates — what a child needs to move between grades
// ---------------------------------------------------------------------------
export const PROGRESSION_GATES = {
  R_to_1: {
    label:   'Grade R → Grade 1',
    summary: 'Start Grade 1 as Sprout only if out of Seed in Grade R.',
    literacy: 'Oral phonemic awareness: first sounds of own name, spotting odd sounds, 3-word sequences.',
    maths:    'Numbers 1 to 5 with one-to-one correspondence; stable motor control for writing.',
    capsRef:  'CAPS Maths Gr R p.7; CAPS HL Gr R p.21',
    note:     'Grade R is observed, not coded. No DBE code required at this gate.',
  },
  '1_to_2': {
    label:   'Grade 1 → Grade 2',
    summary: 'Enter Grade 2 as Bloom if reading CVC sentences independently and no longer drawing tally lines.',
    literacy: 'Reads simple CVC sentences independently at 90%+ accuracy.',
    maths:    'Adds and subtracts single digits without counters; counts to 20 reliably.',
    capsRef:  'CAPS HL Gr 1 p.57; CAPS Maths Gr 1 p.22',
    note:     'DBE code 5 or above in both literacy and maths is a strong signal for Bloom entry.',
  },
  '2_to_3': {
    label:   'Grade 2 → Grade 3',
    summary: 'Enter Grade 3 as Tree if DBE Code 7 in Grade 2, 2-digit regrouping, and fluent paragraph reading.',
    literacy: 'Fluent paragraph reading with expression; written comprehension passes.',
    maths:    '2-digit addition and subtraction with regrouping; understands place value HTU.',
    capsRef:  'CAPS Maths Gr 2 p.40; CAPS HL Gr 2 p.82',
    note:     'DBE code 7 required. Confirm both literacy and maths before Tree placement.',
  },
};

// ---------------------------------------------------------------------------
// HOD alert thresholds (PROJECT rules, not CAPS)
// ---------------------------------------------------------------------------
export const HOD_ALERTS = {
  seed_critical_weeks:   4,   // Weeks in Seed before Intervention Log review is triggered
  stagnation_weeks:      6,   // Weeks in same tier with no measurable progress = stagnation alert
  no_consent_max_weeks:  2,   // Max weeks a learner can be in the system without consent before HOD flag
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Return the tier rule block for a given tier and subject, formatted for prompt injection.
 * @param {string} tier     'Seed' | 'Sprout' | 'Bloom' | 'Tree'
 * @param {string} subject  'literacy' | 'maths'
 * @returns {string}
 */
export function formatTierRule(tier, subject = 'literacy') {
  const rule = TIER_RULES[tier];
  if (!rule) return '';
  const sub = rule[subject];
  return [
    `Tier: ${tier} (DBE codes ${rule.dbeCodes.join('/')}), subject: ${subject}`,
    `Rule: ${sub.description}`,
    `CAPS ref: ${sub.capsRef}`,
    `Suggested strategies: ${sub.strategies.join('; ')}`,
    `HOD flag: ${rule.hodFlag.level} — ${rule.hodFlag.trigger} ${rule.hodFlag.action}`,
  ].join('\n');
}

/**
 * Return all four tier rules for both subjects — compact block for CAPS_PREAMBLE injection.
 * @param {string} subject  'literacy' | 'maths' — if omitted, returns both
 * @returns {string}
 */
export function formatAllTierRules(subject) {
  return Object.entries(TIER_RULES)
    .map(([tier, r]) => {
      const subjects = subject ? [subject] : ['literacy', 'maths'];
      const lines = subjects.map(s => `  ${s}: ${r[s].description}`);
      return `${tier} (DBE ${r.dbeCodes.join('/')}): HOD flag — ${r.hodFlag.level}\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

/**
 * Return the progression gate block for a given grade transition.
 * @param {string} fromGrade  'R' | '1' | '2'
 * @returns {string}
 */
export function formatGate(fromGrade) {
  const key = fromGrade === 'R' ? 'R_to_1' : fromGrade === '1' ? '1_to_2' : '2_to_3';
  const gate = PROGRESSION_GATES[key];
  if (!gate) return '';
  return [
    `Progression gate: ${gate.label}`,
    `Summary: ${gate.summary}`,
    `Literacy: ${gate.literacy}`,
    `Maths: ${gate.maths}`,
    `CAPS ref: ${gate.capsRef}`,
    gate.note ? `Note: ${gate.note}` : '',
  ].filter(Boolean).join('\n');
}

/**
 * Check if the Seed 4-week HOD alert should fire.
 * This is now a CODE check, not an AI prompt instruction.
 * @param {string} group
 * @param {number} weeksInTier
 * @returns {boolean}
 */
export function isSeedCritical(group, weeksInTier) {
  return group === 'Seed' && Number(weeksInTier) >= HOD_ALERTS.seed_critical_weeks;
}

/**
 * Check if a stagnation alert should fire.
 * @param {number} weeksInTier
 * @returns {boolean}
 */
export function isStagnant(weeksInTier) {
  return Number(weeksInTier) >= HOD_ALERTS.stagnation_weeks;
}
