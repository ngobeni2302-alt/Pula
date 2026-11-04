import {serverRounds} from './activityCatalog.js';
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
  return { correct,total,attempts,seconds,score:total?Math.round(100*correct/total):null,
    limitations:total?'Choice recognition only; prompts, support and guessing can affect the result. Teacher review required.':'Participation recorded. No validated speech or phonics score is available.',
    transcriptAvailable:Boolean(transcript),speechDurationSeconds,recordingCaptured:evidence.recording_captured===true,rounds:evidence.rounds.map(r=>({choices:r.choices,letters:r.letters})) };
}
