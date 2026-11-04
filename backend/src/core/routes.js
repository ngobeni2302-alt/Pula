import express from 'express';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import { CoreRepository } from './repository.js';
import { hashPassword,verifyPassword,tokenHash,cookieToken,publicAccount } from './auth.js';
import { ACTIVITIES,publicActivity } from './catalog.js';
import { evaluateEvidence,evaluate } from './evaluator.js';
const uuid=()=>crypto.randomUUID(), now=()=>new Date().toISOString();
function fail(status,message) {throw Object.assign(Error(message),{status});}
function text(v,max=3000) {if(typeof v!=='string'||!v.trim()||v.length>max)fail(400,'Invalid text');return v.trim();}
const audit=(db,a,action,entityId)=>db.audits.push({id:uuid(),schoolId:a.schoolId,userId:a.id,action,entityId,at:now()});
const teacherLearner=(db,a,id)=>{
  if(a.role!=='teacher')fail(403,'Teacher access required');
  const l=db.learners.find(l=>l.id===id&&l.schoolId===a.schoolId);
  const c=db.classrooms.find(c=>c.id===l?.classroomId&&c.schoolId===a.schoolId&&c.teacherId===a.id);
  if(!l||!c)fail(403,'Learner is outside your authorized classroom');return {l,c};
};
export function createCoreRouter(repo=new CoreRepository()) {
  const router=express.Router(), limits=new Map();
  router.use((req,res,next)=>{
    res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');
    if(req.method!=='GET'&&req.headers.origin&&req.headers.origin!==`${req.protocol}://${req.get('host')}`)return res.status(403).json({error:'Use the same origin'});
    const key=`${req.ip}:${req.path.startsWith('/auth/')?'login':'core'}`, ts=Date.now();
    const entry=limits.get(key)||{count:0,until:ts+60000};if(ts>entry.until){entry.count=0;entry.until=ts+60000;}
    limits.set(key,entry);if(++entry.count>(req.path.startsWith('/auth/')?30:240))return res.status(429).json({error:'Please try again shortly'});
    if(limits.size>10000)for(const [k,v] of limits)if(ts>v.until)limits.delete(k);
    next();
  });
  const route=(method,url,fn,{anonymous=false}={})=>router[method](url,async(req,res)=>{
    try {
      const result=await repo.transaction(async db=>{
        let account;
        if(!anonymous){const hash=tokenHash(cookieToken(req));account=db.accounts.find(a=>a.sessions?.some(s=>s.hash===hash&&s.expires>Date.now()));if(!account)fail(401,'Sign in to the secure workflow');}
        return fn(req,db,account,res);
      });
      res.json(result);
    }catch(e){res.status(e.status||400).json({error:e.status?e.message:'The operation could not be completed. Check the request or service configuration.'});}
  });
  route('get','/catalog',(req)=>{const grade=req.query.grade;if(!['R','1','2','3'].includes(grade))fail(400,'Invalid grade');return Object.keys(ACTIVITIES).map(id=>publicActivity(id,grade));},{anonymous:true});
  route('post','/auth/login',async(req,db,_,res)=>{
    const email=text(req.body.email,254).toLowerCase(),password=text(req.body.password,128);
    const a=db.accounts.find(a=>a.email===email);
    if(!a||!await verifyPassword(password,a.passwordHash))fail(401,'Email or password is incorrect');
    const token=crypto.randomBytes(32).toString('hex');
    a.sessions=(a.sessions||[]).filter(s=>s.expires>Date.now()).slice(-4);
    a.sessions.push({hash:tokenHash(token),expires:Date.now()+8*60*60*1000});
    res.cookie('pula_session',token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:8*60*60*1000,path:'/api/core'});
    return publicAccount(a);
  },{anonymous:true});
  route('post','/auth/unlock',async(req,db,a)=>{
    if(!await verifyPassword(text(req.body.password,128),a.passwordHash))fail(401,'Password is incorrect');
    return {ok:true};
  });
  route('post','/auth/logout',(req,db,a,res)=>{a.sessions=a.sessions.filter(s=>s.hash!==tokenHash(cookieToken(req)));res.clearCookie('pula_session',{path:'/api/core'});return {ok:true};});
  route('get','/workspace',(req,db,a)=>{
    const classes=db.classrooms.filter(c=>c.schoolId===a.schoolId&&(a.role==='hod'||c.teacherId===a.id));
    const learners=db.learners.filter(l=>l.schoolId===a.schoolId&&(a.role==='parent'?(a.learnerIds||[]).includes(l.id):classes.some(c=>c.id===l.classroomId)));
    return {account:publicAccount(a),classes:classes.map(c=>({...c,learners:learners.filter(l=>l.classroomId===c.id)})),
      learners:a.role==='parent'?learners:[],catalog:Object.keys(ACTIVITIES).map(id=>({id,name:ACTIVITIES[id].name,subject:ACTIVITIES[id].subject})),
      provider:process.env.LESEDI_CORE_MODE==='live'?'Live adapter configured':'Development mock · no live AI',
      phonicsAudioConfigured:process.env.PHONICS_AUDIO_VERIFIED==='true'&&['v','a','n','s','u','c','t'].every(letter=>fs.existsSync(fileURLToPath(new URL(`../../../frontend/public/phonics/en-ZA/${letter}.mp3`,import.meta.url))))};
  });
  route('post','/assignments',(req,db,a)=>{
    const {l,c}=teacherLearner(db,a,req.body.learnerId), activityId=req.body.activityId;
    if(!ACTIVITIES[activityId])fail(400,'Choose a supported activity');
    if(!l.consent)fail(403,'Analysis consent is absent. Use unrecorded practice instead.');
    const key=text(req.body.requestId,64);
    const existing=db.assignments.find(s=>s.teacherId===a.id&&s.requestId===key);
    if(existing)return {id:existing.id,duplicate:true};
    const token=crypto.randomBytes(32).toString('hex');
    const s={id:uuid(),requestId:key,schoolId:a.schoolId,teacherId:a.id,learnerId:l.id,classroomId:c.id,grade:c.grade,subject:ACTIVITIES[activityId].subject,activityId,
      tokenHash:tokenHash(token),voiceConsent:l.voiceConsent===true,createdAt:now(),startedAt:Date.now(),expiresAt:Date.now()+2*60*60*1000,status:'ASSIGNED'};
    db.assignments.push(s);audit(db,a,'START_ACTIVITY',s.id);
    return {id:s.id,childToken:token,learner:{name:l.name},activity:publicActivity(activityId,c.grade),voiceConsent:s.voiceConsent};
  });
  // Capability token only permits completion of this teacher-launched assignment. No analytics reads.
  route('post','/assignments/:id/complete',async(req,db)=>{
    const s=db.assignments.find(s=>s.id===req.params.id);
    if(!s||typeof req.body.childToken!=='string'||s.tokenHash!==tokenHash(req.body.childToken))fail(403,'Activity access denied');
    const l=db.learners.find(l=>l.id===s.learnerId&&l.schoolId===s.schoolId), c=db.classrooms.find(c=>c.id===s.classroomId&&c.teacherId===s.teacherId&&c.schoolId===s.schoolId);
    if(!l?.consent||!c)fail(403,'Consent or classroom assignment changed');
    if(s.status==='COMPLETED')return {...s.childFeedback,duplicate:true};
    if(s.expiresAt<Date.now())fail(403,'Activity session expired');
    if(req.body.speech_transcript&&!l.voiceConsent)fail(403,'Voice consent is absent');
    const result=evaluateEvidence(s,req.body);
    // Network errors do not commit: retry uses the same assignment without a second draft.
    const output=await evaluate(s,l,req.body,result);
    const privateDraft=output.teacher_private_draft_analytics;
    db.drafts.push({id:s.id,schoolId:s.schoolId,teacherId:s.teacherId,learnerId:s.learnerId,classroomId:s.classroomId,activityId:s.activityId,activityName:ACTIVITIES[s.activityId].name,
      status:'DRAFT_PENDING_APPROVAL',createdAt:now(),score:result.score,evidence:result,analysis:privateDraft.professional_analysis_for_teacher,
      intervention:privateDraft.proposed_teacher_classroom_intervention,parentUpdate:privateDraft.draft_parent_update,limitations:result.limitations,source:output.source,version:1});
    s.childFeedback={kiro_state_control:output.kiro_state_control,lesedi_avatar_output:output.lesedi_avatar_output};s.status='COMPLETED';
    audit(db,{id:s.teacherId,schoolId:s.schoolId},'ACTIVITY_DRAFT_CREATED',s.id);
    return s.childFeedback;
  },{anonymous:true});
  route('get','/drafts',(req,db,a)=>{
    if(a.role!=='teacher')fail(403,'Teacher access required');
    return db.drafts.filter(d=>d.teacherId===a.id&&d.schoolId===a.schoolId&&db.classrooms.some(c=>c.id===d.classroomId&&c.teacherId===a.id)).map(d=>({...d,learnerName:db.learners.find(l=>l.id===d.learnerId)?.name}));
  });
  route('post','/drafts/:id/review',(req,db,a)=>{
    const d=db.drafts.find(d=>d.id===req.params.id&&d.schoolId===a.schoolId&&d.teacherId===a.id);
    if(!d)fail(403,'Draft access denied');teacherLearner(db,a,d.learnerId);
    const action=req.body.action;
    if(!['save','approve','approve-send','reject'].includes(action))fail(400,'Invalid review action');
    const key=text(req.body.requestId,64);
    if(d.lastRequestId===key)return {id:d.id,status:d.status,duplicate:true};
    if(d.status!=='DRAFT_PENDING_APPROVAL')fail(409,'This draft has already been reviewed');
    if(req.body.version!==d.version)fail(409,'The draft changed. Reload before reviewing.');
    const edited=req.body.edited||{};
    for(const k of ['analysis','intervention','parentUpdate'])if(k in edited)d[k]=text(edited[k]);
    if(action==='approve-send') {
      const parents=db.accounts.filter(p=>p.role==='parent'&&p.schoolId===a.schoolId&&p.learnerIds?.includes(d.learnerId));
      if(!parents.length)fail(409,'No verified parent relationship. Approve the assessment without sending.');
      db.notifications.push({id:uuid(),draftId:d.id,schoolId:a.schoolId,teacherId:a.id,learnerId:d.learnerId,parentIds:parents.map(p=>p.id),text:d.parentUpdate,
        // In-app publication is confirmed in this transaction. External sending is unconfigured.
        channel:'In-app',status:'Sent',createdAt:now()});
    }
    d.version++;d.lastRequestId=key;d.updatedAt=now();
    if(action!=='save'){d.status=action==='reject'?'REJECTED':'APPROVED';d.reviewedBy=a.id;d.reviewedAt=now();}
    audit(db,a,`DRAFT_${action.toUpperCase()}`,d.id);
    return {id:d.id,status:d.status,version:d.version};
  });
  route('get','/progress',(req,db,a)=>{
    if(a.role!=='parent')fail(403,'Parent access required');
    const ids=a.learnerIds||[];
    return {learners:db.learners.filter(l=>l.schoolId===a.schoolId&&ids.includes(l.id)).map(l=>({id:l.id,name:l.name,group:l.group})),
      updates:db.notifications.filter(n=>n.schoolId===a.schoolId&&n.parentIds.includes(a.id)&&ids.includes(n.learnerId)),
      assessments:db.drafts.filter(d=>d.schoolId===a.schoolId&&ids.includes(d.learnerId)&&d.status==='APPROVED').map(d=>({id:d.id,learnerId:d.learnerId,activityName:d.activityName,score:d.score,approvedAt:d.reviewedAt}))};
  });
  route('post','/learners/:id/tier',(req,db,a)=>{
    const {l}=teacherLearner(db,a,req.params.id),group=req.body.group,requestId=text(req.body.requestId,64);
    if(!['Seed','Sprout','Bloom','Tree'].includes(group))fail(400,'Choose a reading tier');
    const reason=text(req.body.reason,1000);
    if(db.audits.some(e=>e.userId===a.id&&e.requestId===requestId))return {ok:true,duplicate:true};
    const previous=l.group;l.group=group;l.tierChangedBy=a.id;l.tierChangeReason=reason;
    db.audits.push({id:uuid(),schoolId:a.schoolId,userId:a.id,action:'EXPLICIT_READING_TIER_CHANGE',entityId:l.id,previous,group,reason,requestId,at:now()});
    return {ok:true,group};
  });
  route('get','/suggestions',(req,db,a)=>{
    teacherLearner(db,a,req.query.learnerId);
    return db.drafts.filter(d=>d.learnerId===req.query.learnerId&&d.teacherId===a.id&&d.schoolId===a.schoolId&&d.status==='APPROVED').slice(-3).map(d=>({id:d.id,text:d.intervention}));
  });
  route('get','/hod',(req,db,a)=>{
    if(a.role!=='hod')fail(403,'HOD access required');
    const classes=db.classrooms.filter(c=>c.schoolId===a.schoolId), learners=db.learners.filter(l=>l.schoolId===a.schoolId);
    return {classes,learnerCount:learners.length,teachers:db.accounts.filter(u=>u.role==='teacher'&&u.schoolId===a.schoolId).map(publicAccount),
      approvedCount:db.drafts.filter(d=>d.schoolId===a.schoolId&&d.status==='APPROVED').length,
      pendingCount:db.drafts.filter(d=>d.schoolId===a.schoolId&&d.status==='DRAFT_PENDING_APPROVAL').length};
  });
  route('post','/hod/teachers',async(req,db,a)=>{
    if(a.role!=='hod')fail(403,'HOD access required');
    const email=text(req.body.email,254).toLowerCase(),name=text(req.body.name,100),password=text(req.body.password,128);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12)fail(400,'Use a valid email and a password of at least 12 characters');
    if(db.accounts.some(u=>u.email===email))fail(409,'An account with that email exists');
    const t={id:uuid(),schoolId:a.schoolId,name,email,role:'teacher',teacherCode:`TCH-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,passwordHash:await hashPassword(password),sessions:[]};
    db.accounts.push(t);audit(db,a,'REGISTER_TEACHER',t.id);return publicAccount(t);
  });
  return router;
}
