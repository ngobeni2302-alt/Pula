import {serverRounds} from './activityCatalog.js';
import {getActivityDefinition, EVIDENCE_TYPES, OBSERVATION_LEVELS} from './activityDefinitions.js';
import {assessSpeechConfidence, SPEECH_CONFIDENCE} from '../LesediAiAgent/src/speechIntelligence.js';
export function evaluateEvidence(assignment, evidence) {
  const rounds=serverRounds(assignment.activityId,assignment.grade);
  if(!Array.isArray(evidence.rounds)||evidence.rounds.length!==rounds.length)throw Error('Complete every assigned round');
  let correct=0, total=0, attempts=0;
  for(let i=0;i<rounds.length;i++) {
    const r=evidence.rounds[i], target=rounds[i];
    if(!r||!Array.isArray(r.choices)||r.choices.length>30||!Array.isArray(r.letters)||r.letters.length>60)throw Error('Invalid round evidence');
    if(r.choices.some(x=>typeof x!=='string'||!target.options?.includes(x)))throw Error('Invalid selected option');
    if(r.letters.some(x=>!Number.isInteger(x)||x<0||x>=target.target.length))throw Error('Invalid letter selection');
    if(target.answer) {
      if(!r.choices.length)throw Error('Choose an answer for each round');
      correct+=r.choices[0]===target.answer?1:0;total++; attempts+=r.choices.length;
    } else if(assignment.activityId==='sound-it-out') {
      if(new Set(r.letters).size!==target.target.length)throw Error('Explore every letter first');
      attempts+=r.letters.length;
    }
  }
  const seconds=evidence.time_taken_seconds;
  if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<0||seconds>7200)throw Error('Invalid activity duration');
  const transcript=evidence.speech_transcript;
  if(typeof transcript!=='string'||transcript.length>1500)throw Error('Invalid transcript');
  if(transcript&&!assignment.voiceConsent)throw Error('Voice consent is required for transcription');
  const speechDurationSeconds=evidence.speech_duration_seconds??0;
  if(typeof speechDurationSeconds!=='number'||!Number.isFinite(speechDurationSeconds)||speechDurationSeconds<0||speechDurationSeconds>7200)throw Error('Invalid speech duration');
  if(evidence.recording_captured&&!assignment.voiceConsent)throw Error('Voice consent is required for recording');
  // Recorded UI choices support a recognition score. Speech alone never diagnoses phonics.
  const result={ correct,total,attempts,seconds,score:total?Math.round(100*correct/total):null,
    limitations:total?'Choice recognition only; prompts, support and guessing can affect the result. Teacher review required.':'Participation recorded. No validated speech or phonics score is available.',
    transcriptAvailable:Boolean(transcript),speechDurationSeconds,recordingCaptured:evidence.recording_captured===true,rounds:evidence.rounds.map(r=>({choices:r.choices,letters:r.letters})) };

  // ── Phase 2: Evidence type classification ──────────────────────────────
  // Classify what the evidence tells us about the child's learning.
  // This does NOT change the score — it adds context for the teacher copilot.
  result.evidenceClassification = classifyEvidence(assignment, result, evidence);
  return result;
}

/**
 * Classify the evidence captured during an activity into structured learning evidence types.
 *
 * This function distinguishes between:
 *   - Cognitive understanding (does the child understand the concept?)
 *   - Visual recognition (can the child identify/recognise visually?)
 *   - Spoken production (can the child say it correctly?)
 *   - Reading accuracy (does the child read the correct words?)
 *   - Reading fluency (does the child read smoothly?)
 *   - Comprehension (does the child understand what they read?)
 *
 * For Mathematics: a child who selects the correct number but pronounces it
 * imperfectly should not automatically receive an incorrect mathematical result.
 *
 * For Literacy: phonics and intended word recognition are considered separately
 * from speech-to-text spelling normalisation.
 *
 * @param {string} activityId
 * @param {object} evalResult — the result from evaluateEvidence (score, correct, total, etc.)
 * @param {object} rawEvidence — the raw evidence submitted (rounds, speech_transcript, etc.)
 * @returns {object} structured evidence classification
 */
