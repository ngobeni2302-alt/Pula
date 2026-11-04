// Trusted administrator CLI only. There is no public school-claiming endpoint.
import {getPool} from '../store/pool.js';
import {CoreRepository} from './repository.js';
import {hashPassword} from './auth.js';
const [userId,email]=process.argv.slice(2), password=process.env.PROVISION_PASSWORD;
try {
  if(!userId||!email||!password||password.length<12)throw Error('Usage: PROVISION_PASSWORD=<12+ characters> node backend/src/core/provision.js <existing-user-UUID> <email>');
  const pool=getPool(),{rows}=await pool.query('SELECT id,school_id AS "schoolId",name,role FROM users WHERE id=$1',[userId]);
  const u=rows[0];if(!u?.schoolId)throw Error('An existing school-associated user is required');
  const learnerIds=(process.env.VERIFIED_LEARNER_IDS||'').split(',').filter(Boolean);
  // Only an administrator who has verified guardian records should supply these IDs.
  for(const id of learnerIds){const {rows}=await pool.query('SELECT l.id FROM learners l JOIN classrooms c ON c.id=l.classroom_id WHERE l.id=$1 AND c.school_id=$2 AND l.deleted_at IS NULL',[id,u.schoolId]);if(!rows.length)throw Error('Parent links must belong to the same school');}
  const passwordHash=await hashPassword(password),repo=new CoreRepository({postgres:true});
  await repo.transaction(db=>{if(db.accounts.some(a=>a.id===u.id||a.email===email.toLowerCase()))throw Error('Account already exists; no credentials changed');db.accounts.push({...u,email:email.toLowerCase(),passwordHash,learnerIds:u.role==='parent'?learnerIds:[],sessions:[]});});
  console.log('Account provisioned. No credentials printed.');await pool.end();
}catch(e){console.error(e.message);process.exitCode=1;}
