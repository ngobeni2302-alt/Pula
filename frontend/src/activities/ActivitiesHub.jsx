import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,Mic,Volume2,RotateCcw} from 'lucide-react';
import {coreApi,useCore} from '../core/CoreContext.jsx';
import useVoiceCapture from './useVoiceCapture.jsx';
import './activities.css';
import './coreActivities.css';
const ICONS={'reading-time':'📖','number-hunt':'7','count-and-pick':'🐘 🐘','rhyme-time':'cat · hat','sound-it-out':'v · a · n'};
export function LesediFeedback({children,celebrate=false}) {
  return <div className={`game-lesedi ${celebrate?'celebrate':''}`}><span className="game-mascot"><img src="/lesedi.png" alt="Lesedi"/></span><p>{children}</p></div>;
}
function say(text) {if('speechSynthesis' in window){window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-ZA';u.rate=.8;window.speechSynthesis.speak(u);}}
const newRound=()=>({choices:[],letters:[]});
export default function ActivitiesHub({classroom,subject='English',onBack}) {
  const {workspace,refresh,reload}=useCore(),[view,setView]=useState('setup'),[selectedClass,setSelectedClass]=useState(''),[learnerId,setLearnerId]=useState(''),[activityId,setActivityId]=useState(null),[session,setSession]=useState(null),[round,setRound]=useState(0),[evidence,setEvidence]=useState([]),[feedback,setFeedback]=useState('Take your time. I will play with you!'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[transcript,setTranscript]=useState(''),[speechDisclosure,setSpeechDisclosure]=useState(false),[revealed,setRevealed]=useState(false),[interaction,setInteraction]=useState(0),[permissionOpen,setPermissionOpen]=useState(false),[guardianConfirmed,setGuardianConfirmed]=useState(false),[permissionError,setPermissionError]=useState('');
  const advancing=useRef(false),started=useRef(0),roundData=useRef(newRound()),transcriptRef=useRef('');
  const voice=useVoiceCapture((final)=>{transcriptRef.current=final;setTranscript(final);});
  const listening=voice.status==='recording';
  const maths=subject==='Maths'||subject==='Mathematics', classes=workspace?.classes||[];
  const c=classes.find(c=>c.id===selectedClass)||classes.find(c=>c.grade===classroom?.grade)||classes[0];
  const learner=c?.learners.find(l=>l.id===learnerId)||c?.learners[0];
  const catalog=(workspace?.catalog||[]).filter(a=>maths?a.subject==='Mathematics':a.subject==='English');
  useEffect(()=>()=>{window.speechSynthesis?.cancel();},[]);
  useEffect(()=>{setLearnerId('');},[selectedClass]);
  const stopSpeech=()=>voice.stop();
  async function start(id) {
    if(!learner||!c)return;setBusy(true);setError('');
    try {
      let s;
      if(learner.consent) s=await coreApi('/assignments',{learnerId:learner.id,activityId:id,requestId:crypto.randomUUID()});
      else {const a=await coreApi(`/catalog?grade=${encodeURIComponent(c.grade)}`);s={practice:true,learner:{name:learner.name},activity:a.find(a=>a.id===id),voiceConsent:false};}
      if(!s.activity)throw Error('Select the activity again to launch a new session.');
      await voice.reset();setSession(s);setActivityId(id);setEvidence([]);roundData.current=newRound();setRound(0);setTranscript('');transcriptRef.current='';setSpeechDisclosure(false);setRevealed(false);started.current=performance.now();setFeedback(id==='number-hunt'?'Can you find it? Take your time.':id==='sound-it-out'?'Tap the first letter. What sound does it make?':id==='reading-time'?'Tap the microphone when you’re ready.':'Take your time. I will play with you!');setView('play');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function listen() {
    if(listening){await voice.stop();return;}
    if(!session.voiceConsent||!speechDisclosure){setGuardianConfirmed(session.voiceConsent===true);setPermissionError('');setPermissionOpen(true);return;}
    window.speechSynthesis?.cancel();await voice.start();
  }
  async function enableVoice() {
    if(!guardianConfirmed)return;
    setPermissionError('');
    try {
      let s=session;
      if(!session.voiceConsent){
        await coreApi(`/learners/${learner.id}/voice-consent`,{confirmed:true,analysisConfirmed:session.practice===true});
        if(session.practice)s=await coreApi('/assignments',{learnerId:learner.id,activityId,requestId:crypto.randomUUID()});
        setSession({...s,voiceConsent:true});await reload();
      }
      setSpeechDisclosure(true);setPermissionOpen(false);window.speechSynthesis?.cancel();await voice.start();
    }catch(e){setPermissionError(e.message);}
  }
  async function finish(results) {
    setBusy(true);setError('');
    try {
      const captured=await voice.stop();
      if(session.practice)setFeedback(`You did it, ${session.learner.name}! Lesedi loved playing with you.`);
      else {const result=await coreApi(`/assignments/${session.id}/complete`,{childToken:session.childToken,rounds:results,speech_transcript:captured.transcript,speech_duration_seconds:captured.seconds,recording_captured:captured.recordingCaptured,time_taken_seconds:(performance.now()-started.current)/1000});setFeedback(result.lesedi_avatar_output.speech_text);refresh();}
      voice.discardAudio();setTranscript('');transcriptRef.current='';setView('celebration');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function next() {
    if(advancing.current)return;advancing.current=true;setBusy(true);
    try {
      await stopSpeech();const updated=[...evidence,structuredClone(roundData.current)];
      if(round===session.activity.rounds.length-1){await finish(updated);return;}
      setEvidence(updated);roundData.current=newRound();setRound(n=>n+1);setRevealed(false);setFeedback('You are doing great. Let’s try the next one!');
    }finally{advancing.current=false;setBusy(false);}
  }
  async function resetRound() {await voice.reset();if(activityId==='reading-time')started.current=performance.now();setTranscript('');transcriptRef.current='';setFeedback('Let’s have another go. Take your time.');}
  const r=session?.activity.rounds[round],selected=roundData.current.choices.at(-1);
  const canNext=activityId==='reading-time'||activityId==='sound-it-out'?activityId==='reading-time'||new Set(roundData.current.letters).size===r?.target.length:roundData.current.choices.length>0;
  async function teacherReturn(action) {await voice.reset();action();}
  if(view==='celebration')return <main className="act-shell core-game game-celebration"><div className="game-confetti" aria-hidden="true">✦ ✿ ✦</div><h1>You did it, {session.learner.name}!</h1><LesediFeedback celebrate>{feedback}</LesediFeedback><p>Lesedi loved playing with you.</p><button className="game-primary" onClick={()=>teacherReturn(()=>setView('setup'))}>Play another game</button>{activityId==='reading-time'&&<button onClick={()=>teacherReturn(()=>{setLearnerId(c.learners[(c.learners.findIndex(l=>l.id===learner?.id)+1)%c.learners.length].id);setView('setup');})}>Next friend</button>}<button onClick={()=>teacherReturn(onBack)}>{activityId==='reading-time'?'Back to class':'I am finished'}</button></main>;
  return <main className="act-shell core-game"><header className="game-header"><button aria-label="Back to class" onClick={()=>{if(view==='play')teacherReturn(onBack);else onBack();}}><ArrowLeft/></button><h1>{view==='setup'?'What shall we play?':session.activity.name}</h1>{view==='play'&&<small>{round+1} / {session.activity.rounds.length}</small>}</header>
    {view==='setup'?<>{!workspace?<p>Select a teacher profile to choose your class.</p>:workspace.account.role!=='teacher'?<p>Your teacher launches your assigned activity.</p>:<>
      <details className="game-teacher-setup"><summary>{learner?.name} · Grade {c?.grade}<span>Change learner</span></summary><label>Class and grade<select value={c?.id||''} onChange={e=>setSelectedClass(e.target.value)}>{classes.map(c=><option key={c.id} value={c.id}>{c.name} · Grade {c.grade}</option>)}</select></label><label>Learner<select value={learner?.id||''} onChange={e=>setLearnerId(e.target.value)}>{c?.learners.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><small>{learner?.consent?'Teacher launches one assigned game at a time.':'Analysis consent absent: unrecorded practice only. No microphone, transcript or assessment will be saved.'}</small></details>
      <LesediFeedback>Pick a game. I will play with you!</LesediFeedback><div className="game-cards">{catalog.map((a,i)=><button className={`game-card game-${a.id}`} key={a.id} disabled={busy||!learner} onClick={()=>start(a.id)}><span aria-hidden="true">{ICONS[a.id]}</span><b>{a.name}</b></button>)}</div>
      <p className="game-footnote">{maths?'Number Hunt and Count and Pick':'Rhyme Time, Sound It Out and Reading Time'} · Change English / Maths on class home.</p>
    </>}</>:<>
      <section className="game-stage">
        {activityId==='number-hunt'&&<><h2>Find this number</h2><div className="game-number">{r.target}</div></>}
        {activityId==='count-and-pick'&&<><h2>{r.target}</h2><div className="game-objects">{Array.from({length:r.count},(_,i)=><span key={i} aria-label={r.target.replace('Count the ','')}>{r.picture}</span>)}</div></>}
        {activityId==='rhyme-time'&&<><h2>What rhymes with…</h2><div className="game-picture">{r.picture}</div><h2 className="game-word">{r.target}</h2><button onClick={async()=>{await stopSpeech();say(r.target);}}><Volume2 size={20}/> Hear it</button></>}
        {activityId==='sound-it-out'&&<><h2>Tap each letter. Blend the sounds.</h2><div className="game-letters">{[...r.target].map((l,i)=><button key={i} aria-label={`Explore letter ${l}`} aria-pressed={roundData.current.letters.includes(i)} onClick={()=>{roundData.current.letters.push(i);setInteraction(n=>n+1);if(workspace.phonicsAudioConfigured)new Audio(`/phonics/en-ZA/${l}.mp3`).play().catch(()=>setFeedback('Ask your teacher to model this sound.'));setFeedback('Ask your teacher to model the sound. Now try blending.');}}>{l}</button>)}</div><div className="game-blend" aria-hidden="true">⟶</div><button disabled={new Set(roundData.current.letters).size!==r.target.length} onClick={async()=>{await stopSpeech();setRevealed(true);say(r.target);}}>Blend the word · Hear it</button><div className="game-picture">{revealed?r.picture:'?'}</div>{!workspace.phonicsAudioConfigured&&<small>Teacher models English phonemes. Verified phonics audio is not configured; word playback is browser speech.</small>}</>}
        {activityId==='reading-time'&&<><h2>{session.learner.name}’s turn</h2><p className="game-passage">{r.target}</p></>}
      </section>
      {r.options&&<div className={`game-options ${activityId==='number-hunt'?'numbers':''}`}>{r.options.map(option=><button key={option} aria-pressed={selected===option} onClick={()=>{roundData.current.choices.push(option);setInteraction(n=>n+1);setFeedback('Thank you for trying! You can choose again or keep going.');}}>{option}</button>)}</div>}
      <LesediFeedback>{listening?'Listening…':feedback}</LesediFeedback>
      <div className="game-voice-controls">
        <button className={`game-mic-button ${listening?'is-listening':''}`} aria-pressed={listening} disabled={busy||voice.status==='requesting'||voice.status==='stopping'} onClick={listen}><Mic size={24}/>{voice.status==='requesting'?'Allow microphone…':voice.status==='stopping'?'Finishing recording…':listening?'Stop recording':activityId==='reading-time'?'Start reading':activityId==='sound-it-out'?'Say the word':activityId==='rhyme-time'?'Say the rhyme':'Say it out loud'}</button>
        <div className="game-recording-status" role="status" aria-live="polite">{listening?<><span className="game-recording-dot"/>Lesedi is listening · {Math.floor(voice.seconds/60)}:{String(Math.floor(voice.seconds%60)).padStart(2,'0')}</>:voice.seconds>0?'Your voice was captured. You can listen back or try again.':'Tap the microphone. Take your time.'}</div>
        {voice.audioUrl&&<audio className="game-voice-playback" controls controlsList="nodownload" src={voice.audioUrl} aria-label="Listen back to this recording"/>}
        {voice.notice&&<p className="game-mic-notice" role="alert">{voice.notice}</p>}
      </div>
      {permissionOpen&&<div className="game-mic-backdrop"><section className="game-mic-dialog" role="dialog" aria-modal="true" aria-labelledby="mic-permission-title"><h2 id="mic-permission-title">Ready to use the microphone?</h2><p>Teacher: confirm guardian permission before your learner begins. Browser speech recognition may send voice to its speech provider. Pula keeps audio only in memory and discards it after this activity.</p><label><input type="checkbox" checked={guardianConfirmed} onChange={e=>setGuardianConfirmed(e.target.checked)}/>{session.practice?'Guardian permission for this activity and microphone use is recorded.':'Guardian permission for microphone use is recorded.'}</label>{permissionError&&<p role="alert">{permissionError}</p>}<button className="game-primary" disabled={!guardianConfirmed} onClick={enableVoice}>Start microphone</button><button onClick={()=>setPermissionOpen(false)}>Continue without microphone</button></section></div>}
      <div className="game-actions"><button disabled={busy} onClick={resetRound}><RotateCcw size={18}/>Start again</button><button className="game-primary" disabled={!canNext||busy||voice.status==='requesting'||voice.status==='stopping'} onClick={next}>{busy?'One moment…':round===session.activity.rounds.length-1?"I'm done":'Next'}</button></div>
      {error&&<p role="alert">Your activity is still open. Your teacher can retry finishing it.</p>}
    </>}
    {view==='setup'&&error&&<p role="alert">{error}</p>}
  </main>;
}
