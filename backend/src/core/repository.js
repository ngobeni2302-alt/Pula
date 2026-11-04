import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { getPool } from '../store/pool.js';
const tables = ['accounts','assignments','drafts','notifications','audits'];
export const emptyState = () => ({ schools:[], classrooms:[], learners:[], accounts:[], assignments:[], drafts:[], notifications:[], audits:[] });
export class CoreRepository {
  constructor({ file = process.env.CORE_DATA_FILE || fileURLToPath(new URL('../../data/core.json',import.meta.url)), postgres = (process.env.USE_JSON_STORE ?? 'true') === 'false' } = {}) {
    this.file=file; this.postgres=postgres; this.queue=Promise.resolve();
  }
  async transaction(fn) {
    if (this.postgres) return this.pgTransaction(fn);
    const job=this.queue.then(async()=>{
      let db;
      try {db=JSON.parse(fs.readFileSync(this.file,'utf8'));} catch(e) {if(e.code!=='ENOENT')throw e; db=emptyState();}
      const result=await fn(db);
      fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});
      fs.writeFileSync(`${this.file}.tmp`,JSON.stringify(db),{mode:0o600});
      fs.renameSync(`${this.file}.tmp`,this.file);
      return structuredClone(result);
    });
    this.queue=job.catch(()=>{}); return job;
  }
  async pgTransaction(fn) {
    const client=await getPool().connect();
    try {
      await client.query('BEGIN');
      // Serialize multi-record approvals and duplicate submissions across server instances.
      await client.query('SELECT pg_advisory_xact_lock(739215)');
      const db=emptyState();
      db.schools=(await client.query('SELECT * FROM schools')).rows;
      db.classrooms=(await client.query('SELECT id, school_id AS "schoolId", teacher_id AS "teacherId", name, grade FROM classrooms WHERE deleted_at IS NULL')).rows;
      db.learners=(await client.query(`SELECT l.id, l.classroom_id AS "classroomId", c.school_id AS "schoolId", l.first_name AS name,
        l.literacy_tier AS "group", l.language,
        COALESCE((SELECT granted FROM current_consent WHERE learner_id=l.id AND scope='analysis'),false) AS consent,
        COALESCE((SELECT granted FROM current_consent WHERE learner_id=l.id AND scope='voice'),false) AS "voiceConsent"
        FROM learners l JOIN classrooms c ON c.id=l.classroom_id WHERE l.deleted_at IS NULL AND c.deleted_at IS NULL`)).rows;
      for(const t of tables)db[t]=(await client.query(`SELECT payload FROM core_${t}`)).rows.map(r=>r.payload);
      const before=Object.fromEntries(tables.map(t=>[t,new Map(db[t].map(r=>[r.id,JSON.stringify(r)]))]));
      const originalTiers=new Map(db.learners.map(l=>[l.id,l.group]));
      const result=await fn(db);
      for(const l of db.learners)if(originalTiers.get(l.id)!==l.group) {
        await client.query('UPDATE learners SET literacy_tier=$1, updated_at=now() WHERE id=$2',[l.group,l.id]);
        await client.query("INSERT INTO tier_history(learner_id,subject,tier,changed_by,reason) VALUES($1,'English',$2,$3,$4)",[l.id,l.group,l.tierChangedBy,l.tierChangeReason]);
      }
      for(const t of tables)for(const r of db[t]) {
        if(before[t].get(r.id)===JSON.stringify(r))continue;
        if(t==='accounts'&&!before[t].has(r.id))await client.query('INSERT INTO users(id,name,role,school_id) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',[r.id,r.name,r.role,r.schoolId]);
        const linked=['assignments','drafts','notifications'].includes(t);
        await client.query(`INSERT INTO core_${t} (id,school_id,${linked?'learner_id,teacher_id,':''}payload)
          VALUES ($1,$2,${linked?'$3,$4,$5':'$3'}) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload`,
          linked?[r.id,r.schoolId,r.learnerId,r.teacherId,JSON.stringify(r)]:[r.id,r.schoolId,JSON.stringify(r)]);
      }
      await client.query('COMMIT'); return result;
    } catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();}
  }
}
