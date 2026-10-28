import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const dbPath=process.env.DATA_FILE||path.join(here,'../data.json');
const initial={classroom:{name:'Grade 2B',teacher:'Teacher',code:'READ2B',grade:2},learners:[['1','Thando','Sprout',true,'isiZulu','WhatsApp'],['2','Lerato','Bloom',true,'Sepedi','SMS'],['3','Sipho','Seed',true,'English','WhatsApp'],['4','Aisha','Sprout',true,'English','SMS'],['5','Kabelo','Tree',true,'English','SMS'],['6','Naledi','Sprout',true,'English','WhatsApp'],['7','Zanele','Seed',true,'isiZulu','SMS'],['8','Ruan','Seed',true,'English','SMS'],['9','Palesa','Seed',false,'English','WhatsApp'],['10','Neo','Bloom',true,'English','SMS'],['11','Amahle','Bloom',true,'isiZulu','WhatsApp'],['12','Tumi','Tree',true,'English','WhatsApp']].map(([id,name,group,consent,language,channel])=>({id,name,group,consent,language,channel,parentContact:''})),assessments:[],notes:[],activities:[]};
function load(){try{return JSON.parse(fs.readFileSync(dbPath,'utf8'))}catch{return structuredClone(initial)}}
let db=load();function save(){fs.writeFileSync(dbPath,JSON.stringify(db,null,2))}
const app=express();app.use(cors());app.use(express.json({limit:'2mb'}));
const wrap=f=>(req,res)=>{try{f(req,res)}catch(e){res.status(400).json({error:e.message})}};
const must=(cond,msg)=>{if(!cond)throw Error(msg)};
app.get('/api/health',(req,res)=>res.json({ok:true,mode:'local-demo'}));
app.get('/api/state',(req,res)=>res.json(db));
app.patch('/api/classroom',wrap((req,res)=>{db.classroom={...db.classroom,...req.body};save();res.json(db.classroom)}));
app.post('/api/learners',wrap((req,res)=>{must(req.body.name?.trim(),'Learner name is required');let learner={id:crypto.randomUUID(),name:req.body.name.trim(),group:'Seed',consent:false,language:'English',channel:'SMS',parentContact:''};db.learners.push(learner);save();res.status(201).json(learner)}));
app.patch('/api/learners/:id',wrap((req,res)=>{const l=db.learners.find(x=>x.id===req.params.id);must(l,'Learner not found');const allowed=['name','group','consent','language','channel','parentContact'];for(const k of allowed)if(k in req.body)l[k]=req.body[k];save();res.json(l)}));
app.delete('/api/learners/:id',wrap((req,res)=>{db.learners=db.learners.filter(x=>x.id!==req.params.id);save();res.json({ok:true})}));
function words(s){return (s.toLowerCase().match(/[\p{L}']+/gu)||[])}
function score(expected,spoken,durationSeconds){const a=words(expected),b=words(spoken);let dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);let correct=dp[a.length][b.length];return{correct,total:a.length,accuracy:a.length?Math.round(100*correct/a.length):0,wpm:durationSeconds>0?Math.round(b.length*60/durationSeconds):0}}
app.post('/api/assessments',wrap((req,res)=>{const {learnerId,passage,transcript,durationSeconds}=req.body;const l=db.learners.find(x=>x.id===learnerId);must(l,'Learner not found');must(l.consent,'Parent consent is required before assessment');must(passage?.trim()&&transcript?.trim(),'Passage and transcript required');must(Number(durationSeconds)>0,'Duration must be positive');const result=score(passage,transcript,Number(durationSeconds));const suggested=result.accuracy<60?'Seed':result.accuracy<78?'Sprout':result.accuracy<92?'Bloom':'Tree';const assessment={id:crypto.randomUUID(),learnerId,passage,transcript,durationSeconds:Number(durationSeconds),...result,suggestedGroup:suggested,createdAt:new Date().toISOString(),source:'browser-transcript',reviewed:false};db.assessments.unshift(assessment);save();res.status(201).json(assessment)}));
app.post('/api/assessments/:id/approve',wrap((req,res)=>{const a=db.assessments.find(x=>x.id===req.params.id);must(a,'Assessment not found');const l=db.learners.find(x=>x.id===a.learnerId);must(l,'Learner not found');a.reviewed=true;if(req.body.applyGroup){l.group=req.body.group||a.suggestedGroup}save();res.json(a)}));
const activityLibrary={Seed:{title:'Sound & letter hunt',steps:['Say three simple letter sounds together.','Find classroom objects starting with those sounds.','Blend short words and read them aloud.']},Sprout:{title:'Sound hunt',steps:['Say a word with the new sound. Children clap when they hear it.','Find three things that start with the sound.','Read a short passage together, then in pairs.']},Bloom:{title:'Story builders',steps:['Read a short paragraph aloud.','Identify the main idea and three details.','Retell the story with a partner.']},Tree:{title:'Reading detectives',steps:['Read a new passage independently.','Find evidence for two comprehension questions.','Explain the meaning of three new words.']}};
app.post('/api/activities',wrap((req,res)=>{const group=req.body.group||'Sprout';must(activityLibrary[group],'Invalid group');const item={id:crypto.randomUUID(),group,grade:db.classroom.grade,...activityLibrary[group],minutes:10,source:'editable-template-not-AI',createdAt:new Date().toISOString()};db.activities.unshift(item);save();res.status(201).json(item)}));
app.post('/api/notes',wrap((req,res)=>{const l=db.learners.find(x=>x.id===req.body.learnerId);must(l,'Learner not found');const latest=db.assessments.find(a=>a.learnerId===l.id);const text=req.body.text||`Hello! ${l.name} took part in reading practice today. ${latest?`Their latest practice showed ${latest.accuracy}% word-match accuracy in the selected passage.`:'We are encouraging steady reading practice.'} Please read a short page together at home. — ${db.classroom.teacher}`;const note={id:crypto.randomUUID(),learnerId:l.id,text,status:'draft',language:l.language,channel:l.channel,createdAt:new Date().toISOString()};db.notes.unshift(note);save();res.status(201).json(note)}));
app.patch('/api/notes/:id',wrap((req,res)=>{const n=db.notes.find(x=>x.id===req.params.id);must(n,'Note not found');if('text'in req.body)n.text=String(req.body.text);if(req.body.status==='approved')n.status='approved';save();res.json(n)}));
app.delete('/api/notes/:id',wrap((req,res)=>{db.notes=db.notes.filter(x=>x.id!==req.params.id);save();res.json({ok:true})}));
const distPath = path.resolve(here, '../../frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Teacher Copilot running unified on http://localhost:${port}`));

export default app;
