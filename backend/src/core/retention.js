import {fileURLToPath} from 'node:url';
import {CoreRepository} from './repository.js';
// Opt-in maintenance: retain assessment summaries and approval audit, expire detail text.
export function applyRetention(db,days,at=Date.now()) {
  if(!Number.isInteger(days)||days<30||days>3650)throw Error('Retention must be 30–3650 days');
  const cutoff=at-days*86400000;let drafts=0,notifications=0;
  for(const d of db.drafts)if(['APPROVED','REJECTED'].includes(d.status)&&Date.parse(d.reviewedAt)<cutoff&&!d.detailsExpiredAt){
    d.analysis='Details expired under the configured retention policy.';d.intervention='Details expired.';d.parentUpdate='Details expired.';
    if(d.evidence)delete d.evidence.rounds;d.detailsExpiredAt=new Date(at).toISOString();drafts++;
  }
  for(const n of db.notifications)if(Date.parse(n.createdAt)<cutoff&&!n.detailsExpiredAt){n.text='This update expired under the school retention policy.';n.detailsExpiredAt=new Date(at).toISOString();notifications++;}
  for(const a of db.accounts)a.sessions=(a.sessions||[]).filter(s=>s.expires>at);
  return {drafts,notifications};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const days=Number(process.env.CORE_RETENTION_DAYS||90),apply=process.argv.includes('--apply');
  new CoreRepository().transaction(db=>applyRetention(apply?db:structuredClone(db),days)).then(result=>{console.log(JSON.stringify({mode:apply?'applied':'dry-run',days,...result}));process.exit(0);}).catch(e=>{console.error(e.message);process.exitCode=1;});
}
