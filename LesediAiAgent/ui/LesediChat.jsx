/**
 * LesediChat.jsx
 * Lesedi AI chat panel — drop this into any teacher or HOD dashboard.
 *
 * Usage:
 *   <LesediChat grade="2" term={4} learner={learnerObject} />
 *
 * All requests go to http://localhost:4000/api/lesedi (port 4000).
 * In production set VITE_API_BASE (or equivalent) to the deployed backend URL.
 */

import React, { useState, useRef, useEffect } from 'react';
import './LesediChat.css';

const API_BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE
  ? import.meta.env.VITE_API_BASE
  : 'http://localhost:4000';

const TASK_LABELS = {
  teacher_activity:  '📋 Activity',
  gap_explanation:   '📊 Gap analysis',
  parent_note:       '✉️ Parent note',
  child_hint:        '💡 Child hint',
  guardrail:         '🛡️ Policy',
};

const QUICK_TASKS = [
  { label: '📋 Draft an activity',       task: 'teacher_activity' },
  { label: '📊 Explain this group',      task: 'gap_explanation'  },
  { label: '✉️ Draft a parent note',     task: 'parent_note'      },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function LesediChat({ grade = '2', term = 4, learner = null, channel = 'WhatsApp' }) {
  const [messages, setMessages]   = useState([welcomeMessage()]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [activeTask, setActiveTask] = useState('teacher_activity');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function welcomeMessage() {
    return {
      id:     'welcome',
      role:   'lesedi',
      text:   `Hi! I'm Lesedi, your CAPS-aligned teaching assistant for Grade ${grade}, Term ${term}. Select a task below or type your request.`,
      tags:   [],
      source: 'system',
    };
  }

  async function sendMessage(overrideText, overrideTask) {
    const text = (overrideText ?? input).trim();
    if (!text && !overrideTask) return;

    const userMsg = { id: Date.now(), role: 'user', text: text || `[${TASK_LABELS[overrideTask ?? activeTask]}]` };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const body = buildRequestBody(overrideTask ?? activeTask, text, grade, term, learner, channel);
      const res  = await fetch(`${API_BASE}/api/lesedi`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      const data = await res.json();

      const lesediMsg = {
        id:               Date.now() + 1,
        role:             'lesedi',
        text:             data.text ?? data.error ?? 'Something went wrong.',
        tags:             data.tags ?? [],
        source:           data.source ?? 'unknown',
        requiresApproval: data.requiresApproval ?? false,
        handoff:          data.handoff ?? false,
      };
      setMessages(prev => [...prev, lesediMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'lesedi',
        text: `Error reaching the Lesedi service at port 4000. (${err.message})`,
        tags: ['connection_error'], source: 'error',
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return (
    <div className="lesedi-chat" role="region" aria-label="Lesedi AI assistant">

      {/* Header */}
      <div className="lesedi-header">
        <span className="lesedi-logo" aria-hidden="true">🌟</span>
        <div>
          <strong>Lesedi</strong>
          <span className="lesedi-subtitle">Grade {grade} · Term {term}{learner ? ` · ${learner.firstName}` : ''}</span>
        </div>
        <span className="lesedi-badge">CAPS-aligned</span>
      </div>

      {/* Task selector */}
      <div className="lesedi-tasks" role="group" aria-label="Task type">
        {QUICK_TASKS.map(qt => (
          <button
            key={qt.task}
            className={`lesedi-task-btn${activeTask === qt.task ? ' active' : ''}`}
            onClick={() => { setActiveTask(qt.task); sendMessage('', qt.task); }}
            aria-pressed={activeTask === qt.task}
          >
            {qt.label}
          </button>
        ))}
      </div>

      {/* Message list */}
      <div className="lesedi-messages" aria-live="polite" aria-atomic="false">
        {messages.map(msg => (
          <div key={msg.id} className={`lesedi-msg lesedi-msg--${msg.role}`}>
            <p className="lesedi-msg-text">{msg.text}</p>

            {msg.requiresApproval && (
              <div className="lesedi-approval-banner" role="note">
                ⚠️ Draft — requires teacher and HOD approval before use.
              </div>
            )}

            {msg.handoff && (
              <div className="lesedi-handoff-banner" role="alert">
                🤝 Handing off to the teacher — the child needs you now.
              </div>
            )}

            {msg.tags?.length > 0 && (
              <ul className="lesedi-tags" aria-label="Response tags">
                {msg.tags.map(t => <li key={t} className="lesedi-tag">{t}</li>)}
              </ul>
            )}
          </div>
        ))}

        {loading && (
          <div className="lesedi-msg lesedi-msg--lesedi lesedi-loading" aria-busy="true">
            <span className="lesedi-dots"><span /><span /><span /></span>
            <span className="sr-only">Lesedi is thinking…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="lesedi-input-row">
        <label htmlFor="lesedi-input" className="sr-only">Message Lesedi</label>
        <textarea
          id="lesedi-input"
          className="lesedi-input"
          rows={2}
          placeholder="Type your request or question… (Enter to send)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
          aria-disabled={loading}
        />
        <button
          className="lesedi-send-btn"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          aria-label="Send message to Lesedi"
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build the request body for each task type
// ---------------------------------------------------------------------------
function buildRequestBody(task, requestText, grade, term, learner, channel) {
  const base = { task, grade, term, language: learner?.language ?? 'English' };

  if (learner) {
    base.learner = {
      ref:          learner.id,
      firstName:    learner.firstName ?? learner.name,
      group:        learner.group,
      consent:      learner.consent,
      termProgress: learner.termProgress ?? [],
      observations: learner.observations ?? [],
      checkInNote:  learner.checkInNote ?? null,
    };
    base.learnerId = learner.id;
  }

  switch (task) {
    case 'teacher_activity':
      return { ...base, focus: requestText || 'reading and phonics', minutes: 15, requestText };

    case 'gap_explanation':
      return { ...base, weeks: 4, requestText, observations: learner?.observations ?? [] };

    case 'parent_note':
      return { ...base, channel: channel ?? learner?.channel ?? 'WhatsApp', maxChars: channel === 'SMS' ? 160 : null, requestText };

    case 'child_hint':
      return { ...base, hintLevel: 1, event: 'no_response', target: requestText || 'current skill' };

    case 'guardrail':
    default:
      return { ...base, requestText };
  }
}
