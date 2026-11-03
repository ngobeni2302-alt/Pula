// Activities Data & Lesedi Review Generator for English & Mathematics

export const ENGLISH_ACTIVITIES = [
  {
    id: 'talk-and-turn',
    name: 'Talk & Turn',
    description: 'Look, talk and describe.',
    iconColor: '#8E9BFF', // Periwinkle
    purpose: 'Assess oral language, listening, speaking, vocabulary, and sentence construction.',
    prompts: ['Market', 'Basket', 'Coins'],
    imageLabel: '[Picture: market day]',
    guideText: 'Tell Lesedi one thing you can see.'
  },
  {
    id: 'sound-hunt',
    name: 'Sound Hunt',
    description: 'Find and recognise sounds.',
    iconColor: '#FDD85D', // Yellow
    purpose: 'Assess phonological awareness and sound recognition.',
    targetSound: 'S',
    stages: [
      {
        stage: 1,
        title: 'Say It',
        instruction: "Say a word with the new sound 's'. Children clap when they hear it.",
        items: [
          { word: 'Sun', hasSound: true },
          { word: 'Cat', hasSound: false },
          { word: 'Snake', hasSound: true },
          { word: 'Ball', hasSound: false }
        ]
      },
      {
        stage: 2,
        title: 'Find It',
        instruction: 'Spot items that start with the sound.',
        items: [
          { label: 'Sun', startsWith: true, emoji: '☀️' },
          { label: 'Spoon', startsWith: true, emoji: '🥄' },
          { label: 'Book', startsWith: false, emoji: '📖' },
          { label: 'Star', startsWith: true, emoji: '⭐' }
        ]
      },
      {
        stage: 3,
        title: 'Read It',
        instruction: 'Read the short sentence together.',
        sentence: 'The sun is up on the sand.',
        soundWords: ['sun', 'sand']
      }
    ]
  },
  {
    id: 'sound-sorter',
    name: 'Sound Sorter',
    description: 'Match the first sound.',
    iconColor: '#FF6B4A', // Coral
    purpose: 'Assess initial sound identification and phonics understanding.',
    rounds: [
      { id: 'ss-1', word: 'Sun', imageText: '[Picture: sun]', options: ['s', 'm'], correct: 's', soundAColor: '#FDD85D', soundBColor: '#F48FB1' },
      { id: 'ss-2', word: 'Moon', imageText: '[Picture: moon]', options: ['m', 's'], correct: 'm', soundAColor: '#8E9BFF', soundBColor: '#FDD85D' },
      { id: 'ss-3', word: 'Top', imageText: '[Picture: top]', options: ['t', 'p'], correct: 't', soundAColor: '#F48FB1', soundBColor: '#8E9BFF' },
      { id: 'ss-4', word: 'Cat', imageText: '[Picture: cat]', options: ['c', 'b'], correct: 'c', soundAColor: '#FDD85D', soundBColor: '#FF6B4A' },
      { id: 'ss-5', word: 'Star', imageText: '[Picture: star]', options: ['s', 'r'], correct: 's', soundAColor: '#FF6B4A', soundBColor: '#8E9BFF' }
    ]
  },
  {
    id: 'blend-a-word',
    name: 'Blend a Word',
    description: 'Slide the sounds together.',
    iconColor: '#4A80FF', // Blue
    purpose: 'Assess phoneme blending and early word recognition.',
    words: [
      { id: 'blend-1', letters: ['c', 'a', 't'], word: 'cat' },
      { id: 'blend-2', letters: ['s', 'u', 'n'], word: 'sun' },
      { id: 'blend-3', letters: ['m', 'a', 't'], word: 'mat' },
      { id: 'blend-4', letters: ['p', 'i', 'n'], word: 'pin' }
    ]
  }
];

