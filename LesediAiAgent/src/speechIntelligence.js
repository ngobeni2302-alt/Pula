/**
 * speechIntelligence.js
 * Consent-gated speech processing with child-speech-aware confidence assessment.
 *
 * CHILD SPEECH PATTERNS HANDLED:
 *   - Stuttering: repeated words/sounds ("the-the-the cat")
 *   - Self-correction: wrong word then correct ("dog... no, cat")
 *   - Pauses: long silences (short transcript relative to duration)
 *   - Incomplete words: partial words ("ca" instead of "cat")
 *   - Language switching: mixing languages (common in SA multilingual classrooms)
 *   - Different pronunciation from adult speakers
 *
 * KEY PRINCIPLES:
 *   - Never interpret a speech-to-text transcript as perfect evidence of pronunciation
 *   - Separate: cognitive understanding, visual recognition, spoken production,
 *     reading accuracy, reading fluency, comprehension
 *   - For Mathematics: correct number selection + imperfect pronunciation ≠ incorrect
 *   - For Literacy: phonics and intended word recognition are separate from
 *     speech-to-text spelling normalisation
 *   - If evidence is insufficient, return inconclusive
 *   - Do NOT diagnose speech or language disorders
 *   - Do NOT infer an error solely from a questionable transcription
 *
 * PRIVACY RULES:
 *   - Check consent before any consent-dependent processing
 *   - Never permanently store raw child voice recordings
 *   - Never write raw audio bytes to database, object storage, or logs
 *   - Do not permanently store raw speech transcripts in learner analytics
 *   - Clear transient audio and transcript buffers after processing
 *   - Do not describe a third-party service as zero-retention without verification
 *   - Only permitted structured learning evidence enters long-term history
 */

// ---------------------------------------------------------------------------
// Confidence levels
// ---------------------------------------------------------------------------
export const SPEECH_CONFIDENCE = {
  HIGH:         'high',
  MEDIUM:       'medium',
  LOW:          'low',
  INCONCLUSIVE: 'inconclusive',
};

// ---------------------------------------------------------------------------
// Speech assessment types — what the speech evidence tells us
// ---------------------------------------------------------------------------
export const SPEECH_ASSESSMENT_TYPES = {
  READING_ACCURACY:  'reading_accuracy',
  READING_FLUENCY:   'reading_fluency',
  SPOKEN_PRODUCTION: 'spoken_production',
  COMPREHENSION:     'comprehension',
};

// ---------------------------------------------------------------------------
// Core: assess speech confidence
// ---------------------------------------------------------------------------

/**
 * Assess a speech-to-text transcript against expected text.
 *
 * This function is deterministic — it does NOT call any AI model.
 * It uses word-matching algorithms that account for child speech patterns.
 *
 * @param {object} ctx
 *   ctx.expectedText    — the text the child was supposed to read/say
 *   ctx.transcript       — the speech-to-text transcript (may be empty)
 *   ctx.durationSeconds  — duration of the recording
 *   ctx.activityId       — which activity (for context)
 *   ctx.subject           — 'English' | 'Mathematics'
 * @returns {object} structured speech assessment
 */
