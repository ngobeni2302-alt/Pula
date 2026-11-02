// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, X, BookOpen, Lock, Check, ArrowRight, RefreshCcw, Sparkles } from 'lucide-react';
import { READING_TASKS, AVATAR_PALETTE, PREFERRED_ORDER } from './readingTasks.js';
import './readingExperience.css';

export default function TeacherReadingExperience({ classroom, onBack, onSaveSession }) {
  const [screen, setScreen] = useState('choose'); // 'choose' | 'reading' | 'celebration'
  const [currentTask, setCurrentTask] = useState(READING_TASKS[0]);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  // Learners list: prioritize reference names
  const rawLearners = classroom?.learners || [];
  const learners = [...rawLearners].sort((a, b) => {
    const idxA = PREFERRED_ORDER.indexOf(a.name);
    const idxB = PREFERRED_ORDER.indexOf(b.name);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  // Track completed learners (from classroom.assessedIds or session state)
  const [completedIds, setCompletedIds] = useState(() => {
    const existing = classroom?.assessedIds || [];
    // If Grade 2 default, seed with Lerato and Kabelo if not already present
    if (existing.length === 0 && classroom?.grade === '2') {
      const lerato = learners.find(l => l.name === 'Lerato');
      const kabelo = learners.find(l => l.name === 'Kabelo');
      return [lerato?.id, kabelo?.id].filter(Boolean);
    }
    return existing;
  });

  // Selected learner (default to first eligible learner with consent)
  const firstEligible = learners.find(l => l.consent !== false && l.name !== 'Palesa') || learners[0];
  const [selectedId, setSelectedId] = useState(firstEligible?.id || null);
  const [consentError, setConsentError] = useState('');

  const selectedLearner = learners.find(l => l.id === selectedId) || null;
  const hasConsent = selectedLearner && selectedLearner.consent !== false && selectedLearner.name !== 'Palesa';

  // Audio recording & session state
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopAudioCapture();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Timer loop when recording
  useEffect(() => {
    if (screen === 'reading' && isRecording) {
      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [screen, isRecording]);

  const startAudioCapture = async () => {
    setIsRecording(true);
    setSeconds(0);
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        if (typeof MediaRecorder !== 'undefined') {
          const rec = new MediaRecorder(stream);
          mediaRecorderRef.current = rec;
          rec.start();
        }
      }
    } catch {
      // Graceful fallback to timer-based simulation without throwing
    }
  };

  const stopAudioCapture = () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
    } catch {
      // Ignore cleanup errors
    }
  };

  const handleSelectLearner = (l) => {
    setSelectedId(l.id);
    if (l.consent === false || l.name === 'Palesa') {
      setConsentError('Parent consent is required before recording audio for this learner.');
    } else {
      setConsentError('');
    }
  };

  const handleStartSession = () => {
    if (!selectedLearner || !hasConsent) return;
    setScreen('reading');
    startAudioCapture();
  };

  const handleStartAgain = () => {
    stopAudioCapture();
    startAudioCapture();
  };

  const handleAttemptClose = () => {
    if (isRecording || seconds > 0) {
      setShowConfirmClose(true);
    } else {
      stopAudioCapture();
      setScreen('choose');
    }
  };

  const handleConfirmLeave = () => {
    stopAudioCapture();
    setShowConfirmClose(false);
    setScreen('choose');
  };

  const handleCompleteReading = () => {
    stopAudioCapture();
    const duration = Math.max(1, seconds);
    const wordCount = currentTask.passageText.split(/\s+/).length;
    const estimatedWpm = Math.max(15, Math.round((wordCount / Math.max(duration, 8)) * 60));

    // Mark learner completed
    if (selectedId && !completedIds.includes(selectedId)) {
      setCompletedIds(prev => [...prev, selectedId]);
    }

    if (onSaveSession && selectedId) {
      onSaveSession(selectedId, {
        wpm: estimatedWpm,
        duration,
        taskTitle: currentTask.title
      });
    }

    setScreen('celebration');
  };

  const handleNextFriend = () => {
    // Find next uncompleted learner with consent
    const nextFriend = learners.find(l =>
      !completedIds.includes(l.id) &&
      l.id !== selectedId &&
      l.consent !== false &&
      l.name !== 'Palesa'
    ) || learners.find(l => l.consent !== false && l.name !== 'Palesa');

    if (nextFriend) {
      setSelectedId(nextFriend.id);
      setConsentError('');
    }
    setScreen('choose');
  };

  // ==========================================
  // RENDER SCREEN 1: WHO'S READING?
  // ==========================================
  if (screen === 'choose') {
    return (
      <div className="re-container">
        {/* Header */}
        <header className="re-header">
          <button className="re-back-btn" onClick={onBack} aria-label="Back to class">
            <ChevronLeft size={24} />
          </button>
          <h1 className="re-title">Who's reading?</h1>
        </header>

        {/* Reading Task Card */}
        <section className="re-task-card" aria-label="Current reading task">
          <div className="re-task-icon">
            <BookOpen size={22} aria-hidden="true" />
          </div>
          <div className="re-task-info">
            <span className="re-task-label">Reading task</span>
            <strong className="re-task-title">{currentTask.title}</strong>
          </div>
          <button
            className="re-task-change-btn"
            onClick={() => setShowTaskPicker(true)}
            aria-label="Change reading task"
          >
            Change
          </button>
        </section>

        {/* Learner Grid */}
        <div className="re-learner-grid" role="list" aria-label="Class learners">
          {learners.map((l, index) => {
            const isSelected = selectedId === l.id;
            const isCompleted = completedIds.includes(l.id);
            const needsConsent = l.consent === false || l.name === 'Palesa';
            const color = AVATAR_PALETTE[index % AVATAR_PALETTE.length];

            return (
              <button
                key={l.id}
                role="listitem"
                className={`re-learner-card ${isSelected ? 'selected' : ''} ${needsConsent ? 'locked' : ''}`}
                onClick={() => handleSelectLearner(l)}
                aria-pressed={isSelected}
                aria-label={`${l.name}${needsConsent ? ' (Needs parent consent)' : isCompleted ? ' (Completed)' : ''}`}
              >
                <div className="re-avatar-wrap">
                  <div
                    className="re-avatar"
                    style={{
                      background: needsConsent ? '#E6DFD4' : color.bg,
                      color: needsConsent ? '#5C5549' : color.color
                    }}
                  >
                    {needsConsent ? <Lock size={18} aria-hidden="true" /> : l.name[0]}
                  </div>
                  {isCompleted && !needsConsent && (
                    <span className="re-completed-badge" aria-label="Completed">
                      <Check size={11} strokeWidth={3.5} aria-hidden="true" />
                    </span>
                  )}
                </div>
                <b className="re-learner-name">{l.name}</b>
                {needsConsent && <small className="re-needs-consent">Needs consent</small>}
              </button>
            );
          })}
        </div>

        {/* Fixed Bottom Action Button */}
        <div className="re-sticky-footer">
          <button
            className="re-primary-btn"
            style={{ color: '#ffffff', backgroundColor: '#101438' }}
            disabled={!selectedLearner || !hasConsent}
            onClick={handleStartSession}
          >
            <span style={{ color: '#ffffff', fontWeight: 800 }}>
              Hand the phone to {selectedLearner?.name || 'learner'}
            </span>
            <ArrowRight size={18} color="#ffffff" aria-hidden="true" />
          </button>
          {consentError && <p className="re-consent-notice" role="alert">{consentError}</p>}
        </div>

        {/* Task Picker Modal */}
        {showTaskPicker && (
          <div className="re-modal-overlay" role="dialog" aria-modal="true" aria-label="Choose a reading task">
            <div className="re-modal">
              <div className="re-modal-header">
                <h3>Choose a reading task</h3>
                <button
                  className="re-close-btn"
                  style={{ color: '#101438', background: '#f0ecdf' }}
                  onClick={() => setShowTaskPicker(false)}
                  aria-label="Close task picker"
                >
                  <X size={18} color="#101438" />
                </button>
              </div>
              <div className="re-modal-list">
                {READING_TASKS.map(t => (
                  <button
                    key={t.id}
                    className={`re-modal-item ${currentTask.id === t.id ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentTask(t);
                      setShowTaskPicker(false);
                    }}
                  >
                    <span className="re-modal-item-badge">{t.badge}</span>
                    <b>{t.title}</b>
                    <p>{t.passageText}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER SCREEN 2: INTERACTIVE READING SESSION
  // ==========================================
  if (screen === 'reading') {
    return (
      <div className="re-session-screen">
        {/* Header */}
        <header className="re-session-header">
          <h2 className="re-session-title">{selectedLearner?.name || 'Learner'}'s turn</h2>
          <button
            className="re-close-btn"
            style={{ color: '#ffffff', background: 'rgba(255, 255, 255, 0.08)' }}
            onClick={handleAttemptClose}
            aria-label="Close reading session"
          >
            <X size={20} color="#ffffff" />
          </button>
        </header>

        {/* Cream Reading Passage Card */}
        <section className="re-passage-card" aria-label="Reading passage">
          {currentTask.passageLines.map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </section>

        {/* Interactive Listening Orbit */}
        <div className="re-listening-area">
          <div className={`re-orbit ${isRecording ? 'is-pulsing' : ''}`} aria-hidden="true">
            <span className="re-sparkle re-sparkle-1" />
            <span className="re-sparkle re-sparkle-2" />
            <span className="re-sparkle re-sparkle-3" />
            <span className="re-sparkle re-sparkle-4" />
            <div className="re-orbit-inner-disc" />
          </div>

          {/* Speech Bubble Pill */}
          <div className="re-speech-pill" role="status">
            <span>Take your time. I'm listening.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="re-session-actions">
          <button
            className="re-btn-again"
            style={{ color: '#ffffff' }}
            onClick={handleStartAgain}
          >
            <RefreshCcw size={15} color="#ffffff" aria-hidden="true" />
            <span style={{ color: '#ffffff', fontWeight: 800 }}>Start again</span>
          </button>
          <button
            className="re-btn-done"
            style={{ color: '#ffffff', backgroundColor: '#FF6B4A' }}
            onClick={handleCompleteReading}
          >
            <Check size={17} color="#ffffff" aria-hidden="true" />
            <span style={{ color: '#ffffff', fontWeight: 800 }}>I'm done</span>
          </button>
        </div>

        {/* Confirmation Modal */}
        {showConfirmClose && (
          <div className="re-modal-overlay" role="dialog" aria-modal="true" aria-label="Leave reading session">
            <div className="re-modal re-confirm-modal">
              <h3>Leave this reading session?</h3>
              <p>Your current reading audio and progress for {selectedLearner?.name} will not be saved.</p>
              <div className="re-confirm-actions">
                <button
                  className="re-confirm-keep-btn"
                  style={{ color: '#ffffff', backgroundColor: '#101438' }}
                  onClick={() => setShowConfirmClose(false)}
                >
                  <span style={{ color: '#ffffff', fontWeight: 800 }}>Continue reading</span>
                </button>
                <button
                  className="re-confirm-leave-btn"
                  style={{ color: '#d84528', borderColor: '#d84528' }}
                  onClick={handleConfirmLeave}
                >
                  <span style={{ color: '#d84528', fontWeight: 800 }}>Leave session</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER SCREEN 3: CELEBRATION
  // ==========================================
  if (screen === 'celebration') {
    return (
      <div className="re-celebration-screen">
        {/* Celebration Visual Orbit with Stars & Confetti */}
        <div className="re-celebrate-visual" aria-hidden="true">
          <div className="re-celebrate-circle">
            <Sparkles size={58} color="#FF6B4A" />
          </div>
          {/* Floating Stars */}
          <span className="re-star re-star-white-top">★</span>
          <span className="re-star re-star-yellow-left">★</span>
          <span className="re-star re-star-yellow-right">★</span>

          {/* Floating Dots */}
          <span className="re-dot re-dot-yellow-top" />
          <span className="re-dot re-dot-pink-left" />
          <span className="re-dot re-dot-blue-right" />
          <span className="re-dot re-dot-white-bottom" />
          <span className="re-dot re-dot-white-top" />
        </div>

        {/* Celebration Typography */}
        <div>
          <h1 className="re-celebrate-title">
            You read it,<br />
            {selectedLearner?.name || 'Learner'}!
          </h1>
          <p className="re-celebrate-subtitle">
            Lesedi loved listening to you.
          </p>
        </div>

        {/* Actions */}
        <div className="re-celebrate-actions">
          <button
            className="re-btn-next-friend"
            style={{ color: '#ffffff', backgroundColor: '#101438' }}
            onClick={handleNextFriend}
          >
            <span style={{ color: '#ffffff', fontWeight: 800 }}>Next friend</span>
          </button>
          <button
            className="re-btn-back-class"
            style={{ color: '#101438', borderColor: '#101438' }}
            onClick={onBack}
          >
            <span style={{ color: '#101438', fontWeight: 800 }}>Back to class</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
