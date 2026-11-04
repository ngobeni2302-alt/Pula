import express from 'express';
import cors from 'cors';
import { mountLesedi } from '../../LesediAiAgent/src/index.js';
import { handlePostActivitySession } from './routes/activitySessions.js';
import { handleApproveOutput, handleListOutputs } from './routes/lesediOutputs.js';
import { checkConnection } from './store/pool.js';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const _rawDataFile=process.env.DATA_FILE||path.join(here,'../data.json');
const _resolved=path.resolve(_rawDataFile);
if(!_resolved.startsWith(path.resolve(here,'..')))throw new Error('DATA_FILE path is outside the project directory');
const dbPath=_resolved;
const initial={classroom:{name:'Grade 2B',teacher:'Teacher',code:'READ2B',grade:2},learners:[['1','Thando','Sprout',true,'isiZulu','WhatsApp'],['2','Lerato','Bloom',true,'Sepedi','SMS'],['3','Sipho','Seed',true,'English','WhatsApp'],['4','Aisha','Sprout',true,'English','SMS'],['5','Kabelo','Tree',true,'English','SMS'],['6','Naledi','Sprout',true,'English','WhatsApp'],['7','Zanele','Seed',true,'isiZulu','SMS'],['8','Ruan','Seed',true,'English','SMS'],['9','Palesa','Seed',false,'English','WhatsApp'],['10','Neo','Bloom',true,'English','SMS'],['11','Amahle','Bloom',true,'isiZulu','WhatsApp'],['12','Tumi','Tree',true,'English','WhatsApp']].map(([id,name,group,consent,language,channel])=>({id,name,group,consent,language,channel,parentContact:''})),assessments:[],notes:[],activities:[]};
function load(){try{return JSON.parse(fs.readFileSync(dbPath,'utf8'))}catch{return structuredClone(initial)}}
let db=load();function save(){fs.writeFileSync(dbPath,JSON.stringify(db,null,2))}
const ALLOWED_ORIGINS=['https://pula-delta.vercel.app'];
const app=express();
if (process.env.TRUST_PROXY_HOPS) {
  const hops=Number(process.env.TRUST_PROXY_HOPS);
  if (!Number.isInteger(hops)||hops<1||hops>2) throw Error('TRUST_PROXY_HOPS must be 1 or 2');
  app.set('trust proxy',hops);
}
// TODO (production): add CSRF tokens once session-based auth is introduced
app.use(cors({origin:(origin,cb)=>cb(null,!origin||origin.startsWith('http://localhost')||ALLOWED_ORIGINS.includes(origin))}));
app.use(express.json({limit:'2mb'}));
const wrap=f=>(req,res)=>{try{f(req,res)}catch(e){res.status(400).json({error:e.message})}};
const must=(cond,msg)=>{if(!cond)throw Error(msg)};
app.get('/api/health', async (req, res) => {
  const useJson = (process.env.USE_JSON_STORE ?? 'true').toLowerCase() === 'true';
  const mode    = useJson ? 'json' : 'postgres';
  let   db      = 'n/a';
  if (!useJson) {
    db = (await checkConnection()) ? 'connected' : 'unreachable';
  }
  res.json({ ok: true, mode, db });
});
// Keep the original app API available; profile selection has no login dependency.
app.use('/api', (req,res,next) => { res.set('Cache-Control','no-store'); next(); });
// ── Activity sessions (Phase 1) ──────────────────────────────────────────
// POST /api/activity-sessions — idempotent on client id, consent-gated
app.post('/api/activity-sessions', handlePostActivitySession);

// ── Lesedi output approval (Phase 1) ─────────────────────────────────────
// PATCH /api/lesedi/outputs/:id/approve — teacher approves or rejects a draft
// GET  /api/lesedi/outputs              — list outputs for a classroom
app.patch('/api/lesedi/outputs/:id/approve', handleApproveOutput);
app.get('/api/lesedi/outputs', handleListOutputs);