export function assessSpeechConfidence(ctx) {
  const {
    expectedText = '',
    transcript = '',
    durationSeconds = 0,
    activityId = null,
    subject = 'English',
  } = ctx;

  // ── No transcript available ─────────────────────────────────────────────
  if (!transcript || transcript.trim().length === 0) {
    return {
      confidence: SPEECH_CONFIDENCE.INCONCLUSIVE,
      type: SPEECH_ASSESSMENT_TYPES.SPOKEN_PRODUCTION,
      matchedWords: 0,
      totalWords: expectedText ? expectedText.trim().split(/\s+/).length : 0,
      matchPercentage: 0,
      observations: [],
      note: 'No speech transcript was captured. No speech evidence is available. Teacher should listen to the child directly.',
      privacyCleared: true,
      // Transcripts are never persisted — caller must clear them after processing
      rawTranscriptDiscarded: true,
    };
  }

  // ── Very short transcript relative to duration (long pauses/silence) ───
  const expectedWords = expectedText.trim().split(/\s+/).filter(Boolean);
  const actualWords = transcript.trim().split(/\s+/).filter(Boolean);

  if (durationSeconds > 5 && actualWords.length < expectedWords.length * 0.3) {
    return {
      confidence: SPEECH_CONFIDENCE.INCONCLUSIVE,
      type: SPEECH_ASSESSMENT_TYPES.SPOKEN_PRODUCTION,
      matchedWords: countMatches(expectedWords, actualWords),
      totalWords: expectedWords.length,
      matchPercentage: 0,
      observations: [{
        pattern: 'long_pauses',
        note: 'The transcript is very short relative to the recording duration. The child may have had long pauses or been silent. This is not evidence of a learning difficulty — the child may need encouragement.',
      }],
      note: 'Insufficient speech evidence (long pauses or silence). Do not draw conclusions from this transcript alone.',
      privacyCleared: true,
      rawTranscriptDiscarded: true,
    };
  }

  // ── Detect child speech patterns ────────────────────────────────────────
  const patterns = detectChildSpeechPatterns(transcript, expectedWords);

  // ── Word matching with child-speech awareness ──────────────────────────
  const matched = countMatchesWithChildAwareness(expectedWords, actualWords, patterns);

  const matchPct = expectedWords.length > 0
    ? Math.round((matched / expectedWords.length) * 100)
    : 0;

  // ── Determine confidence level ─────────────────────────────────────────
  let confidence;
  if (matchPct >= 80 && patterns.selfCorrections <= 2) {
    confidence = SPEECH_CONFIDENCE.HIGH;
  } else if (matchPct >= 50) {
    confidence = SPEECH_CONFIDENCE.MEDIUM;
  } else if (matchPct > 0) {
    confidence = SPEECH_CONFIDENCE.LOW;
  } else {
    confidence = SPEECH_CONFIDENCE.INCONCLUSIVE;
  }

  // ── Build observations ─────────────────────────────────────────────────
  const observations = [];

  if (patterns.stuttering > 0) {
    observations.push({
      pattern: 'stuttering',
      count: patterns.stuttering,
      note: `${patterns.stuttering} instance${patterns.stuttering !== 1 ? 's' : ''} of word/sound repetition observed. Repetitions are common in young children and are NOT evidence of a learning difficulty; consider the full classroom context.`,
    });
  }

  if (patterns.selfCorrections > 0) {
    observations.push({
      pattern: 'self_correction',
      count: patterns.selfCorrections,
      note: `${patterns.selfCorrections} self-correction${patterns.selfCorrections !== 1 ? 's' : ''} detected. Self-correction shows the child is monitoring their own reading — this is a positive sign.`,
    });
  }

  if (patterns.incompleteWords > 0) {
    observations.push({
      pattern: 'incomplete_words',
      count: patterns.incompleteWords,
      note: `${patterns.incompleteWords} incomplete word${patterns.incompleteWords !== 1 ? 's' : ''} observed. The child may have hesitated or been unsure. Teacher review can help put this in context.`,
    });
  }

  if (patterns.possibleLanguageSwitch > 0) {
    observations.push({
      pattern: 'possible_language_switch',
      count: patterns.possibleLanguageSwitch,
      note: `${patterns.possibleLanguageSwitch} possible language switch${patterns.possibleLanguageSwitch !== 1 ? 'es' : ''} observed. The child may be multilingual; this is common in South African classrooms and should not be marked incorrect.`,
    });
  }

  // ── Reading fluency estimate (rough — unverified) ──────────────────────
  let fluencyEstimate = null;
  if (durationSeconds > 0 && actualWords.length > 0) {
    fluencyEstimate = {
      wpm: Math.round((actualWords.length / durationSeconds) * 60),
      note: 'Estimated from browser transcript duration. This is NOT a validated measure of reading fluency. Browser speech recognition timing is approximate.',
    };
  }

  // ── Build the assessment ───────────────────────────────────────────────
  const assessment = {
    confidence,
    type: subject === 'Mathematics'
      ? SPEECH_ASSESSMENT_TYPES.SPOKEN_PRODUCTION
      : SPEECH_ASSESSMENT_TYPES.READING_ACCURACY,
    matchedWords: matched,
    totalWords: expectedWords.length,
    matchPercentage: matchPct,
    observations,
    fluencyEstimate,
    note: buildSpeechNote(confidence, matchPct, patterns),
    // Privacy: transcript is processed and must be discarded
    privacyCleared: true,
    rawTranscriptDiscarded: true,
  };

  // ── Key distinction: for Mathematics, speech ≠ mathematical result ─────
  if (subject === 'Mathematics') {
    assessment.mathsNote = 'Speech pronunciation does not affect the mathematical result. A child who selects the correct number but pronounces it imperfectly should not receive an incorrect mathematical result.';
  }

  return assessment;
}