export function classifyEvidence(assignment, evalResult, rawEvidence) {
  const activityId = assignment.activityId;
  const def = getActivityDefinition(activityId);
  if (!def) return { types: [], note: 'Unknown activity — no classification available.' };

  const classification = {
    activityId,
    activityName: def.name,
    subject: def.subject,
    curriculumSkillId: def.curriculumSkillId,
    capsRef: def.capsRef,
    types: [],
    observations: [],
    note: '',
  };

  // ── Activity-specific classification ────────────────────────────────────

  switch (activityId) {

    // ── Reading Time: reading accuracy + fluency + comprehension ──────────
    case 'reading-time': {
      if (evalResult.transcriptAvailable && evalResult.speechDurationSeconds > 0) {
        // Speech transcript available — use speech intelligence for assessment
        const speechAssessment = assessSpeechConfidence({
          expectedText: serverRounds('reading-time', assignment.grade)?.[0]?.target ?? '',
          transcript: rawEvidence.speech_transcript,
          durationSeconds: evalResult.speechDurationSeconds,
          activityId: 'reading-time',
          subject: 'English',
        });
        classification.types.push(EVIDENCE_TYPES.READING_ACCURACY);
        classification.types.push(EVIDENCE_TYPES.READING_FLUENCY);
        classification.observations.push({
          type: EVIDENCE_TYPES.READING_ACCURACY,
          value: `${speechAssessment.matchedWords} of ${speechAssessment.totalWords} words matched (${speechAssessment.matchPercentage}%)`,
          confidence: speechAssessment.confidence,
          note: speechAssessment.note,
        });
        if (speechAssessment.fluencyEstimate) {
          classification.observations.push({
            type: EVIDENCE_TYPES.READING_FLUENCY,
            value: `${speechAssessment.fluencyEstimate.wpm} words per minute (estimated from browser transcript — unverified)`,
            confidence: 'low',
            note: speechAssessment.fluencyEstimate.note,
          });
        }
        // Include child speech pattern observations
        for (const obs of speechAssessment.observations || []) {
          classification.observations.push({
            type: EVIDENCE_TYPES.SPOKEN_PRODUCTION,
            value: `${obs.pattern}: ${obs.note}`,
            confidence: 'low',
            note: 'Child speech pattern observed. Consider it alongside other classroom evidence.',
          });
        }
        classification.note = speechAssessment.note;
      } else {
        // No transcript — participation only
        classification.types.push(EVIDENCE_TYPES.READING_ACCURACY);
        classification.observations.push({
          type: EVIDENCE_TYPES.READING_ACCURACY,
          value: 'Participation recorded — no validated reading accuracy data.',
          confidence: 'insufficient',
          note: 'No speech transcript available. Teacher should listen to the child read to assess accuracy.',
        });
        classification.note = 'Participation recorded. No speech evidence captured. Teacher should observe reading directly.';
      }
      // Comprehension is not assessed by this activity alone
      classification.observations.push({
        type: EVIDENCE_TYPES.COMPREHENSION,
        value: 'Not assessed by this activity.',
        confidence: 'insufficient',
        note: 'Reading comprehension requires separate teacher-led assessment.',
      });
      break;
    }

    // ── Number Hunt: visual recognition + cognitive ──────────────────────
    case 'number-hunt': {
      classification.types.push(EVIDENCE_TYPES.VISUAL_RECOGNITION);
      classification.types.push(EVIDENCE_TYPES.COGNITIVE);

      if (evalResult.total > 0) {
        const accuracy = Math.round((evalResult.correct / evalResult.total) * 100);
        classification.observations.push({
          type: EVIDENCE_TYPES.VISUAL_RECOGNITION,
          value: `${evalResult.correct} of ${evalResult.total} numbers recognised on first attempt (${accuracy}%)`,
          confidence: evalResult.total >= 3 ? 'medium' : 'low',
          note: 'Number recognition from visual selection. Speech pronunciation is not assessed here.',
        });
        classification.observations.push({
          type: EVIDENCE_TYPES.COGNITIVE,
          value: accuracy >= 67 ? 'Child demonstrates number recognition' : accuracy >= 33 ? 'Child is developing number recognition' : 'Child needs further practice with number recognition',
          confidence: evalResult.total >= 3 ? 'medium' : 'low',
        });
      }

      // If speech was captured, note that pronunciation is separate from selection
      if (evalResult.transcriptAvailable) {
        classification.observations.push({
          type: EVIDENCE_TYPES.SPOKEN_PRODUCTION,
          value: 'Speech captured but not scored. A child who selects the correct number but pronounces it imperfectly should not receive an incorrect mathematical result.',
          confidence: 'insufficient',
          note: 'Speech pronunciation of numbers is separate from number recognition. Do not mark incorrect based on speech-to-text alone.',
        });
      }
      classification.note = 'Objective scoring from first choices. Speech pronunciation does not affect the mathematical result.';
      break;
    }

    // ── Count and Pick: visual recognition + cognitive ────────────────────
    case 'count-and-pick': {
      classification.types.push(EVIDENCE_TYPES.VISUAL_RECOGNITION);
      classification.types.push(EVIDENCE_TYPES.COGNITIVE);

      if (evalResult.total > 0) {
        const accuracy = Math.round((evalResult.correct / evalResult.total) * 100);
        classification.observations.push({
          type: EVIDENCE_TYPES.COGNITIVE,
          value: `${evalResult.correct} of ${evalResult.total} counts correct (${accuracy}%)`,
          confidence: evalResult.total >= 3 ? 'medium' : 'low',
          note: 'One-to-one correspondence counting. Child must count objects AND recognise the correct number.',
        });
        classification.observations.push({
          type: EVIDENCE_TYPES.VISUAL_RECOGNITION,
          value: accuracy >= 67 ? 'Child can count and identify quantities' : accuracy >= 33 ? 'Child is developing counting skills' : 'Child needs further practice with one-to-one counting',
          confidence: evalResult.total >= 3 ? 'medium' : 'low',
        });
      }
      classification.note = 'Objective scoring from first choices. Counting accuracy and number recognition are combined in this activity.';
      break;
    }

    // ── Rhyme Time: cognitive + spoken production ────────────────────────
    case 'rhyme-time': {
      classification.types.push(EVIDENCE_TYPES.COGNITIVE);
      classification.types.push(EVIDENCE_TYPES.VISUAL_RECOGNITION);

      if (evalResult.total > 0) {
        const accuracy = Math.round((evalResult.correct / evalResult.total) * 100);
        classification.observations.push({
          type: EVIDENCE_TYPES.COGNITIVE,
          value: `${evalResult.correct} of ${evalResult.total} rhymes identified (${accuracy}%)`,
          confidence: evalResult.total >= 3 ? 'medium' : 'low',
          note: 'Rhyme recognition is a phonological awareness skill. Child may recognise rhymes visually or aurally.',
        });
      }

      // Spoken production is not scored but may be relevant
      if (evalResult.transcriptAvailable) {
        classification.types.push(EVIDENCE_TYPES.SPOKEN_PRODUCTION);
        classification.observations.push({
          type: EVIDENCE_TYPES.SPOKEN_PRODUCTION,
          value: 'Speech captured but not scored. A child who identifies the rhyme without speaking demonstrates phonological awareness.',
          confidence: 'insufficient',
          note: 'Rhyme recognition does not require speech. A child who picks correctly without speaking has demonstrated the skill.',
        });
      }
      classification.note = 'Objective scoring from first choices. A child correctly identifying a rhyme without speaking has demonstrated the skill.';
      break;
    }

    // ── Sound It Out: cognitive + visual recognition + spoken production ─
    case 'sound-it-out': {
      classification.types.push(EVIDENCE_TYPES.COGNITIVE);
      classification.types.push(EVIDENCE_TYPES.VISUAL_RECOGNITION);

      // Check letter exploration order
      const rounds = rawEvidence.rounds || [];
      const allExplored = rounds.every(r => new Set(r.letters).size === (r.letters?.length || 0));
      const leftToRight = rounds.every(r => {
        const letters = r.letters || [];
        return letters.every((v, i) => i === 0 || v > letters[i - 1]);
      });

      classification.observations.push({
        type: EVIDENCE_TYPES.VISUAL_RECOGNITION,
        value: allExplored ? 'Child explored all letters in each round' : 'Child did not explore all letters',
        confidence: 'medium',
        note: leftToRight ? 'Letters explored left-to-right (expected direction).' : 'Letter exploration order was not consistently left-to-right.',
      });
      classification.observations.push({
        type: EVIDENCE_TYPES.COGNITIVE,
        value: 'Child attempted phoneme blending by tapping individual sounds. No validated phonics score is available from UI interaction alone.',
        confidence: 'low',
        note: 'Tapping letters shows engagement with phonemes, but does not validate that the child correctly blended the sounds. Teacher should listen to the child.',
      });

      if (evalResult.transcriptAvailable) {
        classification.types.push(EVIDENCE_TYPES.SPOKEN_PRODUCTION);
        classification.observations.push({
          type: EVIDENCE_TYPES.SPOKEN_PRODUCTION,
          value: 'Speech captured. Child may have said the word aloud. Transcript is unverified.',
          confidence: 'insufficient',
          note: 'Browser speech recognition may not accurately capture a child\'s pronunciation. Do not diagnose phonics ability from the transcript alone.',
        });
      }
      classification.note = 'Participation recorded. No validated phonics score is available from UI interaction alone. Teacher should listen to the child blend sounds.';
      break;
    }

    default:
      classification.note = 'No specific classification available for this activity.';
  }

  return classification;
}
