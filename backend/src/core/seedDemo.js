import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {CoreRepository} from './repository.js';
import {hashPassword} from './auth.js';
import {seedData} from '../../../frontend/src/dashboardData.js';
export async function seedDemo(repo=new CoreRepository()) {
  if(process.env.NODE_ENV==='production'||repo.postgres)throw Error('Demo provisioning is only allowed in local JSON mode');
  const password=process.env.PULA_DEMO_PASSWORD||'Pula-Local-2026!';
  const passwordHash=await hashPassword(password);
  return repo.transaction(db=>{
    if(db.accounts.length)return {created:false};
    const schoolId=crypto.randomUUID();db.schools.push({id:schoolId,name:'Pula fictional demo school'});
    for(const c of seedData().classes) {
      const teacherId=crypto.randomUUID(), classroomId=crypto.randomUUID();
      db.accounts.push({id:teacherId,schoolId,name:c.teacher,role:'teacher',teacherCode:`DEMO-TCH-${c.grade}`,email:`teacher${c.grade.toLowerCase()}@pula.local`,passwordHash,sessions:[]});
      db.classrooms.push({id:classroomId,schoolId,teacherId,grade:c.grade,name:`Grade ${c.room}`});
      for(const l of c.learners)db.learners.push({id:crypto.randomUUID(),legacyId:l.id,schoolId,classroomId,name:l.name,group:l.group,consent:l.consent,voiceConsent:false,language:'English'});
      const child=db.learners.find(l=>l.classroomId===classroomId&&l.name==='Thando')||db.learners.find(l=>l.classroomId===classroomId);
      db.accounts.push({id:crypto.randomUUID(),schoolId,name:`${child.name}'s parent`,role:'parent',email:`parent${c.grade.toLowerCase()}@pula.local`,passwordHash,learnerIds:[child.id],sessions:[]});
    }
    db.accounts.push({id:crypto.randomUUID(),schoolId,name:'Demo HOD',role:'hod',email:'hod@pula.local',passwordHash,sessions:[]});
    return {created:true};
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url))seedDemo().then(r=>console.log(r.created?'Created local fictional accounts. See docs/LESEDI_CORE.md for credentials.':'Existing accounts preserved.')).catch(e=>{console.error(e.message);process.exitCode=1;});
