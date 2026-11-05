// Activity reviews live with the existing app profiles. No account/login layer.
import {loadData,STORAGE_KEY} from '../dashboardData.js';
import {ACTIVITIES,publicActivity} from '../../../shared/activityCatalog.js';
import {evaluateEvidence} from '../../../shared/activityEvidence.js';
import {getActivityDefinition,EVIDENCE_TYPES,OBSERVATION_LEVELS} from '../../../shared/activityDefinitions.js';
import {evaluateObservation} from '../../../LesediAiAgent/src/evaluationEngine.js';
import {getMessagingStore,openOrCreatePrivateConversation,sendMessage} from '../messaging/messagingService.js';
const KEY='pula_activity_reviews_v1';
let profile=null;
// Teacher-only transient speech evidence; never copied into persistent learner/parent data.
const speechMemory=new Map();
export const setWorkflowProfile=p=>{profile=p;};
function read(){try{return JSON.parse(localStorage.getItem(KEY))||{sessions:[],drafts:[]};}catch{return {sessions:[],drafts:[]};}}
function save(db){localStorage.setItem(KEY,JSON.stringify(db));window.dispatchEvent(new Event('pula_activity_update'));}
const classes=()=>loadData().classes;
const currentClass=()=>classes().find(c=>c.grade===profile?.grade);
const teacher=()=>{if(profile?.role!=='Teacher')throw Error('Open the teacher profile to review this activity.');return currentClass();};
export function getAppWorkspace(){if(!profile)return null;const c=currentClass();return {account:{id:profile.role==='Teacher'?`teacher-${profile.grade}`:`parent-${profile.childId}`,name:profile.role==='Teacher'?c?.teacher:profile.role,role:profile.role.toLowerCase()},classes:profile.role==='HOD'?classes():c?[{...c,id:c.grade,name:`Grade ${c.room}`,learners:c.learners.map(l=>({...l,legacyId:l.id}))}]:[],catalog:Object.entries(ACTIVITIES).map(([id,a])=>({id,name:a.name,subject:a.subject})),phonicsAudioConfigured:false};}
export async function appWorkflow(path,body){
  const db=read(),url=new URL(path,'http://pula.local'),parts=url.pathname.split('/').filter(Boolean);
  if(parts[0]==='catalog')return Object.keys(ACTIVITIES).map(id=>publicActivity(id,url.searchParams.get('grade')));
  if(path==='/workspace')return getAppWorkspace();
  if(path==='/drafts'){const c=teacher();return db.drafts.filter(d=>d.grade===c.grade).map(d=>({...d,speechEvidence:speechMemory.get(d.id)||null}));}
  if(parts[0]==='learners'&&parts[2]==='voice-consent'){
    const c=teacher(),data=loadData(),l=data.classes.find(cl=>cl.grade===c.grade).learners.find(l=>l.id===parts[1]);
    if(!l||body.confirmed!==true)throw Error('The teacher must confirm guardian permission before microphone use.');
    if(!l.consent&&body.analysisConfirmed!==true)throw Error('Guardian permission for this activity is not recorded.');
    if(body.analysisConfirmed===true)l.consent=true;
    l.voiceConsent=true;l.voiceConsentRecordedAt=new Date().toISOString();l.voiceConsentRecordedBy=c.teacher;
    for(const s of db.sessions)if(s.learnerId===l.id&&s.grade===c.grade)s.voiceConsent=true;
    localStorage.setItem(STORAGE_KEY,JSON.stringify(data));save(db);window.dispatchEvent(new Event('pula_dashboard_update'));
    return {voiceConsent:true};
  }
  if(path==='/assignments'){
    const c=teacher(),l=c.learners.find(l=>l.id===body.learnerId);if(!l||!l.consent)throw Error('Choose a learner with assessment consent.');
    const existing=db.sessions.find(s=>s.requestId===body.requestId);if(existing)return existing;
    const s={id:crypto.randomUUID(),requestId:body.requestId,learnerId:l.id,grade:c.grade,activityId:body.activityId,subject:ACTIVITIES[body.activityId].subject,learner:{name:l.name},activity:publicActivity(body.activityId,c.grade),voiceConsent:l.voiceConsent===true,createdAt:new Date().toISOString()};db.sessions.push(s);save(db);return s;
  }
  if(parts[0]==='assignments'&&parts[2]==='complete'){
    const c=teacher(),s=db.sessions.find(s=>s.id===parts[1]&&s.grade===c.grade);if(!s)throw Error('Activity session not found.');
    const l=c.learners.find(l=>l.id===s.learnerId);if(!l?.consent)throw Error('Assessment consent is no longer recorded.');
    const feedback={kiro_state_control:{action_evaluation:'PARTICIPATION',next_ui_state:'TRANSITION_TO_WELL_DONE'},lesedi_avatar_output:{animation_trigger:'LESEDI_HAPPY_CELEBRATE',speech_text:`You did it, ${l.name}!`}};
    if(db.drafts.some(d=>d.id===s.id))return feedback;
    if((body.speech_transcript||body.recording_captured)&&!l.voiceConsent)throw Error('Guardian voice permission is not recorded.');
    const result=evaluateEvidence(s,body);
    // Phase 3: Evaluate the observation level for this session
    const observation=evaluateObservation({
      activityId:s.activityId,score:result.score,total:result.total,correct:result.correct,
      transcriptAvailable:result.transcriptAvailable,recordingCaptured:result.recordingCaptured,
      sessionSummary:null,
    });
    speechMemory.set(s.id,{grade:c.grade,transcript:body.speech_transcript.trim(),durationSeconds:result.speechDurationSeconds,recordingCaptured:result.recordingCaptured});
    if(speechMemory.size>50)speechMemory.delete(speechMemory.keys().next().value);
    // Use the evaluation reason as the draft analysis (more meaningful than hardcoded text)
    const analysisText=observation.level===OBSERVATION_LEVELS.INSUFFICIENT_EVIDENCE
      ?(result.transcriptAvailable?'Speech captured with a browser transcript. Review what was heard before adding an assessment; recognition may be inaccurate.':'Reading participation recorded. Listen to the learner before adding your assessment.')
      :observation.reason;
    db.drafts.push({id:s.id,grade:c.grade,learnerId:l.id,learnerName:l.name,activityName:s.activity.name,activityId:s.activityId,subject:s.subject,status:'DRAFT_PENDING_APPROVAL',version:1,score:result.score,createdAt:new Date().toISOString(),limitations:result.limitations,evidence:result,
      observationLevel:observation.level,
      observationConfidence:observation.confidence,
      evidenceClassification:result.evidenceClassification,
      analysis:analysisText,
      intervention:s.subject==='Mathematics'?'Count familiar objects together, touching each object once.':'Read one short page together. Ask the learner to point to each word.',
      parentUpdate:`${l.name} practised ${s.activity.name} today. ${s.subject==='Mathematics'?'Count five familiar objects together at home.':'Share a short story together tonight.'}`,
      source:'Activity evidence · teacher review'});save(db);return feedback;
  }
  if(parts[0]==='drafts'&&parts[2]==='review'){
    const c=teacher(),d=db.drafts.find(d=>d.id===parts[1]&&d.grade===c.grade);if(!d)throw Error('Draft not found.');
    if(d.status!=='DRAFT_PENDING_APPROVAL')return {status:d.status};
    if(d.version!==body.version)throw Error('This draft has changed. Reopen it before saving.');
    for(const k of ['analysis','intervention','parentUpdate'])if(k in (body.edited||{})){if(!body.edited[k].trim())throw Error('Complete all review fields.');d[k]=body.edited[k].trim();}
    if(body.action==='approve-send'){
      const l=c.learners.find(l=>l.id===d.learnerId),conversation=openOrCreatePrivateConversation({teacherId:`teacher-${c.grade}`,teacherName:c.teacher,learner:l,grade:c.grade,classroomName:`Grade ${c.room}`});
      // Retry check is linked to the draft, not the number of button clicks.
      const old=getMessagingStore().messages.find(m=>m.category===`assessment:${d.id}`);
      if(!old)sendMessage({conversationId:conversation.id,senderId:`teacher-${c.grade}`,senderName:c.teacher,senderRole:'teacher',text:d.parentUpdate,category:`assessment:${d.id}`});
    }
    if(body.action!=='save'){d.status=body.action==='reject'?'REJECTED':'APPROVED';d.reviewedAt=new Date().toISOString();d.reviewedBy=c.teacher;}
    d.version++;save(db);
    if(d.status==='APPROVED'){
      const data=loadData(),cl=data.classes.find(cl=>cl.grade===c.grade),l=cl.learners.find(l=>l.id===d.learnerId);
      l.activityAssessments=[...(l.activityAssessments||[]).filter(a=>a.id!==d.id),{...d,status:'Approved',percentage:d.score,finding:d.analysis,whatToDo:d.intervention,approvedBy:c.teacher,approvedAt:d.reviewedAt}];
      localStorage.setItem(STORAGE_KEY,JSON.stringify(data));window.dispatchEvent(new Event('pula_dashboard_update'));
    }
    return {status:d.status};
  }
  if(parts[0]==='learners'&&parts[2]==='tier'){
    const c=teacher(),data=loadData(),l=data.classes.find(cl=>cl.grade===c.grade).learners.find(l=>l.id===parts[1]);
    if(!l||!['Seed','Sprout','Bloom','Tree'].includes(body.group)||!body.reason?.trim())throw Error('Choose a tier and record your reason.');
    l.tierHistory=[...(l.tierHistory||[]),{previousTier:l.group,newTier:body.group,reason:body.reason,changedBy:c.teacher,changedAt:new Date().toISOString()}];l.group=body.group;localStorage.setItem(STORAGE_KEY,JSON.stringify(data));window.dispatchEvent(new Event('pula_dashboard_update'));return {ok:true};
  }
  if(parts[0]==='suggestions'){const c=teacher();return db.drafts.filter(d=>d.grade===c.grade&&d.learnerId===url.searchParams.get('learnerId')&&d.status==='APPROVED').slice(-3).map(d=>({id:d.id,text:d.intervention}));}
  // ── Lesedi AI enrichment ───────────────────────────────────────────────
  // POST /drafts/:id/lesedi — ask the real Lesedi AI for gap analysis and
  // update the draft's analysis/intervention/parentUpdate fields.
  // Falls back silently if the backend is unreachable (e.g. in tests).
  if(parts[0]==='drafts'&&parts[2]==='lesedi'){
    const c=teacher(),d=db.drafts.find(d=>d.id===parts[1]&&d.grade===c.grade);
    if(!d)throw Error('Draft not found.');
    if(d.status!=='DRAFT_PENDING_APPROVAL')return {status:d.status,lesediEnriched:false};
    const learnerName=d.learnerName||'the learner';
    const subject=d.subject==='Mathematics'?'Mathematics':'English';
    const obs=d.evidence?.total?[{item:d.activityName,correct:d.evidence.correct,of:d.evidence.total}]:[{item:d.activityName,result:'participation'}];
    const apiBase=typeof import.meta!=='undefined'&&import.meta.env?.VITE_API_BASE?import.meta.env.VITE_API_BASE:(typeof window!=='undefined'&&window.location?.port==='5173'?'http://localhost:4000':'');
    try{
      const res=await fetch(`${apiBase}/api/lesedi`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:'gap_explanation',subject,grade:String(c.grade),term:4,learner:{firstName:learnerName,group:'Sprout',consent:true,observations:obs,checkInNote:null},weeks:1,requestText:`Activity evidence: ${d.activityName} — ${d.evidence?.total?d.evidence.correct+'/'+d.evidence.total:'participation'}`})});
      if(!res.ok)throw Error(`HTTP ${res.status}`);
      const data=await res.json();
      if(!data.ok||!data.text)throw Error('Empty response');
      const text=data.text||'';
      const lines=text.split('\n');
      const findSection=(label)=>{const i=lines.findIndex(l=>new RegExp(label,'i').test(l));return i>=0?lines.slice(i+1).find(l=>l.trim())?.trim()||'':''};
      d.analysis=findSection('what the data shows')||findSection('finding')||text.slice(0,300);
      d.intervention=findSection('do this')||findSection('what to do')||d.intervention;
      d.parentUpdate=findSection('parent')||d.parentUpdate;
      d.lesediEnriched=true;
      d.lesediSource=data.source||'ai_model';
      d.lesediConfidence=data.confidence||'Low';
      save(db);
      return {ok:true,lesediEnriched:true,draft:d};
    }catch(e){
      return {ok:false,lesediEnriched:false,error:e.message,draft:d};
    }
  }
  // ── Real-time scaffolding ─────────────────────────────────────────────
  // POST /scaffold — get a Lesedi hint during gameplay.
  // Calls the real backend; falls back to a simple encouragement if unreachable.
  if(path==='/scaffold'){
    const {sessionId,roundIndex,activityId,observedEvent,firstName,subject,learnerId,curriculumSkillId}=body;
    const apiBase=typeof import.meta!=='undefined'&&import.meta.env?.VITE_API_BASE?import.meta.env.VITE_API_BASE:(typeof window!=='undefined'&&window.location?.port==='5173'?'http://localhost:4000':'');
    try{
      const res=await fetch(`${apiBase}/api/lesedi/scaffold`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,roundIndex:roundIndex??0,activityId,observedEvent,firstName,subject,learnerId,curriculumSkillId})});
      if(!res.ok)throw Error(`HTTP ${res.status}`);
      const data=await res.json();
      if(!data.ok)throw Error('Empty response');
      return {ok:true,text:data.text,hintLevel:data.hintLevel,handoff:data.handoff,praise:data.praise};
    }catch{
      return {ok:true,text:`Good try, ${firstName||'there'}. Let's keep going!`,hintLevel:1,handoff:false,praise:false};
    }
  }
  // ── Session evaluation ────────────────────────────────────────────────
  // POST /evaluate — get the observation level for a completed session.
  if(path==='/evaluate'){
    const {activityId,score,total,correct,sessionId,transcriptAvailable,recordingCaptured}=body;
    const apiBase=typeof import.meta!=='undefined'&&import.meta.env?.VITE_API_BASE?import.meta.env.VITE_API_BASE:(typeof window!=='undefined'&&window.location?.port==='5173'?'http://localhost:4000':'');
    try{
      const res=await fetch(`${apiBase}/api/lesedi/evaluate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({activityId,score:score??null,total:total??0,correct:correct??0,sessionId,transcriptAvailable:transcriptAvailable??false,recordingCaptured:recordingCaptured??false})});
      if(!res.ok)throw Error(`HTTP ${res.status}`);
      const data=await res.json();
      if(!data.ok)throw Error('Empty response');
      return {ok:true,level:data.level,reason:data.reason,evidence:data.evidence,confidence:data.confidence};
    }catch{
      return {ok:false,error:'Evaluation unavailable',level:'INSUFFICIENT_EVIDENCE',reason:'Backend unreachable.',evidence:{},confidence:'insufficient'};
    }
  }
  // ── Learner analytics ────────────────────────────────────────────────
  // POST /analytics — aggregate evidence across sessions for a learner.
  if(path==='/analytics'){
    const {learnerId,learnerName,subject,grade,sessions}=body;
    const apiBase=typeof import.meta!=='undefined'&&import.meta.env?.VITE_API_BASE?import.meta.env.VITE_API_BASE:(typeof window!=='undefined'&&window.location?.port==='5173'?'http://localhost:4000':'');
    try{
      const res=await fetch(`${apiBase}/api/lesedi/analytics`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({learnerId,learnerName,subject,grade,sessions})});
      if(!res.ok)throw Error(`HTTP ${res.status}`);
      const data=await res.json();
      if(!data.ok)throw Error('Empty response');
      return data;
    }catch{
      // Fallback: minimal local aggregation
      const scored=sessions.filter(s=>s.score!=null);
      const avg=scored.length?Math.round(scored.reduce((a,s)=>a+s.score,0)/scored.length):null;
      return {ok:true,learnerId,learnerName,subject,grade,totalSessions:sessions.length,averageScore:avg,overallTrend:'unknown',skills:[],skillGaps:[],strengths:[],summary:`${sessions.length} session(s) recorded. Backend analytics unavailable.`,confidence:'low'};
    }
  }
  // ── Class analytics ───────────────────────────────────────────────────
  // POST /class-analytics — aggregate evidence across learners in a class.
  if(path==='/class-analytics'){
    const {grade:grd,subject:sub,classroomName,learners}=body;
    const apiBase=typeof import.meta!=='undefined'&&import.meta.env?.VITE_API_BASE?import.meta.env.VITE_API_BASE:(typeof window!=='undefined'&&window.location?.port==='5173'?'http://localhost:4000':'');
    try{
      const res=await fetch(`${apiBase}/api/lesedi/class-analytics`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grade:grd,subject:sub,classroomName,learners})});
      if(!res.ok)throw Error(`HTTP ${res.status}`);
      const data=await res.json();
      if(!data.ok)throw Error('Empty response');
      return data;
    }catch{
      return {ok:false,error:'Class analytics unavailable',classroomName,grade:grd,subject:sub,totalLearners:learners?.length||0,summary:'Backend class analytics unavailable.',confidence:'insufficient'};
    }
  }
  if(path==='/progress'){
    if(profile?.role!=='Parent')return {learners:[],updates:[],assessments:[]};
    const c=currentClass(),l=c.learners.find(l=>l.id===profile.childId);
    return {learners:l?[l]:[],updates:[],assessments:db.drafts.filter(d=>d.learnerId===l?.id&&d.status==='APPROVED').map(d=>({id:d.id,learnerId:d.learnerId,activityName:d.activityName,score:d.score,approvedAt:d.reviewedAt}))};
  }
  throw Error('This action is unavailable.');
}
