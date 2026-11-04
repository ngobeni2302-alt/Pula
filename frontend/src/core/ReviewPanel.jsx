import React,{useEffect,useState} from 'react';
import {coreApi,useCore} from './CoreContext.jsx';
export function PendingDraftCard({onOpen}) {
  const {workspace,revision}=useCore();const [count,setCount]=useState(null);
  useEffect(()=>{let active=true;setCount(null);if(workspace?.account.role==='teacher')coreApi('/drafts').then(ds=>{if(active)setCount(ds.filter(d=>d.status==='DRAFT_PENDING_APPROVAL').length);}).catch(()=>{});return()=>{active=false;};},[workspace,revision]);
  return workspace?.account.role==='teacher'?<button className="pd-note pd-full" onClick={onOpen}>{count===null?'Load pending assessments':`${count} Lesedi drafts ready`} · Lesedi drafted them. You approve. →</button>:null;
}
export default function ReviewPanel() {
  const {workspace,revision,refresh}=useCore();const [drafts,setDrafts]=useState([]),[error,setError]=useState('');
  useEffect(()=>{let active=true;if(workspace?.account.role==='teacher')coreApi('/drafts').then(d=>{if(active)setDrafts(d);}).catch(e=>{if(active)setError(e.message);});else setDrafts([]);return()=>{active=false;};},[workspace,revision]);
  if(!workspace)return null;
  if(workspace.account.role!=='teacher')return <p>Open the teacher profile to review this learner’s drafts.</p>;
  return <section className="core-review"><h1>Lesedi drafts</h1><p>Draft · Teacher Decides. Assessment approval does not change a reading tier.</p>{error&&<p role="alert">{error}</p>}{drafts.length===0&&<p>No recorded activity drafts yet.</p>}{[...drafts].reverse().map(d=><Draft key={`${d.id}-${d.version}`} draft={d} onSaved={refresh}/>)}</section>;
}
function Draft({draft:d,onSaved}) {
  const [edited,setEdited]=useState({analysis:d.analysis,intervention:d.intervention,parentUpdate:d.parentUpdate}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [tier,setTier]=useState(''),[reason,setReason]=useState('');
  const {reload}=useCore();
  const pending=d.status==='DRAFT_PENDING_APPROVAL';
  async function act(action) {setBusy(true);setError('');try{await coreApi(`/drafts/${d.id}/review`,{action,edited,version:d.version,requestId:crypto.randomUUID()});onSaved();}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <article className="pd-card"><small>{d.status.replaceAll('_',' ')} · {new Date(d.createdAt).toLocaleString('en-ZA')}</small><h2>{d.learnerName} · {d.activityName}</h2><p>{d.score===null?'Participation recorded · no validated score':`${d.score}% first-choice recognition`}</p><p>{d.limitations}</p><small>{d.source}</small>{d.speechEvidence&&(d.speechEvidence.transcript||d.speechEvidence.recordingCaptured)&&<details className="core-speech-evidence" open><summary>Voice capture · {Math.round(d.speechEvidence.durationSeconds||0)} seconds</summary>{d.speechEvidence.transcript?<label>What the browser heard<textarea readOnly value={d.speechEvidence.transcript}/></label>:<p>Voice was recorded, but no transcript was returned by the browser.</p>}<small>Browser transcription is unverified. This transcript is kept only for this open app session; raw audio is discarded after activity completion.</small></details>}{Object.entries({analysis:'Draft analysis',intervention:'Suggested classroom intervention and actionable tip',parentUpdate:'Draft parent message'}).map(([key,label])=><label key={key}>{label}<textarea disabled={!pending||busy} value={edited[key]} onChange={e=>setEdited({...edited,[key]:e.target.value})}/></label>)}{error&&<p role="alert">{error}</p>}{pending&&<div className="core-actions"><button disabled={busy} onClick={()=>act('save')}>Save Draft</button><button disabled={busy} onClick={()=>act('approve')}>Approve Assessment</button><button className="pd-primary" disabled={busy} onClick={()=>act('approve-send')}>Approve and Send</button><button disabled={busy} onClick={()=>act('reject')}>Reject</button></div>}{d.status==='APPROVED'&&<details><summary>Separate teacher decision: reading tier</summary><p>Assessment approval never changes the tier. Record an independent teacher decision here.</p><label>New reading tier<select value={tier} onChange={e=>setTier(e.target.value)}><option value="">Choose a tier</option>{['Seed','Sprout','Bloom','Tree'].map(g=><option key={g}>{g}</option>)}</select></label><label>Teacher’s reason<input value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={!tier||!reason.trim()||busy} onClick={async()=>{setBusy(true);try{await coreApi(`/learners/${d.learnerId}/tier`,{group:tier,reason,requestId:crypto.randomUUID()});await reload();onSaved();}catch(e){setError(e.message);}finally{setBusy(false);}}}>Confirm separate tier change</button></details>}
    <small>Approve and Send adds your edited update to the parent conversation.</small></article>;
}
export function ParentApprovedUpdates() {
  const {workspace,revision}=useCore();const [data,setData]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;setData(null);if(workspace?.account.role==='parent')coreApi('/progress').then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[workspace,revision]);
  if(workspace?.account.role!=='parent')return null;
  return <section className="pd-card"><h2>Teacher-approved progress</h2>{error&&<p role="alert">{error}</p>}{data?.learners.map(l=><p key={l.id}>{l.name} · {l.group}</p>)}{data?.updates.map(n=><article key={n.id}><p>{n.text}</p><small>{n.channel} · {n.status} · {new Date(n.createdAt).toLocaleString('en-ZA')}</small></article>)}{data?.assessments.map(a=><p key={a.id}>{a.activityName} · {a.score===null?'Participation':`${a.score}% recognition`} · Approved {new Date(a.approvedAt).toLocaleDateString('en-ZA')}</p>)}{data&&!data.updates.length&&<p>No approved parent updates yet.</p>}</section>;
}
