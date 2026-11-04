import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import crypto from 'node:crypto';
import {getPool} from '../src/store/pool.js';
import {CoreRepository,emptyState} from '../src/core/repository.js';
import {createCoreRouter} from '../src/core/routes.js';
import {hashPassword} from '../src/core/auth.js';
import {ACTIVITIES,serverRounds} from '../src/core/catalog.js';
import {validateLesediResponse} from '../src/core/evaluator.js';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pula-core-test-')),file=path.join(tmp,'core.json');
const postgres=process.env.CORE_TEST_POSTGRES==='true';
const repo=new CoreRepository({file,postgres});
const snapshot=()=>repo.transaction(db=>structuredClone(db));
let server,base,teacher,parent,other,hod,outsider;
const ids=Object.fromEntries(['school','otherSchool','teacher','parent','other','hod','outsider','class','otherClass','learner','noConsent'].map(k=>[k,crypto.randomUUID()]));
async function request(url,body,cookie='') {const res=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
async function login(email) {email=email.replace('@test.local',`-${ids[email.split('@')[0]]}@test.local`);const r=await request('/auth/login',{email,password:'Testing-Pula-2026!'});assert.equal(r.status,200);return r.cookie;}
async function assign(id='reading-time',learnerId=ids.learner){const r=await request('/assignments',{learnerId,activityId:id,requestId:crypto.randomUUID()},teacher);assert.equal(r.status,200);return r.body;}
function evidence(s,wrong=false) {return {childToken:s.childToken,rounds:serverRounds(s.activity.id,'2').map(r=>({choices:r.answer?[wrong?r.options.find(x=>x!==r.answer):r.answer]:[],letters:s.activity.id==='sound-it-out'?[...r.target].map((_,i)=>i):[]})),speech_transcript:'',time_taken_seconds:14.5};}
async function completed(id='reading-time'){const s=await assign(id),r=await request(`/assignments/${s.id}/complete`,evidence(s));assert.equal(r.status,200);return s;}
async function draft(id){const r=await request('/drafts',undefined,teacher);return r.body.find(d=>d.id===id);}
before(async()=>{
  process.env.LESEDI_CORE_MODE='mock';
  const db=emptyState(),passwordHash=await hashPassword('Testing-Pula-2026!');
  db.schools=[{id:ids.school},{id:ids.otherSchool}];
  db.accounts=[['teacher','teacher',ids.school],['parent','parent',ids.school],['other','teacher',ids.school],['hod','hod',ids.school],['outsider','hod',ids.otherSchool]].map(([key,role,schoolId])=>({id:ids[key],schoolId,name:key,role,email:`${key}-${ids[key]}@test.local`,passwordHash,learnerIds:key==='parent'?[ids.learner]:[],sessions:[]}));
  db.classrooms=[{id:ids.class,schoolId:ids.school,teacherId:ids.teacher,grade:'2',name:'2B'}];
  db.learners=[{id:ids.learner,schoolId:ids.school,classroomId:ids.class,name:'Thando',group:'Sprout',consent:true,voiceConsent:false},{id:ids.noConsent,schoolId:ids.school,classroomId:ids.class,name:'Palesa',group:'Seed',consent:false,voiceConsent:false}];
  if(postgres) {
    const pool=getPool();
    for(const school of db.schools)await pool.query('INSERT INTO schools(id,name) VALUES($1,$2)',[school.id,'Integration test school']);
    for(const a of db.accounts)await pool.query('INSERT INTO users(id,school_id,name,role) VALUES($1,$2,$3,$4)',[a.id,a.schoolId,a.name,a.role]);
    for(const c of db.classrooms)await pool.query('INSERT INTO classrooms(id,school_id,teacher_id,name,grade) VALUES($1,$2,$3,$4,$5)',[c.id,c.schoolId,c.teacherId,c.name,c.grade]);
    for(const l of db.learners) {
      await pool.query('INSERT INTO learners(id,classroom_id,first_name,literacy_tier) VALUES($1,$2,$3,$4)',[l.id,l.classroomId,l.name,l.group]);
      if(l.consent)await pool.query("INSERT INTO guardian_consents(learner_id,scope,granted_by,granted_at) VALUES($1,'analysis','Test guardian',now())",[l.id]);
    }
    await repo.transaction(state=>{state.accounts.push(...db.accounts);});
  }else fs.writeFileSync(file,JSON.stringify(db));
  const app=express();app.use(express.json());app.use('/api/core',createCoreRouter(repo));
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}/api/core`;
  teacher=await login('teacher@test.local');parent=await login('parent@test.local');other=await login('other@test.local');hod=await login('hod@test.local');outsider=await login('outsider@test.local');
});
after(async()=>{if(server)await new Promise(r=>server.close(r));if(postgres)await getPool().end();fs.rmSync(tmp,{recursive:true,force:true});});
test('A: reading completion yields only child fields and pending teacher draft',async()=>{
  const s=await assign();const r=await request(`/assignments/${s.id}/complete`,evidence(s));
  assert.equal(r.status,200);assert.deepEqual(Object.keys(r.body).sort(),['kiro_state_control','lesedi_avatar_output']);
  const d=await draft(s.id);assert.equal(d.status,'DRAFT_PENDING_APPROVAL');assert.equal(d.score,null);assert.match(d.limitations,/No validated/);
  const p=await request('/progress',undefined,parent);assert.equal(p.body.updates.length,0);assert.equal(p.body.assessments.length,0);
});
test('all five activities validate real evidence and complete',async()=>{for(const id of Object.keys(ACTIVITIES)){const s=await completed(id);const d=await draft(s.id);assert.equal(d.score,['reading-time','sound-it-out'].includes(id)?null:100);}});
test('objective scores reflect actual first choices, including retries',async()=>{const s=await assign('number-hunt'),e=evidence(s,true);e.rounds.forEach((r,i)=>r.choices.push(serverRounds('number-hunt','2')[i].answer));await request(`/assignments/${s.id}/complete`,e);assert.equal((await draft(s.id)).score,0);});
test('B: editing and Approve and Send publishes only approved parent content once',async()=>{
  const s=await completed('count-and-pick'),d=await draft(s.id);const body={action:'approve-send',requestId:crypto.randomUUID(),version:d.version,edited:{parentUpdate:'Please count five mielies together.'}};
  const results=await Promise.all([request(`/drafts/${s.id}/review`,body,teacher),request(`/drafts/${s.id}/review`,body,teacher)]);
  assert.ok(results.every(r=>r.status===200));const p=await request('/progress',undefined,parent);
  assert.equal(p.body.updates.filter(n=>n.draftId===s.id).length,1);assert.equal(p.body.updates.find(n=>n.draftId===s.id).text,body.edited.parentUpdate);
  assert.ok(!JSON.stringify(p.body).includes('professional_analysis'));assert.equal(p.body.learners[0].group,'Sprout');
});
test('approval without send publishes no notification',async()=>{const s=await completed(),d=await draft(s.id);await request(`/drafts/${s.id}/review`,{action:'approve',requestId:crypto.randomUUID(),version:d.version},teacher);const p=await request('/progress',undefined,parent);assert.ok(!p.body.updates.some(n=>n.draftId===s.id));});
test('C: rejected drafts retained for authorized review without notification',async()=>{const s=await completed(),d=await draft(s.id);await request(`/drafts/${s.id}/review`,{action:'reject',requestId:crypto.randomUUID(),version:d.version},teacher);assert.equal((await draft(s.id)).status,'REJECTED');const p=await request('/progress',undefined,parent);assert.ok(!p.body.assessments.some(n=>n.id===s.id));assert.ok(!p.body.updates.some(n=>n.draftId===s.id));});
test('F: missing authentication, parent drafts, other teacher and other school denied',async()=>{assert.equal((await request('/drafts')).status,401);assert.equal((await request('/drafts',undefined,parent)).status,403);const s=await completed();for(const cookie of [parent,other,outsider])assert.equal((await request(`/drafts/${s.id}/review`,{action:'approve',requestId:crypto.randomUUID(),version:1},cookie)).status,403);const h=await request('/hod',undefined,outsider);assert.equal(h.body.learnerCount,0);assert.equal(h.body.teachers.length,0);});
test('learner and classroom IDs cannot be forged and consent cannot be supplied by client',async()=>{for(const learnerId of [ids.learner,crypto.randomUUID()])assert.equal((await request('/assignments',{learnerId,activityId:'reading-time',requestId:crypto.randomUUID(),consent:true},other)).status,403);assert.equal((await request('/assignments',{learnerId:ids.noConsent,activityId:'reading-time',requestId:crypto.randomUUID()},teacher)).status,403);});
test('duplicate completion creates one draft and one activity audit',async()=>{const s=await assign();const e=evidence(s);await Promise.all([request(`/assignments/${s.id}/complete`,e),request(`/assignments/${s.id}/complete`,e)]);const db=await snapshot();assert.equal(db.drafts.filter(d=>d.id===s.id).length,1);assert.equal(db.audits.filter(a=>a.entityId===s.id&&a.action==='ACTIVITY_DRAFT_CREATED').length,1);});
test('unauthorized child token and unconsented speech are rejected; no audio persisted',async()=>{const s=await assign(),e=evidence(s);assert.equal((await request(`/assignments/${s.id}/complete`,{...e,childToken:'fake'})).status,403);assert.equal((await request(`/assignments/${s.id}/complete`,{...e,speech_transcript:'private recording'})).status,403);const contents=JSON.stringify(await snapshot());assert.ok(!contents.includes('private recording'));assert.ok(!contents.includes('rawAudio'));});
test('stale edits and conflicting retries cannot overwrite reviewed records',async()=>{const s=await completed(),d=await draft(s.id);const r=await request(`/drafts/${s.id}/review`,{action:'save',requestId:crypto.randomUUID(),version:d.version,edited:{analysis:'Teacher edited draft'}},teacher);assert.equal(r.status,200);assert.equal((await request(`/drafts/${s.id}/review`,{action:'approve',requestId:crypto.randomUUID(),version:d.version},teacher)).status,409);});
test('provider schema rejects malformed and out-of-range responses',()=>{assert.throws(()=>validateLesediResponse({}));assert.throws(()=>validateLesediResponse({kiro_state_control:{action_evaluation:'DIAGNOSED'}}));});
test('HOD registration generates unique teacher IDs and hashes passwords',async()=>{const r=await request('/hod/teachers',{name:'New teacher',email:`new-${ids.hod}@test.local`,password:'Long-password-2026'},hod);assert.equal(r.status,200);assert.match(r.body.teacherCode,/^TCH-/);assert.ok(!JSON.stringify(r.body).includes('password'));assert.equal((await request('/hod/teachers',{name:'X',email:'x@test.local',password:'Long-password-2026'},teacher)).status,403);});
test('logout invalidates server-side session',async()=>{const cookie=await login('other@test.local');assert.equal((await request('/auth/logout',{},cookie)).status,200);assert.equal((await request('/workspace',undefined,cookie)).status,401);});
test('tier changes require a separate explicit authorized action and remain auditable',async()=>{const r=await request(`/learners/${ids.learner}/tier`,{group:'Bloom',reason:'Teacher listened independently and reviewed classwork',requestId:crypto.randomUUID()},teacher);assert.equal(r.status,200);const db=await snapshot();assert.equal(db.learners.find(l=>l.id===ids.learner).group,'Bloom');assert.ok(db.audits.some(e=>e.action==='EXPLICIT_READING_TIER_CHANGE'));assert.equal((await request(`/learners/${ids.learner}/tier`,{group:'Tree',reason:'Forged',requestId:crypto.randomUUID()},parent)).status,403);});
test('provider failure leaves no completed assignment or partial draft',async()=>{const s=await assign();process.env.LESEDI_CORE_MODE='unconfigured';try{assert.equal((await request(`/assignments/${s.id}/complete`,evidence(s))).status,400);const db=await snapshot();assert.ok(!db.drafts.some(d=>d.id===s.id));assert.equal(db.assignments.find(a=>a.id===s.id).status,'ASSIGNED');}finally{process.env.LESEDI_CORE_MODE='mock';}});
test('retention expires final detail text but preserves pending work, score and approval audit',async()=>{const {applyRetention}=await import('../src/core/retention.js');const db={drafts:[{status:'APPROVED',reviewedAt:'2020-01-01',analysis:'Private',intervention:'Tip',parentUpdate:'Text',score:80,evidence:{rounds:[1]}},{status:'DRAFT_PENDING_APPROVAL',analysis:'Keep pending'}],notifications:[{createdAt:'2020-01-01',text:'Old message'}],accounts:[]};assert.deepEqual(applyRetention(db,90),{drafts:1,notifications:1});assert.equal(db.drafts[0].score,80);assert.ok(!db.drafts[0].evidence.rounds);assert.equal(db.drafts[1].analysis,'Keep pending');assert.throws(()=>applyRetention(db,0));});
