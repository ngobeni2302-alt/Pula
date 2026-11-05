import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assessSpeechConfidence,
  processSpeechEvidence,
  SPEECH_CONFIDENCE,
  SPEECH_ASSESSMENT_TYPES,
} from '../../LesediAiAgent/src/speechIntelligence.js';
import { serverRounds } from '../../shared/activityCatalog.js';
import { evaluateEvidence } from '../../shared/activityEvidence.js';

// ── Speech Confidence Assessment ──────────────────────────────────────────

test('high match transcript returns high confidence', () => {
  const expected = 'The sun is up. The cat sat on a mat.';
  const transcript = 'The sun is up. The cat sat on a mat.';
  const result = assessSpeechConfidence({
    expectedText: expected, transcript, durationSeconds: 8, subject: 'English',
  });
  assert.equal(result.confidence, SPEECH_CONFIDENCE.HIGH);
  assert.ok(result.matchPercentage >= 80);
  assert.equal(result.privacyCleared, true);
  assert.equal(result.rawTranscriptDiscarded, true);
});

test('partial match returns medium confidence', () => {
  const expected = 'The sun is up. The cat sat on a mat.';
  const transcript = 'The sun is up. The cat sat on a mat.';
  // Introduce some mismatches
  const partial = 'The sun is up. The dog sat on a mat.';
  const result = assessSpeechConfidence({
    expectedText: expected, transcript: partial, durationSeconds: 8, subject: 'English',
  });
  assert.ok([SPEECH_CONFIDENCE.MEDIUM, SPEECH_CONFIDENCE.HIGH].includes(result.confidence));
  assert.ok(result.matchPercentage >= 50);
});

test('low match returns low confidence', () => {
  const expected = 'The sun is up. The cat sat on a mat.';
  const transcript = 'dog dog dog dog dog';
  const result = assessSpeechConfidence({
    expectedText: expected, transcript, durationSeconds: 8, subject: 'English',
  });
  assert.ok([SPEECH_CONFIDENCE.LOW, SPEECH_CONFIDENCE.INCONCLUSIVE].includes(result.confidence));
  assert.ok(result.matchPercentage < 50);
});

test('empty transcript returns inconclusive', () => {
  const result = assessSpeechConfidence({
    expectedText: 'The cat sat on a mat.', transcript: '', durationSeconds: 5, subject: 'English',
  });
  assert.equal(result.confidence, SPEECH_CONFIDENCE.INCONCLUSIVE);
  assert.equal(result.matchedWords, 0);
  assert.match(result.note, /No speech transcript/i);
});

test('very short transcript relative to duration returns inconclusive (long pauses)', () => {
  const result = assessSpeechConfidence({
    expectedText: 'The sun is up. The cat sat on a mat. We see a red bus.',
    transcript: 'sun',
    durationSeconds: 15,
    subject: 'English',
  });
  assert.equal(result.confidence, SPEECH_CONFIDENCE.INCONCLUSIVE);
  assert.ok(result.observations.some(o => o.pattern === 'long_pauses'));
  assert.match(result.note, /Insufficient speech evidence/i);
});

// ── Child Speech Patterns ──────────────────────────────────────────────────

test('stuttering is detected and not treated as a learning difficulty', () => {
  const transcript = 'The the the cat sat on a mat.';
  const result = assessSpeechConfidence({
    expectedText: 'The cat sat on a mat.', transcript, durationSeconds: 8, subject: 'English',
  });
  assert.ok(result.observations.some(o => o.pattern === 'stuttering'));
  const stutterObs = result.observations.find(o => o.pattern === 'stuttering');
  assert.match(stutterObs.note, /NOT evidence of a learning difficulty/i);
  assert.ok(!/dyslex|diagnos.*disorder/i.test(stutterObs.note), 'Stutter note must not diagnose');
});

test('self-correction is detected and noted as a positive sign', () => {
  const transcript = 'The dog no The cat sat on a mat.';
  const result = assessSpeechConfidence({
    expectedText: 'The cat sat on a mat.', transcript, durationSeconds: 8, subject: 'English',
  });
  const corrObs = result.observations.find(o => o.pattern === 'self_correction');
  assert.ok(corrObs, 'Should detect self-correction');
  assert.match(corrObs.note, /positive sign/i);
});