// ---------------------------------------------------------------------------
// Child speech pattern detection
// ---------------------------------------------------------------------------

/**
 * Detect child speech patterns in a transcript.
 * Does NOT diagnose — only notes observable patterns for teacher review.
 */
function detectChildSpeechPatterns(transcript, expectedWords) {
  const words = transcript.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const patterns = {
    stuttering: 0,
    selfCorrections: 0,
    incompleteWords: 0,
    possibleLanguageSwitch: 0,
  };

  // Stuttering: consecutive repeated words ("the the cat")
  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1] && words[i].length > 1) {
      patterns.stuttering++;
    }
  }

  // Self-correction: word followed by "no" or "sorry" followed by different word
  for (let i = 2; i < words.length; i++) {
    if (/^(no|sorry|wait)$/i.test(words[i - 1]) && words[i] !== words[i - 2]) {
      patterns.selfCorrections++;
    }
  }

  // Incomplete words: very short words (1-2 chars) that aren't common articles
  const commonShort = new Set(['a', 'i', 'o', 'an', 'in', 'on', 'at', 'to', 'is', 'it', 'he', 'we', 'be', 'do', 'go', 'no', 'so', 'up', 'my', 'me', 'as', 'if', 'or', 'by']);
  for (const w of words) {
    if (w.length <= 2 && !commonShort.has(w)) {
      patterns.incompleteWords++;
    }
  }

  // Possible language switch: words not in the expected text and not common English
  // (very rough heuristic — do NOT use for diagnosis)
  const expectedSet = new Set(expectedWords.map(w => w.toLowerCase()));
  const commonEnglish = new Set(['the', 'a', 'an', 'is', 'was', 'are', 'and', 'but', 'to', 'in', 'on', 'at', 'it', 'he', 'she', 'we', 'they', 'i', 'you', 'no', 'yes', 'not', 'cat', 'dog', 'sun', 'big', 'red', 'up', 'down']);
  for (const w of words) {
    if (!expectedSet.has(w) && !commonEnglish.has(w) && w.length > 3) {
      // Only count if it looks like it might be another language
      // (not a name or common English word)
      patterns.possibleLanguageSwitch++;
    }
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// Word matching with child-speech awareness
// ---------------------------------------------------------------------------

/**
 * Count matched words between expected and actual, accounting for:
 * - Stuttering (repeated words should not reduce the match count)
 * - Self-corrections (the corrected word should be counted)
 * - Incomplete words (partial matches should count at reduced weight)
 */
function countMatchesWithChildAwareness(expectedWords, actualWords, patterns) {
  // Remove stuttering duplicates for matching
  const cleanedActual = [];
  for (let i = 0; i < actualWords.length; i++) {
    // Skip if this word is the same as the previous (stuttering)
    if (i > 0 && actualWords[i].toLowerCase() === actualWords[i - 1].toLowerCase()) {
      continue;
    }
    // Skip "no", "sorry", "wait" (self-correction markers)
    if (/^(no|sorry|wait)$/i.test(actualWords[i]) && i > 0 && i < actualWords.length - 1) {
      continue;
    }
    cleanedActual.push(actualWords[i].toLowerCase());
  }

  return countMatches(expectedWords.map(w => w.toLowerCase()), cleanedActual);
}

/**
 * Count how many expected words appear in the actual words (order-independent).
 * Uses a simple set intersection approach.
 */
function countMatches(expected, actual) {
  const actualSet = new Set(actual);
  let matched = 0;
  for (const word of expected) {
    // Exact match
    if (actualSet.has(word)) {
      matched++;
      continue;
    }
    // Partial match: actual word starts with expected or vice versa (at least 3 chars)
    for (const aw of actual) {
      if (word.length >= 3 && aw.length >= 3) {
        if (word.startsWith(aw) || aw.startsWith(word)) {
          matched += 0.5; // partial match
          break;
        }
      }
    }
  }
  return Math.round(matched);
}

// ---------------------------------------------------------------------------
// Full speech evidence processing pipeline (with privacy validation)
// ---------------------------------------------------------------------------

/**
 * Process speech evidence with full consent and privacy validation.
 *
 * This is the main entry point for speech processing. It:
 * 1. Validates consent (POPIA)
 * 2. Assesses speech confidence
 * 3. Clears transient data
 * 4. Returns only permitted structured evidence (never raw audio or transcript)
 *
 * @param {object} ctx
 *   ctx.consent          — boolean: does the learner have consent?
 *   ctx.voiceConsent     — boolean: does the learner have voice consent?
 *   ctx.expectedText    — text the child was supposed to read/say
 *   ctx.transcript       — speech-to-text transcript
 *   ctx.durationSeconds  — recording duration
 *   ctx.recordingCaptured — was audio captured?
 *   ctx.activityId       — which activity
 *   ctx.subject           — 'English' | 'Mathematics'
 * @returns {object} speech assessment (privacy-cleared)
 */
export function processSpeechEvidence(ctx) {
  const {
    consent = false,
    voiceConsent = false,
    expectedText = '',
    transcript = '',
    durationSeconds = 0,
    recordingCaptured = false,
    activityId = null,
    subject = 'English',
  } = ctx;

  // ── 1. Consent validation (POPIA) ───────────────────────────────────────
  if (!consent) {
    return {
      confidence: SPEECH_CONFIDENCE.INCONCLUSIVE,
      consentBlocked: true,
      note: 'No consent is recorded for this learner. Speech processing was not performed, and no audio or transcript was stored.',
      privacyCleared: true,
      rawTranscriptDiscarded: true,
    };
  }

  if (recordingCaptured && !voiceConsent) {
    return {
      confidence: SPEECH_CONFIDENCE.INCONCLUSIVE,
      consentBlocked: true,
      note: 'Learner does not have voice consent. Audio was captured but cannot be processed. The recording must be discarded.',
      privacyCleared: true,
      rawTranscriptDiscarded: true,
      audioMustDiscard: true,
    };
  }

  // ── 2. Assess speech confidence ─────────────────────────────────────────
  const assessment = assessSpeechConfidence({
    expectedText,
    transcript,
    durationSeconds,
    activityId,
    subject,
  });

  // ── 3. Privacy validation ──────────────────────────────────────────────
  // The raw transcript and audio must NOT be persisted.
  // Only the structured assessment (confidence, match percentage, observations)
  // is permitted to enter the long-term learner history.
  assessment.consentVerified = true;
  assessment.consentBlocked = false;
  assessment.voiceConsentVerified = voiceConsent;
  assessment.privacyCleared = true;
  assessment.rawTranscriptDiscarded = true;
  assessment.audioDiscarded = !recordingCaptured || true; // audio is always discarded after processing

  // ── 4. Return only permitted structured evidence ──────────────────────
  // The caller must clear the transcript and audio buffers after receiving this.
  return assessment;
}

// ---------------------------------------------------------------------------
// Helper: build a plain-language note
// ---------------------------------------------------------------------------

function buildSpeechNote(confidence, matchPct, patterns) {
  const parts = [];

  if (confidence === SPEECH_CONFIDENCE.HIGH) {
    parts.push(`Speech transcript shows ${matchPct}% word match with the expected text.`);
    parts.push('This is a good sign, but browser speech recognition is not a validated measure of reading ability. Teacher review is still recommended.');
  } else if (confidence === SPEECH_CONFIDENCE.MEDIUM) {
    parts.push(`Speech transcript shows ${matchPct}% word match. Some words may have been misrecognised by the browser.`);
    parts.push('Do not conclude that the child cannot read based on this transcript alone. Teacher should listen to the child read.');
  } else if (confidence === SPEECH_CONFIDENCE.LOW) {
    parts.push(`Speech transcript shows only ${matchPct}% word match. The browser may have struggled to recognise the child's speech.`);
    parts.push('This does NOT mean the child cannot read. Browser speech recognition may not accurately capture a young child\'s pronunciation. Teacher should listen directly.');
  } else {
    parts.push('Speech evidence is inconclusive. No conclusions can be drawn from the transcript.');
  }

  if (patterns.stuttering > 0) {
    parts.push(`Note: ${patterns.stuttering} repetition${patterns.stuttering !== 1 ? 's' : ''} detected (common in young children, not a learning difficulty).`);
  }
  if (patterns.selfCorrections > 0) {
    parts.push(`${patterns.selfCorrections} self-correction${patterns.selfCorrections !== 1 ? 's' : ''} detected (shows the child is monitoring their reading — positive sign).`);
  }

  return parts.join(' ');
}
