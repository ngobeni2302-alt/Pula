import React,{useState} from 'react';
import {ArrowLeft,ChevronRight,GraduationCap,Users} from 'lucide-react';
import './welcomeScreen.css';
export default function WelcomeScreen({classes,onSelect}){
  const [role,setRole]=useState(null);
  return <main className="welcome-screen"><div className="welcome-content">
    {role?<><button className="welcome-back" onClick={()=>setRole(null)}><ArrowLeft size={20}/> Back</button><img className="welcome-mini-lesedi" src="/lesedi.png" alt="Lesedi"/><h1>{role==='Teacher'?'Your classroom':'Your child'}</h1><p className="welcome-subtitle">{role==='Teacher'?'Choose your grade. Let’s help every learner grow.':'A little encouragement. A little progress. Every day.'}</p><section className="welcome-options welcome-profiles" aria-label="Choose a profile">{classes.map(c=>{const child=c.grade==='2'?c.learners[8]:c.learners[0];return <button className="welcome-option" key={c.grade} onClick={()=>onSelect(role==='Teacher'?{role,grade:c.grade}:{role,grade:c.grade,childId:child.id})}><span className="welcome-icon">{role==='Teacher'?<GraduationCap/>:<Users/>}</span><span className="welcome-copy"><strong>{role==='Teacher'?`Grade ${c.grade}`:`${child.name}’s parent`}</strong><span>{c.teacher} · {c.room}</span></span><ChevronRight/></button>;})}</section></>:<>
      <img className="welcome-illustration" src="/pula-welcome.png" alt="Lesedi and a friend, ready to read, speak and grow"/>
      <h1 className="welcome-wordmark">Pula</h1><p className="welcome-tagline">read. speak. grow.</p>
      <p className="welcome-subtitle">Teacher Copilot for Foundation Phase, Grades R to 3. Lesedi listens, the teacher decides.</p>
      <section className="welcome-options" aria-label="Choose your role"><button className="welcome-role welcome-teacher" onClick={()=>setRole('Teacher')}>I’m a teacher</button><button className="welcome-role welcome-parent" onClick={()=>setRole('Parent')}>I’m a parent</button><button className="welcome-role welcome-hod" onClick={()=>onSelect({role:'HOD'})}>Head of Department</button></section>
      <div className="welcome-footer"><div className="welcome-dots" aria-hidden="true"><i/><i/><i/><i/></div><small>No consent, no recording. Every child grows at their own pace.</small></div>
    </>}
  </div></main>;
}
