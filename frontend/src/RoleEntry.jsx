import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, GraduationCap, Users } from 'lucide-react';
import TeacherApp from '../../teacher/App.jsx';
import './roleEntry.css';

const roles = [
  { id: 'teacher', label: 'Teacher', description: 'Your classroom, learners and reading activities.', Icon: BookOpen },
  { id: 'parent', label: 'Parent', description: 'Your child’s learning journey.', Icon: Users },
  { id: 'hod', label: 'HOD', description: 'Your department and classroom overview.', Icon: GraduationCap }
];

export default function RoleEntry() {
  const [role, setRole] = useState(null);
  const selected = roles.find(item => item.id === role);

  if (role === 'teacher') {
    return (
      <>
        <div className="role-switch-bar">
          <button type="button" onClick={() => setRole(null)}>
            <ArrowLeft size={16} aria-hidden="true" /> Switch role
          </button>
          <span>Teacher</span>
        </div>
        <TeacherApp />
      </>
    );
  }

  return (
    <div className="app role-entry">
      <main className="role-entry-main">
        <div className="role-brand"><img src="/icon.png" alt="" /> Pula</div>
        {selected ? (
          <>
            <div className="role-emblem"><selected.Icon size={36} aria-hidden="true" /></div>
            <h1>{selected.label} Dashboard</h1>
            <p>This space is coming in a future phase. Only the Teacher application is available for now.</p>
            <button className="button" type="button" onClick={() => setRole(null)}>
              <ArrowLeft size={18} aria-hidden="true" /> Back to role selection
            </button>
          </>
        ) : (
          <>
            <span className="role-eyebrow">A little support. A world of learning.</span>
            <h1>Welcome to Pula</h1>
            <p>Choose your role to continue.</p>
            <div className="role-options">
              {roles.map(({ id, label, description, Icon }) => (
                <button className="role-option" key={id} type="button" onClick={() => setRole(id)}>
                  <span className="role-icon"><Icon size={25} aria-hidden="true" /></span>
                  <span className="role-copy"><strong>Continue as {label}</strong><span>{description}</span>{id !== 'teacher' && <small>Coming soon</small>}</span>
                  <ArrowRight size={19} aria-hidden="true" />
                </button>
              ))}
            </div>
            <p className="role-footnote">Role selection only. Account sign-in is not available yet.</p>
          </>
        )}
      </main>
    </div>
  );
}