test('maths speech pronunciation does not affect mathematical result', () => {
  const result = assessSpeechConfidence({
    expectedText: '5',
    transcript: 'free',
    durationSeconds: 3,
    subject: 'Mathematics',
  });
  assert.ok(result.mathsNote, 'Should include maths note');
  assert.match(result.mathsNote, /should not receive an incorrect mathematical result/i);
});

// ── Consent Gating ─────────────────────────────────────────────────────────

test('no consent blocks speech processing', () => {
  const result = processSpeechEvidence({
    consent: false,
    expectedText: 'The cat sat on a mat.',
    transcript: 'The cat sat on a mat.',
    durationSeconds: 8,
    recordingCaptured: true,
    subject: 'English',
  });
  assert.equal(result.confidence, SPEECH_CONFIDENCE.INCONCLUSIVE);
  assert.equal(result.consentBlocked, true);
  assert.match(result.note, /consent recorded|No consent/i);
  assert.equal(result.privacyCleared, true);
  assert.equal(result.rawTranscriptDiscarded, true);
});

test('recording captured without voice consent is blocked', () => {
  const result = processSpeechEvidence({
    consent: true,
    voiceConsent: false,
    expectedText: 'The cat sat on a mat.',
    transcript: 'The cat sat on a mat.',
    durationSeconds: 8,
    recordingCaptured: true,
    subject: 'English',
  });
  assert.equal(result.confidence, SPEECH_CONFIDENCE.INCONCLUSIVE);
  assert.equal(result.consentBlocked, true);
  assert.equal(result.audioMustDiscard, true);
  assert.match(result.note, /voice consent/i);
});

test('full consent and voice consent allows processing', () => {
  const result = processSpeechEvidence({
    consent: true,
    voiceConsent: true,
    expectedText: 'The cat sat on a mat.',
    transcript: 'The cat sat on a mat.',
    durationSeconds: 8,
    recordingCaptured: true,
    subject: 'English',
  });
  assert.ok(![SPEECH_CONFIDENCE.INCONCLUSIVE].includes(result.confidence),
    'Consented processing should not be inconclusive');
  assert.equal(result.consentVerified, true);
  assert.equal(result.voiceConsentVerified, true);
});

// ── Privacy Validation ─────────────────────────────────────────────────────

test('speech processing never returns raw transcript in the result', () => {
  const transcript = 'The cat sat on a mat.';
  const result = processSpeechEvidence({
    consent: true,
    voiceConsent: true,
    expectedText: 'The cat sat on a mat.',
    transcript,
    durationSeconds: 8,
    recordingCaptured: true,
    subject: 'English',
  });
  // The result should NOT contain the raw transcript
  assert.ok(!('transcript' in result), 'Result must not include raw transcript');
  assert.ok(!('audio' in result), 'Result must not include raw audio');
  assert.ok(!('audioUrl' in result), 'Result must not include audio URL');
  assert.equal(result.privacyCleared, true);
  assert.equal(result.rawTranscriptDiscarded, true);
  assert.equal(result.audioDiscarded, true);
});

test('assessment result only contains permitted structured evidence', () => {
  const result = processSpeechEvidence({
    consent: true,
    voiceConsent: true,
    expectedText: 'The cat sat on a mat.',
    transcript: 'The cat sat on a mat.',
    durationSeconds: 8,
    recordingCaptured: true,
    subject: 'English',
  });
  // Only these fields are permitted in long-term history:
  assert.ok('confidence' in result, 'Should have confidence');
  assert.ok('matchedWords' in result, 'Should have matchedWords');
  assert.ok('totalWords' in result, 'Should have totalWords');
  assert.ok('matchPercentage' in result, 'Should have matchPercentage');
  assert.ok('observations' in result, 'Should have observations');
  assert.ok('note' in result, 'Should have note');
  // These should NOT be in the result:
  assert.ok(!('rawAudio' in result), 'Must not include raw audio');
  assert.ok(!('rawTranscript' in result), 'Must not include raw transcript');
  assert.ok(!('audioBytes' in result), 'Must not include audio bytes');
});

