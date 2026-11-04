import { ACTIVITIES, serverRounds } from './catalog.js';
export {evaluateEvidence} from '../../../shared/activityEvidence.js';
export function validateLesediResponse(r) {
  if(!r||typeof r!=='object')throw Error('Invalid Lesedi response');
  const c=r.kiro_state_control,a=r.lesedi_avatar_output,t=r.teacher_private_draft_analytics;
  const text=(v,max=3000)=>typeof v==='string'&&v.length>0&&v.length<=max;
  if(!c||!['MATCH','PARTIAL_MATCH','PARTICIPATION','NO_MATCH'].includes(c.action_evaluation)||c.next_ui_state!=='TRANSITION_TO_WELL_DONE')throw Error('Invalid state control');
  if(!a||!['LESEDI_HAPPY_CELEBRATE','LESEDI_ENCOURAGE'].includes(a.animation_trigger)||!text(a.speech_text,300))throw Error('Invalid avatar output');
  if(a.ssml_speech_tags!==undefined&&!text(a.ssml_speech_tags,1000))throw Error('Invalid SSML');
  if(!t||!(t.accuracy_score_percentage===null||typeof t.accuracy_score_percentage==='number'&&Number.isFinite(t.accuracy_score_percentage)&&t.accuracy_score_percentage>=0&&t.accuracy_score_percentage<=100)||
     !text(t.professional_analysis_for_teacher)||!text(t.proposed_teacher_classroom_intervention)||!text(t.draft_parent_update))throw Error('Invalid private analytics');
  // Pick fields explicitly: extra provider fields never escape to child endpoints.
  return {kiro_state_control:{action_evaluation:c.action_evaluation,next_ui_state:c.next_ui_state},
    lesedi_avatar_output:{animation_trigger:a.animation_trigger,speech_text:a.speech_text},
    teacher_private_draft_analytics:{accuracy_score_percentage:t.accuracy_score_percentage,
      professional_analysis_for_teacher:t.professional_analysis_for_teacher,
      proposed_teacher_classroom_intervention:t.proposed_teacher_classroom_intervention,
      draft_parent_update:t.draft_parent_update}};
}
export async function evaluate(assignment, learner, evidence, result) {
  const mode=process.env.LESEDI_CORE_MODE||'mock';
  let response;
  if(mode==='live') {
    const url=new URL(process.env.LESEDI_CORE_URL);
    if(url.protocol!=='https:')throw Error('Lesedi requires HTTPS');
    const r=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.LESEDI_CORE_KEY||''}`},body:JSON.stringify({context_mode:'GAMEPLAY_EVALUATION',payload:{student_id:learner.id,child_name:learner.name.split(' ')[0],grade:`Grade ${assignment.grade}`,activity:ACTIVITIES[assignment.activityId].name,target_goal:serverRounds(assignment.activityId,assignment.grade).map(r=>r.target).join(' '),selected_ui_element:'btn_im_done',speech_transcript:evidence.speech_transcript,time_taken_seconds:result.seconds,choice_evidence:result.rounds}})});
    if(!r.ok)throw Error('Lesedi service unavailable');
    const body=await r.text();if(body.length>24000)throw Error('Lesedi response too large');response=JSON.parse(body);
  } else if(mode==='mock'&&process.env.NODE_ENV!=='production') {
    response={kiro_state_control:{action_evaluation:result.score===null?'PARTICIPATION':result.score===100?'MATCH':result.score===0?'NO_MATCH':'PARTIAL_MATCH',next_ui_state:'TRANSITION_TO_WELL_DONE'},
      lesedi_avatar_output:{animation_trigger:'LESEDI_HAPPY_CELEBRATE',speech_text:`You did it, ${learner.name.split(' ')[0]}! Lesedi loved playing with you.`},
      teacher_private_draft_analytics:{accuracy_score_percentage:result.score,professional_analysis_for_teacher:result.total?`${result.correct} of ${result.total} first choices matched the targets. ${result.limitations}`:result.limitations,
        proposed_teacher_classroom_intervention:assignment.subject==='Mathematics'?'Count a small set of classroom objects together. Ask the learner to show how they counted.':'Read a short page together. Ask the learner to point at each word.',
        draft_parent_update:`Your child practised ${ACTIVITIES[assignment.activityId].name} today. ${assignment.subject==='Mathematics'?'Count five familiar objects together at home.':'Share a short story together at home.'}`}};
  } else throw Error('Configure live Lesedi before using this environment');
  const clean=validateLesediResponse(response);
  // Model scores cannot overwrite objective evidence, and phonetic diagnoses are not stored.
  clean.teacher_private_draft_analytics.accuracy_score_percentage=result.score;
  if(result.score===null)clean.teacher_private_draft_analytics.professional_analysis_for_teacher=result.limitations;
  return {...clean,source:mode==='live'?'Lesedi API · teacher review required':'Development mock · no live AI'};
}