export const MATHS_ACTIVITIES = [
  {
    id: 'add-numbers',
    name: 'Add Numbers',
    description: 'Hop along the number line.',
    iconColor: '#FDD85D', // Yellow
    purpose: 'Assess addition and number-line understanding.',
    question: '5 + 3 = ?',
    startNum: 5,
    addNum: 3,
    answer: 8,
    maxNum: 10,
    hints: [
      'Start at 5. Hop forward 3 times. Where do you land?',
      'Hop 1 lands on 6. Hop 2 lands on 7. One more hop lands on 8!'
    ]
  },
  {
    id: 'bead-string',
    name: 'Bead String',
    description: 'Slide beads and count.',
    iconColor: '#FF6B4A', // Coral
    purpose: 'Assess counting, number recognition, and quantity understanding.',
    totalBeads: 20,
    targetCount: 7
  },
  {
    id: 'make-a-ten',
    name: 'Make a Ten',
    description: 'Fill the ten-frame.',
    iconColor: '#8E9BFF', // Periwinkle
    purpose: 'Assess number bonds and understanding of ten.',
    question: '8 + 5 = ?',
    frameStart: 8,
    trayCount: 5,
    neededForTen: 2,
    totalAnswer: 13
  },
  {
    id: 'group-of-5',
    name: 'Group of 5',
    description: 'Count in fives.',
    iconColor: '#F48FB1', // Pink
    purpose: 'Assess grouping, repeated addition, and counting in fives.',
    rows: 4,
    perRow: 5,
    total: 20
  }
];

/**
 * Generate evidence-based Lesedi Assessment Review
 */