// ── Inconclusive Results ───────────────────────────────────────────────────

test('insufficient evidence returns inconclusive with clear note', () => {
  const result = assessSpeechConfidence({
    expectedText: 'The children plant a seed. They give it water every day.',
    transcript: '',
    durationSeconds: 0,
    subject: 'English',
  });
  assert.equal(result.confidence, SPEECH_CONFIDENCE.INCONCLUSIVE);
  assert.match(result.note, /No speech transcript/i);
});

// ── Integration with evaluateEvidence ─────────────────────────────────────

test('reading-time with speech transcript uses speech intelligence', () => {
  const rounds = serverRounds('reading-time', '2');
  const evidence = {
    rounds: [{ choices: [], letters: [] }],
    speech_transcript: 'The sun is up. The cat sat on a mat.',
    speech_duration_seconds: 10,
    recording_captured: true,
    time_taken_seconds: 12,
  };
  const result = evaluateEvidence(
    { activityId: 'reading-time', grade: '2', voiceConsent: true },
    evidence
  );
  const cls = result.evidenceClassification;
  assert.ok(cls.types.includes('reading_accuracy'));
  assert.ok(cls.types.includes('reading_fluency'));
  // Should have speech-based observations
  const accuracyObs = cls.observations.find(o => o.type === 'reading_accuracy');
  assert.ok(accuracyObs, 'Should have reading accuracy observation with speech assessment');
  assert.ok(accuracyObs.confidence, 'Should have a confidence level');
});

test('reading-time without transcript does not use speech intelligence', () => {
  const rounds = serverRounds('reading-time', '2');
  const evidence = {
    rounds: [{ choices: [], letters: [] }],
    speech_transcript: '',
    speech_duration_seconds: 0,
    recording_captured: false,
    time_taken_seconds: 12,
  };
  const result = evaluateEvidence(
    { activityId: 'reading-time', grade: '2', voiceConsent: false },
    evidence
  );
  const cls = result.evidenceClassification;
  // Should have participation note, not speech assessment
  assert.match(cls.note, /Participation recorded/i);
});

// ── Fluency Estimate ────────────────────────────────────────────────────────

test('fluency estimate is provided when transcript and duration available', () => {
  const result = assessSpeechConfidence({
    expectedText: 'The cat sat on a mat.',
    transcript: 'The cat sat on a mat.',
    durationSeconds: 6,
    subject: 'English',
  });
  assert.ok(result.fluencyEstimate, 'Should provide fluency estimate');
  assert.ok(result.fluencyEstimate.wpm > 0, 'Should calculate WPM');
  assert.match(result.fluencyEstimate.note, /NOT a validated measure/i);
});

// ── Does Not Diagnose ──────────────────────────────────────────────────────

test('speech assessment does not diagnose speech disorders', () => {
  const result = assessSpeechConfidence({
    expectedText: 'The cat sat on a mat.',
    transcript: 'The the the ca ca cat sat on a ma mat.',
    durationSeconds: 10,
    subject: 'English',
  });
  const allNotes = [result.note, ...result.observations.map(o => o.note)].join(' ');
  // Must not contain clinical diagnostic language
  assert.ok(!/dyslex|speech\s+delay|impediment|disorder/i.test(allNotes),
    'Must NOT contain diagnostic clinical language');
  // The "diagnose" word appears only in "Do not diagnose" — that is expected
  const diagLines = allNotes.match(/diagnos\w*/gi) || [];
  for (const d of diagLines) {
    // Every occurrence of "diagnose" must be preceded by "not" or "do not"
    assert.ok(/do not diagnos|Do not diagnos/i.test(allNotes), `Every "diagnose" must appear in "Do not diagnose": found "${d}"`);
  }
  // The note itself must never assert a clinical diagnosis
  assert.ok(!/dyslex|speech\s+delay|impediment|language disorder/i.test(allNotes),
    'Must not contain clinical diagnostic labels');
});
