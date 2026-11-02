/**
 * tierRules.js
 * Seed / Sprout / Bloom / Tree placement rules, HOD flags, and progression gates.
 * Source: Pula project document (not CAPS directly).
 * Injected into gap_explanation and hod_insight prompts so Lesedi can explain
 * why a child is in a tier and what the next gate check is.
 */

export const TIER_RULES = {
  Seed: {
    dbeCodes: [1, 2],
    literacy: "Can't match basic letters to sounds (b/d/p/q past age 7) or shows no emergent reading.",
    maths:    "Lacks one-to-one correspondence or can't count past 10 (Gr R/1); can't add or subtract single digits without counters (Gr 2/3).",
    hodFlag:  'CRITICAL RISK: more than 4 consecutive weeks in Seed forces a review of the Intervention Log.',
  },
  Sprout: {
    dbeCodes: [3, 4],
    literacy: 'Sounds out letters but struggles to blend; reads short phrases but forgets sight words (said, the, one).',
    maths:    'Relies on semi-concrete strategies (lines, fingers, number line); freezes crossing 19 to 20.',
    hodFlag:  'ON TRACK WITH MONITORING: push strategies to move to Bloom.',
  },
  Bloom: {
    dbeCodes: [5, 6],
    literacy: 'Reads levelled text fluently; uses punctuation cues; decodes unfamiliar words (sh-, ch-, -ight); passes written comprehension.',
    maths:    'Calculates mentally with smart strategies (28+7 as 28+2+5); understands place value.',
    hodFlag:  'STRENGTH AREA: class averages should sit here.',
  },
  Tree: {
    dbeCodes: [7],
    literacy: 'Advanced texts with expression; 8+ sentence creative stories with accurate grammar and tenses; deep comprehension.',
    maths:    'Multi-step word problems; spots patterns; explains why a rule works.',
    hodFlag:  'ENRICHMENT READY: extension activities.',
  },
};

export const PROGRESSION_GATES = {
  'R_to_1': 'Start Grade 1 as Sprout only if out of Seed in Grade R: stable motor control, numbers 1 to 5, oral phonemic awareness.',
  '1_to_2': 'Enter Grade 2 as Bloom if no longer drawing lines for maths and reads simple CVC sentences independently.',
  '2_to_3': 'Enter Grade 3 as Tree if DBE Code 7 in Grade 2, 2-digit regrouping, and fluent paragraph reading.',
};

/**
 * Returns the tier rule block as a formatted string for prompt injection.
 * @param {string} tier  'Seed' | 'Sprout' | 'Bloom' | 'Tree'
 * @param {string} subject  'literacy' | 'maths'
 */
export function formatTierRule(tier, subject = 'literacy') {
  const rule = TIER_RULES[tier];
  if (!rule) return '';
  return `Tier rule for ${tier} (${subject}): ${rule[subject]} HOD flag: ${rule.hodFlag}`;
}

/**
 * Returns all four tier rules as a compact block for the system preamble.
 */
export function formatAllTierRules() {
  return Object.entries(TIER_RULES)
    .map(([tier, r]) => `${tier} (DBE ${r.dbeCodes.join('/')}): Literacy — ${r.literacy} Maths — ${r.maths} HOD flag — ${r.hodFlag}`)
    .join('\n');
}