export function generateActivityLesediReview({
  activity,
  learner,
  sessionData,
  subject
}) {
  const learnerName = learner?.name || 'Learner';
  const tier = learner?.group || 'Seed';
  const total = sessionData?.total ?? sessionData?.totalQuestions ?? 1;
  const correct = sessionData?.correct ?? sessionData?.correctCount ?? 0;
  const accuracy = sessionData?.accuracy !== undefined ? sessionData.accuracy : Math.round((correct / total) * 100);
  const attempts = sessionData?.attempts || 1;
  const hintsUsed = sessionData?.hintsUsed || 0;

  // Confidence is determined strictly by quantity and quality of evidence captured
  let confidence = 'High';
  if (total < 3) confidence = 'Low';
  else if (total < 5 || hintsUsed > 2) confidence = 'Medium';

  if (subject === 'Mathematics') {
    switch (activity.id) {
      case 'add-numbers':
        return {
          title: `Why ${learnerName} completed Add Numbers`,
          finding: `${learnerName} hopped on the number line to solve ${activity.question || '5 + 3'}. Final answer: ${sessionData?.finalAnswer || 8} (${sessionData?.isCorrect ? 'Correct' : 'Needs practice'}). Requested ${hintsUsed} hint(s).`,
          whyItMatters: `${learnerName} demonstrates ${sessionData?.isCorrect ? 'clear' : 'developing'} spatial and ordinal number reasoning along the 0-10 number line.`,
          whatToCheck: `Check if ${learnerName} can solve 4 + 4 without visual line prompts.`,
          whatToDo: 'Practise finger hopping and backward counting from 10.',
          confidence,
          recommendedTier: null
        };

      case 'bead-string':
        return {
          title: `Why ${learnerName} completed Bead String`,
          finding: `${learnerName} slid and counted ${sessionData?.slidCount || correct} beads out of ${activity.targetCount || 7} target count (${accuracy}% accuracy).`,
          whyItMatters: 'One-to-one correspondence and physical counting precision are essential Foundation Phase numeracy foundations.',
          whatToCheck: `Verify whether ${learnerName} can subitise groups of 5 beads without counting one-by-one.`,
          whatToDo: 'Repeat bead string counting with numbers between 10 and 20.',
          confidence,
          recommendedTier: null
        };

      case 'make-a-ten':
        return {
          title: `Why ${learnerName} completed Make a Ten`,
          finding: `${learnerName} placed ${sessionData?.placedInFrame || 2} counter(s) to complete 10, and identified remaining ${sessionData?.remainingInTray || 3} counters to reach ${activity.totalAnswer || 13}.`,
          whyItMatters: 'Ten-frame structuring establishes the mental anchor needed for bridging through 10 in two-digit addition.',
          whatToCheck: 'Check number bonds to 10 (e.g. 7 + 3, 6 + 4).',
          whatToDo: 'Practise Make a Ten with double ten-frames for sums up to 20.',
          confidence,
          recommendedTier: null
        };

      case 'group-of-5':
        return {
          title: `Why ${learnerName} completed Group of 5`,
          finding: `${learnerName} counted ${activity.rows || 4} groups of 5, arriving at total ${sessionData?.countedTotal || 20} (${sessionData?.isCorrect ? 'Correct' : 'Needs practice'}).`,
          whyItMatters: 'Skip counting in fives is the gateway to multiplication readiness and grouping comprehension.',
          whatToCheck: `Test whether ${learnerName} can count backwards from 20 in fives.`,
          whatToDo: 'Reinforce grouping with 5-dot dominoes and rhythmic counting games.',
          confidence,
          recommendedTier: null
        };

      default:
        return {
          title: `Lesedi Assessment for ${learnerName}`,
          finding: `${learnerName} engaged with ${activity.name} with ${accuracy}% recorded accuracy.`,
          whyItMatters: 'Active mathematical manipulation reinforces concrete numeracy grasp.',
          whatToCheck: `Observe ${learnerName}'s confidence in independent math rounds.`,
          whatToDo: 'Continue daily Foundation Phase number checks.',
          confidence,
          recommendedTier: null
        };
    }
  }

  // English Activities
  switch (activity.id) {
    case 'sound-sorter': {
      let recTier = tier;
      let tierNote = `Maintains solid competency in ${tier}.`;
      if (accuracy >= 80 && (tier === 'Seed' || tier === 'Sprout')) {
        recTier = tier === 'Seed' ? 'Sprout' : 'Bloom';
        tierNote = `High initial sound accuracy (${accuracy}%) supports advancement to ${recTier}.`;
      }

      return {
        title: `Why ${learnerName} is in ${tier}`,
        finding: `Correctly identified ${correct} out of ${total} initial sounds (${accuracy}% accuracy).`,
        whyItMatters: `Accurate initial sound identification is a critical phonemic milestone for Grade ${learner?.room || '2'}. ${tierNote}`,
        whatToCheck: `Check if ${learnerName} can recognise initial blend sounds such as "bl" and "st".`,
        whatToDo: accuracy < 80 ? 'Repeat Sound Sorter with familiar vowel sounds.' : `Advance to Blend a Word with ${recTier} texts.`,
        confidence,
        recommendedTier: recTier !== tier ? recTier : null,
        tierReason: tierNote
      };
    }

    case 'blend-a-word': {
      let recTier = tier;
      if (accuracy >= 75 && tier === 'Seed') recTier = 'Sprout';
      else if (accuracy >= 90 && tier === 'Sprout') recTier = 'Bloom';

      return {
        title: `Why ${learnerName} is in ${tier}`,
        finding: `Blended ${correct} of ${total} phoneme sound cards. Average attempts per word: ${attempts}.`,
        whyItMatters: 'Phonemic blending bridges letter sounds to whole-word reading automaticity.',
        whatToCheck: 'Listen to oral reading of simple CVC (consonant-vowel-consonant) words in connected text.',
        whatToDo: 'Practise blending with digraphs (sh, ch, th) in small reading groups.',
        confidence,
        recommendedTier: recTier !== tier ? recTier : null,
        tierReason: `Demonstrated blending fluency of ${accuracy}%.`
      };
    }

    case 'talk-and-turn':
      return {
        title: `Why ${learnerName} is in ${tier}`,
        finding: `${learnerName} described the picture using key vocabulary (${sessionData?.selectedPrompts?.join(', ') || 'market vocabulary'}). ${sessionData?.teacherNotes || 'Engaged with confidence and descriptive details.'}`,
        whyItMatters: 'Expressive vocabulary and sentence length directly predict reading comprehension in the Foundation Phase.',
        whatToCheck: `Listen for correct preposition usage and complete sentences during conversational turns.`,
        whatToDo: 'Encourage pair-talk discussions using story cards and prompt words.',
        confidence: sessionData?.hasAudio ? 'High' : 'Medium',
        recommendedTier: null
      };

    case 'sound-hunt':
      return {
        title: `Why ${learnerName} is in ${tier}`,
        finding: `Recognised target sound "${activity.targetSound || 'S'}" across ${correct} of ${total} multi-stage sound items.`,
        whyItMatters: 'Multi-sensory sound recognition (saying, finding, reading) solidifies phoneme-grapheme association.',
        whatToCheck: 'Verify whether the learner can write the letter while making its sound.',
        whatToDo: `Try the Sound Hunt activity with ${tier} group again this week.`,
        confidence,
        recommendedTier: null
      };

    default:
      return {
        title: `Lesedi Assessment for ${learnerName}`,
        finding: `${learnerName} completed ${activity.name} (${accuracy}% accuracy).`,
        whyItMatters: 'Regular guided literacy practice develops foundational reading confidence.',
        whatToCheck: 'Monitor engagement and phonics recall in small group rounds.',
        whatToDo: 'Continue scheduled CAPS reading routines.',
        confidence,
        recommendedTier: null
      };
  }
}