app.get('/api/state',(req,res)=>res.json(db));
app.patch('/api/classroom',wrap((req,res)=>{db.classroom={...db.classroom,...req.body};save();res.json(db.classroom)}));
app.post('/api/learners',wrap((req,res)=>{must(req.body.name?.trim(),'Learner name is required');let learner={id:crypto.randomUUID(),name:req.body.name.trim(),group:'Seed',consent:false,language:'English',channel:'SMS',parentContact:''};db.learners.push(learner);save();res.status(201).json(learner)}));
app.patch('/api/learners/:id',wrap((req,res)=>{const l=db.learners.find(x=>x.id===req.params.id);must(l,'Learner not found');const allowed=['name','group','literacyGroup','mathsGroup','consent','language','channel','parentContact','recentlyMoved','groupJourney','soundsToPractise','mathsSkillsToWork','termProgress','mathsTermProgress','checkInNote','weeksInTier','mathsWeeksInTier','dbeCode'];for(const k of allowed)if(k in req.body)l[k]=req.body[k];save();res.json(l)}));
app.delete('/api/learners/:id',wrap((req,res)=>{db.learners=db.learners.filter(x=>x.id!==req.params.id);save();res.json({ok:true})}));
function words(s){return (s.toLowerCase().match(/[\p{L}']+/gu)||[])}
function score(expected,spoken,durationSeconds){const a=words(expected),b=words(spoken);let dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);let correct=dp[a.length][b.length];return{correct,total:a.length,accuracy:a.length?Math.round(100*correct/a.length):0,wpm:durationSeconds>0?Math.round(b.length*60/durationSeconds):0}}
app.post('/api/assessments',wrap((req,res)=>{const {learnerId,passage,transcript,durationSeconds}=req.body;const l=db.learners.find(x=>x.id===learnerId);must(l,'Learner not found');must(l.consent,'Parent consent is required before assessment');must(passage?.trim()&&transcript?.trim(),'Passage and transcript required');must(Number(durationSeconds)>0,'Duration must be positive');const result=score(passage,transcript,Number(durationSeconds));const suggested=result.accuracy<60?'Seed':result.accuracy<78?'Sprout':result.accuracy<92?'Bloom':'Tree';const assessment={id:crypto.randomUUID(),learnerId,passage,transcript,durationSeconds:Number(durationSeconds),...result,suggestedGroup:suggested,createdAt:new Date().toISOString(),source:'browser-transcript',reviewed:false};db.assessments.unshift(assessment);save();res.status(201).json(assessment)}));
app.post('/api/assessments/:id/approve',wrap((req,res)=>{const a=db.assessments.find(x=>x.id===req.params.id);must(a,'Assessment not found');const l=db.learners.find(x=>x.id===a.learnerId);must(l,'Learner not found');a.reviewed=true;if(req.body.applyGroup){l.group=req.body.group||a.suggestedGroup;l.recentlyMoved=true}save();res.json(a)}));
const activityLibrary={
  literacy:{
    Seed:{title:'Sound & letter hunt',focus:'matching letters to sounds',steps:['Say three simple letter sounds together.','Find classroom objects starting with those sounds.','Blend short words and read them aloud.'],observe:'Who matches letters to sounds independently?',homeGame:'Tap letters on a cereal box. Ask your child to say the sound each letter makes.'},
    Sprout:{title:'Sound hunt',focus:'blending and word families',steps:['Say a word with the new sound. Children clap when they hear it.','Find three things that start with the sound.','Read a short passage together, then in pairs.'],observe:'Who can blend independently? Who still needs the model?',homeGame:"Say a word in sounds (b-u-s). Ask your child to say the whole word fast."},
    Bloom:{title:'Story builders',focus:'reading fluency and retelling',steps:['Read a short paragraph aloud.','Identify the main idea and three details.','Retell the story with a partner.'],observe:'Does the child pause at full stops? Decode unfamiliar words?',homeGame:"Read one page of any book. Ask: 'What happened? Who was there?'"},
    Tree:{title:'Reading detectives',focus:'deep comprehension',steps:['Read a new passage independently.','Find evidence for two comprehension questions.','Explain the meaning of three new words.'],observe:'Can the child infer meaning and support with evidence?',homeGame:"After a story, ask: 'Why do you think that happened?'"}
  },
  maths:{
    Seed:{title:'Counting bodies',focus:'one-to-one correspondence',steps:['Hold up 3 fingers slowly, counting aloud: 1, 2, 3. Children copy.','Ask how many fingers and confirm together.','Put 3 blocks in a row, touch each one as you count.','Ask a child to show 4 fingers.'],observe:'Who touches each object once while counting? Who skips?',homeGame:'Count 5 raisins with your child, touching each one.'},
    Sprout:{title:'Jump the 10 bridge',focus:'bridging through 10',steps:["Show 8 + 5 on the number line. 'How far to 10 from 8?' (2 jumps).","'We used 2. How many left from 5?' (3 left). Land on 13.",'Children copy with 7 + 6, then 9 + 4.','One child explains the jumps to the group.'],observe:'Who freezes crossing 10? Who splits the second number automatically?',homeGame:'Hold up 8 fingers, count on 5 more. Ask your child the total.'},
    Bloom:{title:'Smart strategies race',focus:'mental maths strategies',steps:["Pose 28 + 7. Ask: 'Does anyone see a shortcut?'",'Model: 28 + 2 = 30, then 30 + 5 = 35.','Pairs race to solve three more problems using any smart strategy.','Each pair explains their method.'],observe:'Who uses a mental strategy vs. who counts on? Can they explain it?',homeGame:"Ask: '17 + 8 — can you do it in your head? Show me how.'"},
    Tree:{title:'Problem detectives',focus:'multi-step word problems',steps:["Read a multi-step problem aloud: 'There are 125 learners. 48 go home. Then 17 arrive. How many now?'",'Children underline the key numbers and the question.','Each pair writes the number sentences for each step.','Pairs share different routes to the same answer.'],observe:'Who identifies the operation? Who can explain why?',homeGame:"Make a shopping problem: 'We have R50. Bread is R14, milk R18. How much change?'"}
  }
};
app.post('/api/activities',wrap((req,res)=>{
  const group   = req.body.group   || 'Sprout';
  const subject = req.body.subject || 'literacy';
  const library = activityLibrary[subject];
  must(library,          `Invalid subject: ${subject}. Use 'literacy' or 'maths'.`);
  must(library[group],   `Invalid group: ${group}`);
  const item={id:crypto.randomUUID(),group,subject,grade:db.classroom.grade,...library[group],minutes:subject==='maths'?10:3,source:'CAPS-aligned-micro-lesson',createdAt:new Date().toISOString()};
  db.activities.unshift(item);save();res.status(201).json(item);
}));
app.patch('/api/activities/:id',wrap((req,res)=>{const item=db.activities.find(x=>x.id===req.params.id);must(item,'Activity not found');if('title'in req.body)item.title=req.body.title;if('steps'in req.body)item.steps=req.body.steps;if('minutes'in req.body)item.minutes=req.body.minutes;save();res.json(item)}));
app.post('/api/activities/complete',wrap((req,res)=>{if(!db.completedActivities)db.completedActivities=[];const entry={group:req.body.group||'Sprout',title:req.body.title||'Sound hunt',date:new Date().toISOString().split('T')[0]};db.completedActivities.unshift(entry);save();res.status(201).json(entry)}));
app.post('/api/notes',wrap((req,res)=>{const l=db.learners.find(x=>x.id===req.body.learnerId);must(l,'Learner not found');const latest=db.assessments.find(a=>a.learnerId===l.id);const text=req.body.text||`Hello! ${l.name} took part in reading practice today. ${latest?`Their latest practice showed ${latest.accuracy}% word-match accuracy in the selected passage.`:'We are encouraging steady reading practice.'} Please read a short page together at home. — ${db.classroom.teacher}`;const note={id:crypto.randomUUID(),learnerId:l.id,text,status:'draft',language:l.language,channel:l.channel,createdAt:new Date().toISOString()};db.notes.unshift(note);save();res.status(201).json(note)}));
app.patch('/api/notes/:id',wrap((req,res)=>{const n=db.notes.find(x=>x.id===req.params.id);must(n,'Note not found');if('text'in req.body)n.text=String(req.body.text);if(req.body.status)n.status=req.body.status;save();res.json(n)}));
app.post('/api/notes/approve-all',wrap((req,res)=>{let count=0;for(const n of db.notes){if(n.status==='draft'||n.status==='to_review'){n.status='sent';count++}}save();res.json({ok:true,count,notes:db.notes})}));
app.delete('/api/notes/:id',wrap((req,res)=>{db.notes=db.notes.filter(x=>x.id!==req.params.id);save();res.json({ok:true})}));
app.post('/api/terms/:id/hod-review',wrap((req,res)=>{if(!db.terms)db.terms=[];const termId=Number(req.params.id);const t=db.terms.find(x=>x.id===termId);must(t,'Term not found');t.hodReviewed=true;t.reviewedBy=req.body.reviewedBy||'Mrs. Khumalo (HOD)';t.reviewedAt=new Date().toISOString();save();res.json(t)}));
app.get('/api/integrations/mtn-summary',(req,res)=>{const total=db.learners.length;const consented=db.learners.filter(l=>l.consent).length;const movedUp=db.learners.filter(l=>l.recentlyMoved===true).length;const notesSent=db.notes.filter(n=>n.status==='approved'||n.status==='sent').length;res.json({anonymizedTotals:{totalLearners:total,consentedLearners:consented,movedUpCount:movedUp,parentNotesDelivered:notesSent,termAverages:db.terms||[],zeroRatingConfirmed:false},compliance:'Demo aggregate only; no external privacy certification',status:'Not connected to MTN Foundation',externalReportingEnabled:false})});
app.get('/api/integrations/sa-sams',(req,res)=>{const records=db.learners.map(l=>({learnerRef:`SASAMS-${l.id.padStart(4,'0')}`,grade:db.classroom.grade,homeLanguage:l.language,consentRecorded:l.consent?'YES':'PENDING',currentReadingTier:l.group,term1Wpm:l.termProgress?.find(t=>t.term===1)?.wpm||null,term2Wpm:l.termProgress?.find(t=>t.term===2)?.wpm||null,term3Wpm:l.termProgress?.find(t=>t.term===3)?.wpm||null,term4Wpm:l.termProgress?.find(t=>t.term===4)?.wpm||null}));res.json({schoolCode:'EMIS-70021144',class:db.classroom.name,term:4,year:2026,records})});

// ==================== WHATSAPP-STYLE MESSAGING SYSTEM ====================
const SURNAMES = ['Mokoena', 'Dlamini', 'Nkosi', 'Patel', 'Modise', 'Molefe', 'Sithole', 'Khumalo', 'Ndlovu', 'Botha', 'Naidoo', 'Van der Merwe'];
const GUARDIAN_FIRST_NAMES = ['Nomsa', 'Kagiso', 'Busisiwe', 'Fatima', 'Tebogo', 'Palesa', 'Siphiwe', 'Lindiwe', 'Bongani', 'Zandile', 'Anil', 'Johan'];
const RELATIONSHIPS = ['Mother', 'Father', 'Mother', 'Father', 'Guardian', 'Mother', 'Aunt', 'Father'];

function getParentForLearner(learner, grade = 2) {
  if (!learner) return { id: 'parent-demo', name: "Thando's Parent", relationship: 'Parent', learnerId: 'demo', learnerName: 'Learner', grade: String(grade) };
  if (learner.name?.startsWith('Thando')) {
    return {
      id: `parent-${learner.id}`,
      name: 'Nomsa Mokoena',
      relationship: 'Mother',
      learnerId: String(learner.id),
      learnerName: 'Thando Mokoena',
      grade: String(grade),
      channel: 'WhatsApp'
    };
  }
  if (learner.name?.startsWith('Lerato')) {
    return {
      id: `parent-${learner.id}`,
      name: 'Kagiso Dlamini',
      relationship: 'Father',
      learnerId: String(learner.id),
      learnerName: 'Lerato Dlamini',
      grade: String(grade),
      channel: 'SMS'
    };
  }
  const numId = parseInt(String(learner.id).replace(/\D/g, '') || '1', 10);
  const surname = SURNAMES[(numId - 1) % SURNAMES.length];
  const firstName = GUARDIAN_FIRST_NAMES[(numId - 1) % GUARDIAN_FIRST_NAMES.length];
  const relationship = RELATIONSHIPS[(numId - 1) % RELATIONSHIPS.length];
  const learnerFullName = learner.name.includes(' ') ? learner.name : `${learner.name} ${surname}`;
  const parentName = `${firstName} ${surname}`;
  const parentId = `parent-${learner.id}`;
  return {
    id: parentId,
    name: parentName,
    relationship,
    learnerId: String(learner.id),
    learnerName: learnerFullName,
    grade: String(grade),
    channel: learner.channel || 'WhatsApp'
  };
}

function initMessagingData() {
  if (!db.conversations) db.conversations = [];
  if (!db.messages) db.messages = [];
  if (!db.groups) db.groups = [];
  if (!db.groupInvitations) db.groupInvitations = [];

  if (db.conversations.length === 0) {
    const thandoLearner = db.learners.find(l => l.name === 'Thando') || db.learners[0];
    const leratoLearner = db.learners.find(l => l.name === 'Lerato') || db.learners[1];
    const thandoParent = getParentForLearner(thandoLearner, db.classroom.grade);
    const leratoParent = getParentForLearner(leratoLearner, db.classroom.grade);

    const convThando = {
      id: 'conv-thando',
      type: 'private',
      title: `${thandoLearner.name}'s Parent (${thandoParent.name})`,
      grade: String(db.classroom.grade),
      classroom: db.classroom.name,
      learnerId: String(thandoLearner.id),
      participantIds: ['teacher-main', thandoParent.id],
      teacherId: 'teacher-main',
      parentId: thandoParent.id,
      lastMessage: 'Thank you, teacher!',
      lastMessageAt: '2026-11-02T10:45:00.000Z',
      unreadCount: { 'teacher-main': 0, [thandoParent.id]: 0 },
      createdAt: '2026-11-01T08:00:00.000Z'
    };

    const convLerato = {
      id: 'conv-lerato',
      type: 'private',
      title: `${leratoLearner.name}'s Parent (${leratoParent.name})`,
      grade: String(db.classroom.grade),
      classroom: db.classroom.name,
      learnerId: String(leratoLearner.id),
      participantIds: ['teacher-main', leratoParent.id],
      teacherId: 'teacher-main',
      parentId: leratoParent.id,
      lastMessage: "Good morning, Ma'am.",
      lastMessageAt: '2026-10-31T07:20:00.000Z',
      unreadCount: { 'teacher-main': 0, [leratoParent.id]: 0 },
      createdAt: '2026-10-30T08:00:00.000Z'
    };

    const group1 = {
      id: 'grp-grade2',
      name: `${db.classroom.name} Parents`,
      description: `Communication between the ${db.classroom.name} teacher and parents.`,
      creatorId: 'teacher-main',
      teacherAdminId: 'teacher-main',
      classroom: db.classroom.name,
      grade: String(db.classroom.grade),
      onlyAdminCanSend: false,
      createdAt: '2026-10-29T09:00:00.000Z',
      members: [
        { id: 'teacher-main', name: db.classroom.teacher, role: 'admin', status: 'accepted', joinedAt: '2026-10-29T09:00:00.000Z' },
        { id: thandoParent.id, name: thandoParent.name, learnerName: thandoLearner.name, role: 'member', status: 'accepted', joinedAt: '2026-10-29T11:00:00.000Z' },
        { id: leratoParent.id, name: leratoParent.name, learnerName: leratoLearner.name, role: 'member', status: 'pending', joinedAt: null }
      ]
    };

    const convGroup = {
      id: 'conv-grp-grade2',
      type: 'group',
      groupId: 'grp-grade2',
      title: group1.name,
      grade: String(db.classroom.grade),
      classroom: db.classroom.name,
      participantIds: ['teacher-main', thandoParent.id],
      teacherId: 'teacher-main',
      lastMessage: 'Reminder: Homework is due tomorrow.',
      lastMessageAt: '2026-11-01T15:30:00.000Z',
      unreadCount: { 'teacher-main': 0, [thandoParent.id]: 0 },
      createdAt: '2026-10-29T09:00:00.000Z'
    };

    db.groups.push(group1);
    db.conversations.push(convThando, convGroup, convLerato);

    db.groupInvitations.push({
      id: 'inv-lerato',
      groupId: 'grp-grade2',
      groupName: group1.name,
      groupDescription: group1.description,
      classroom: db.classroom.name,
      grade: String(db.classroom.grade),
      parentId: leratoParent.id,
      parentName: leratoParent.name,
      learnerName: leratoLearner.name,
      teacherId: 'teacher-main',
      teacherName: db.classroom.teacher,
      status: 'pending',
      createdAt: '2026-10-29T09:00:00.000Z',
      respondedAt: null
    });

    db.messages.push(
      {
        id: 'msg-1',
        conversationId: 'conv-thando',
        senderId: 'teacher-main',
        senderName: db.classroom.teacher,
        senderRole: 'teacher',
        text: `Sawubona! Thando read with wonderful fluency today. Keep practising the "th" sound at home.`,
        createdAt: '2026-11-02T10:30:00.000Z',
        status: 'read'
      },
      {
        id: 'msg-2',
        conversationId: 'conv-thando',
        senderId: thandoParent.id,
        senderName: thandoParent.name,
        senderRole: 'parent',
        text: 'Thank you, teacher!',
        createdAt: '2026-11-02T10:45:00.000Z',
        status: 'read'
      },
      {
        id: 'msg-3',
        conversationId: 'conv-grp-grade2',
        senderId: 'teacher-main',
        senderName: db.classroom.teacher,
        senderRole: 'teacher',
        text: 'Reminder: Homework is due tomorrow.',
        createdAt: '2026-11-01T15:30:00.000Z',
        status: 'read'
      },
      {
        id: 'msg-4',
        conversationId: 'conv-lerato',
        senderId: leratoParent.id,
        senderName: leratoParent.name,
        senderRole: 'parent',
        text: "Good morning, Ma'am.",
        createdAt: '2026-10-31T07:20:00.000Z',
        status: 'read'
      }
    );
    save();
  }
}
initMessagingData();

// 1. Directory of learners and linked parents for teacher's classroom
app.get('/api/messages/learners-parents', wrap((req, res) => {
  const directory = db.learners.map(l => ({
    learner: {
      id: l.id,
      name: l.name,
      group: l.group,
      grade: db.classroom.grade,
      classroom: db.classroom.name
    },
    parent: getParentForLearner(l, db.classroom.grade)
  }));
  res.json(directory);
}));

// 2. Bootstrap / Poll messaging state
app.get('/api/messages/bootstrap', wrap((req, res) => {
  const role = req.query.role || 'teacher';
  const userId = req.query.userId || (role === 'teacher' ? 'teacher-main' : 'parent-1');
  const grade = req.query.grade ? String(req.query.grade) : String(db.classroom.grade);

  let convs = [];
  let invitations = [];

  if (role === 'teacher') {
    // Teachers see private chats with parents of their learners, and groups they admin
    convs = db.conversations.filter(c => c.participantIds.includes(userId) || c.teacherId === userId);
    invitations = db.groupInvitations.filter(inv => inv.teacherId === userId);
  } else {
    // Parents see ONLY conversations they are an accepted participant of
    convs = db.conversations.filter(c => c.participantIds.includes(userId));
    invitations = db.groupInvitations.filter(inv => inv.parentId === userId && inv.status === 'pending');
  }

  const directory = role === 'teacher'
    ? db.learners.map(l => ({
        learner: { id: l.id, name: l.name, group: l.group, grade: db.classroom.grade, classroom: db.classroom.name },
        parent: getParentForLearner(l, db.classroom.grade)
      }))
    : [];

  res.json({
    conversations: convs,
    invitations,
    groups: db.groups,
    directory
  });
}));

// 3. Get messages for a specific conversation
app.get('/api/messages/conversations/:id/messages', wrap((req, res) => {
  const conv = db.conversations.find(c => c.id === req.params.id);
  must(conv, 'Conversation not found');

  const userId = req.query.userId;
  if (userId) {
    must(conv.participantIds.includes(userId) || conv.teacherId === userId, 'Unauthorized access to conversation');
  }

  const msgs = db.messages.filter(m => m.conversationId === conv.id);
  res.json(msgs);
}));

// 4. Send message in a conversation
app.post('/api/messages/conversations/:id/messages', wrap((req, res) => {
  const conv = db.conversations.find(c => c.id === req.params.id);
  must(conv, 'Conversation not found');

  const { senderId, senderName, senderRole, text, category } = req.body;
  must(senderId && text?.trim(), 'Sender ID and message text are required');

  // Security: user must be participant
  must(conv.participantIds.includes(senderId) || conv.teacherId === senderId, 'Unauthorized: Sender is not a participant');

  // If group has onlyAdminCanSend, check permission
  if (conv.type === 'group' && conv.groupId) {
    const grp = db.groups.find(g => g.id === conv.groupId);
    if (grp?.onlyAdminCanSend && senderRole !== 'teacher') {
      must(false, 'Only the teacher can send messages in this group');
    }
  }

  const msg = {
    id: crypto.randomUUID(),
    conversationId: conv.id,
    senderId,
    senderName: senderName || (senderRole === 'teacher' ? db.classroom.teacher : 'Parent'),
    senderRole: senderRole || 'teacher',
    text: text.trim(),
    category: category || null,
    createdAt: new Date().toISOString(),
    status: 'delivered'
  };

  db.messages.push(msg);

  // Update conversation last message
  conv.lastMessage = msg.text;
  conv.lastMessageAt = msg.createdAt;

  // Increment unread count for other participants
  if (!conv.unreadCount) conv.unreadCount = {};
  for (const pid of conv.participantIds) {
    if (pid !== senderId) {
      conv.unreadCount[pid] = (conv.unreadCount[pid] || 0) + 1;
    }
  }

  save();
  res.status(201).json(msg);
}));

// 5. Open or create private conversation with a learner's linked parent
app.post('/api/messages/conversations', wrap((req, res) => {
  const { learnerId, grade, teacherId, teacherName } = req.body;
  must(learnerId, 'Learner ID is required');

  const learner = db.learners.find(l => String(l.id) === String(learnerId));
  must(learner, 'Learner not found in classroom');

  const parent = getParentForLearner(learner, grade || db.classroom.grade);
  const tId = teacherId || 'teacher-main';

  // Check if private conversation already exists
  let conv = db.conversations.find(c => c.type === 'private' && c.learnerId === String(learner.id) && c.participantIds.includes(tId));

  if (!conv) {
    conv = {
      id: crypto.randomUUID(),
      type: 'private',
      title: `${learner.name}'s Parent (${parent.name})`,
      grade: String(grade || db.classroom.grade),
      classroom: db.classroom.name,
      learnerId: String(learner.id),
      participantIds: [tId, parent.id],
      teacherId: tId,
      parentId: parent.id,
      lastMessage: 'Conversation opened',
      lastMessageAt: new Date().toISOString(),
      unreadCount: { [tId]: 0, [parent.id]: 0 },
      createdAt: new Date().toISOString()
    };
    db.conversations.unshift(conv);
    save();
  }

  res.status(201).json(conv);
}));

// 6. Create group and send invitations (Teachers only)
app.post('/api/messages/groups', wrap((req, res) => {
  const { name, description, grade, learnerIds, onlyAdminCanSend, teacherId, teacherName } = req.body;
  must(name?.trim(), 'Group name is required');
  must(Array.isArray(learnerIds) && learnerIds.length > 0, 'At least one learner must be selected');

  const tId = teacherId || 'teacher-main';
  const tName = teacherName || db.classroom.teacher;
  const groupId = crypto.randomUUID();

  // Find linked parents for selected learners and de-duplicate
  const selectedParents = [];
  const seenParents = new Set();

  for (const lid of learnerIds) {
    const l = db.learners.find(x => String(x.id) === String(lid));
    if (l) {
      const p = getParentForLearner(l, grade || db.classroom.grade);
      if (!seenParents.has(p.id)) {
        seenParents.add(p.id);
        selectedParents.push(p);
      }
    }
  }

  const group = {
    id: groupId,
    name: name.trim(),
    description: description?.trim() || `Communication between ${tName} and parents.`,
    creatorId: tId,
    teacherAdminId: tId,
    classroom: db.classroom.name,
    grade: String(grade || db.classroom.grade),
    onlyAdminCanSend: !!onlyAdminCanSend,
    createdAt: new Date().toISOString(),
    members: [
      { id: tId, name: tName, role: 'admin', status: 'accepted', joinedAt: new Date().toISOString() },
      ...selectedParents.map(p => ({
        id: p.id,
        name: p.name,
        learnerName: p.learnerName,
        role: 'member',
        status: 'pending',
        joinedAt: null
      }))
    ]
  };

  db.groups.unshift(group);

  // Create conversation for this group
  const conv = {
    id: crypto.randomUUID(),
    type: 'group',
    groupId: group.id,
    title: group.name,
    grade: group.grade,
    classroom: group.classroom,
    participantIds: [tId], // Only teacher initially until parents accept
    teacherId: tId,
    lastMessage: `Group "${group.name}" created by ${tName}`,
    lastMessageAt: new Date().toISOString(),
    unreadCount: { [tId]: 0 },
    createdAt: new Date().toISOString()
  };
  db.conversations.unshift(conv);

  // Generate invitations for linked parents
  for (const p of selectedParents) {
    db.groupInvitations.unshift({
      id: crypto.randomUUID(),
      groupId: group.id,
      groupName: group.name,
      groupDescription: group.description,
      classroom: group.classroom,
      grade: group.grade,
      parentId: p.id,
      parentName: p.name,
      learnerName: p.learnerName,
      teacherId: tId,
      teacherName: tName,
      status: 'pending',
      createdAt: new Date().toISOString(),
      respondedAt: null
    });
  }

  save();
  res.status(201).json({ group, conversation: conv });
}));

// 7. Update group settings (Teacher only)
app.patch('/api/messages/groups/:id', wrap((req, res) => {
  const grp = db.groups.find(g => g.id === req.params.id);
  must(grp, 'Group not found');

  if (req.body.name) grp.name = req.body.name.trim();
  if (req.body.description !== undefined) grp.description = req.body.description.trim();
  if (req.body.onlyAdminCanSend !== undefined) grp.onlyAdminCanSend = Boolean(req.body.onlyAdminCanSend);

  const conv = db.conversations.find(c => c.groupId === grp.id);
  if (conv && req.body.name) conv.title = grp.name;

  save();
  res.json(grp);
}));

// 8. Add more members to group (Teacher only)
app.post('/api/messages/groups/:id/members', wrap((req, res) => {
  const grp = db.groups.find(g => g.id === req.params.id);
  must(grp, 'Group not found');
  const { learnerIds } = req.body;
  must(Array.isArray(learnerIds), 'Learner IDs array required');

  for (const lid of learnerIds) {
    const l = db.learners.find(x => String(x.id) === String(lid));
    if (l) {
      const p = getParentForLearner(l, grp.grade);
      if (!grp.members.some(m => m.id === p.id)) {
        grp.members.push({
          id: p.id,
          name: p.name,
          learnerName: p.learnerName,
          role: 'member',
          status: 'pending',
          joinedAt: null
        });
        db.groupInvitations.unshift({
          id: crypto.randomUUID(),
          groupId: grp.id,
          groupName: grp.name,
          groupDescription: grp.description,
          classroom: grp.classroom,
          grade: grp.grade,
          parentId: p.id,
          parentName: p.name,
          learnerName: p.learnerName,
          teacherId: grp.teacherAdminId,
          teacherName: db.classroom.teacher,
          status: 'pending',
          createdAt: new Date().toISOString(),
          respondedAt: null
        });
      }
    }
  }

  save();
  res.json(grp);
}));

// 9. Remove member from group (Teacher removes, or Parent leaves)
app.delete('/api/messages/groups/:id/members/:memberId', wrap((req, res) => {
  const grp = db.groups.find(g => g.id === req.params.id);
  must(grp, 'Group not found');

  grp.members = grp.members.filter(m => m.id !== req.params.memberId);

  const conv = db.conversations.find(c => c.groupId === grp.id);
  if (conv) {
    conv.participantIds = conv.participantIds.filter(id => id !== req.params.memberId);
  }

  save();
  res.json({ ok: true, group: grp });
}));

// 10. Parent responds to Group Invitation (accept / decline)
app.post('/api/messages/invitations/:id/respond', wrap((req, res) => {
  const inv = db.groupInvitations.find(i => i.id === req.params.id);
  must(inv, 'Invitation not found');
  const { parentId, action } = req.body;
  must(action === 'accept' || action === 'decline', 'Action must be accept or decline');

  inv.status = action === 'accept' ? 'accepted' : 'declined';
  inv.respondedAt = new Date().toISOString();

  const grp = db.groups.find(g => g.id === inv.groupId);
  if (grp) {
    const member = grp.members.find(m => m.id === inv.parentId);
    if (member) {
      member.status = inv.status;
      if (action === 'accept') {
        member.joinedAt = inv.respondedAt;
      }
    }
  }

  const conv = db.conversations.find(c => c.groupId === inv.groupId);
  if (conv) {
    if (action === 'accept') {
      if (!conv.participantIds.includes(inv.parentId)) {
        conv.participantIds.push(inv.parentId);
      }
    } else {
      conv.participantIds = conv.participantIds.filter(id => id !== inv.parentId);
    }
  }

  save();
  res.json({ ok: true, invitation: inv });
}));

const distPath = path.resolve(here, '../../frontend/dist');

// Mount Lesedi AI agent routes (/api/lesedi, /api/lesedi/health)
// saveNote persists Lesedi-generated drafts directly to the DB (no internal HTTP round-trip).
mountLesedi(app, {
  saveNote: (learnerId, text) => {
    const l = db.learners.find(x => x.id === learnerId);
    if (!l) return;
    const note = {
      id: crypto.randomUUID(),
      learnerId: l.id,
      text,
      status: 'draft',
      language: l.language,
      channel: l.channel,
      createdAt: new Date().toISOString(),
    };
    db.notes.unshift(note);
    save();
  },
});

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const port = process.env.PORT || 4000;
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const server = app.listen(port, host, () => console.log(`Teacher Copilot running on http://localhost:${port}`));
server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\nPort ${port} is already in use.\nStop the other process or set a different port:\n  PORT=4001 npm run dev\n`);
    process.exit(1);
  } else throw e;
});

export default app;
