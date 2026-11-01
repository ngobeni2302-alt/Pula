import React, {useState} from 'react';
import {ArrowLeft, ChevronRight, GraduationCap, Users} from 'lucide-react';
import {PLANS} from './dashboardData';
import './welcomeScreen.css';

const roles = [
  {id: 'Teacher', label: 'Teacher', description: 'Access your class, plan and learners.', Icon: GraduationCap},
  {id: 'HOD', label: 'Head of Department', description: 'Oversee grades, plans and progress.', Icon: Users},
  {id: 'Parent', label: 'Parent', description: 'Follow your child’s learning and updates.', Icon: Users}
];

export default function WelcomeScreen({classes, onSelect}) {
  const [role, setRole] = useState(null);
  const chooseRole = selected => {
    if (selected === 'HOD') onSelect({role: 'HOD'});
    else setRole(selected);
  };
  return (
    <main className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-brand" aria-label="Pula">
          <img src="/icon.png" alt="" width="106" height="132"/>
          <span>Pula</span>
        </div>
        <h1>{role ? `${role} sign in` : 'Welcome to Pula'}</h1>
        <p className="welcome-subtitle">{role ? (role === 'Teacher' ? 'Choose your classroom to continue.' : 'Choose your child to continue.') : 'Choose how you’d like to sign in.'}</p>
        {role ? (
          <section className="welcome-options" aria-label={`${role} demo profiles`}>
            <button className="welcome-back" onClick={() => setRole(null)}><ArrowLeft size={18}/> Back to sign-in options</button>
            {(role === 'Teacher' ? PLANS : classes).map(classroom => {
              const child = classroom.grade === '2' ? classroom.learners?.[8] : classroom.learners?.[0];
              return (
                <button className="welcome-option" key={classroom.grade} onClick={() => onSelect(role === 'Teacher' ? {role, grade: classroom.grade} : {role, grade: classroom.grade, childId: child.id})}>
                  <span className="welcome-icon">{role === 'Teacher' ? <GraduationCap/> : <Users/>}</span>
                  <span className="welcome-copy"><strong>{role === 'Teacher' ? `Grade ${classroom.grade}` : `${child.name}’s parent`}</strong><span>{classroom.teacher} · Grade {classroom.room}</span></span>
                  <ChevronRight className="welcome-chevron" aria-hidden="true"/>
                </button>
              );
            })}
            <p className="welcome-demo-note">Demo profiles on this device. Account sign-in is not connected yet.</p>
          </section>
        ) : (
          <section className="welcome-options" aria-label="Sign-in options">
            {roles.map(({id, label, description, Icon}) => (
              <button className="welcome-option" key={id} onClick={() => chooseRole(id)}>
                <span className="welcome-icon"><Icon aria-hidden="true"/></span>
                <span className="welcome-copy"><strong>{label}</strong><span>{description}</span></span>
                <ChevronRight className="welcome-chevron" aria-hidden="true"/>
              </button>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
