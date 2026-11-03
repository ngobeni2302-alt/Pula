import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  X,
  Check,
  Lock,
  Mic,
  Volume2,
  Sparkles,
  HelpCircle,
  ThumbsUp,
  RotateCcw,
  ChevronRight,
  Edit2,
  Shield,
  Layers,
  Shapes,
  Grid
} from 'lucide-react';
import {
  ENGLISH_ACTIVITIES,
  MATHS_ACTIVITIES,
  generateActivityLesediReview
} from './activitiesData.js';
import './activities.css';

// Sound effect / speech helper
function speakOrChime(text) {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.85;
      u.lang = 'en-ZA';
      window.speechSynthesis.speak(u);
      return;
    }
  } catch {}
}

export default function ActivitiesHub({
  classroom,
  subject = 'English', // 'English' | 'Maths' | 'Mathematics'
  onBack,
  onSaveAssessment
}) {
  const currentSubject = subject === 'Maths' ? 'Mathematics' : subject;
  const activities = currentSubject === 'Mathematics' ? MATHS_ACTIVITIES : ENGLISH_ACTIVITIES;

  // Navigation / View State: 'list' | 'select-learner' | 'play' | 'review' | 'celebration'
  const [view, setView] = useState('list');
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedLearner, setSelectedLearner] = useState(null);

  // Active Session & Results Tracking
  const [sessionData, setSessionData] = useState({
    total: 1,
    correct: 0,
    attempts: 1,
    hintsUsed: 0,
    isCorrect: false
  });

  // Lesedi Performance Review State
  const [review, setReview] = useState(null);
  const [editedReview, setEditedReview] = useState(null);
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [selectedTierChange, setSelectedTierChange] = useState(null);

  // Notice banner
  const [notice, setNotice] = useState('');

  // --------------------------------------------------------------------------
  // Interactive State for Activities
  // --------------------------------------------------------------------------

  // 1. Add Numbers (Number line)
  const [linePosition, setLinePosition] = useState(5);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [hopsTaken, setHopsTaken] = useState([]);

  // 2. Bead String
  const [slidBeads, setSlidBeads] = useState(new Set());

  // 3. Make a Ten
  const [frameCounters, setFrameCounters] = useState(8);
  const [trayCounters, setTrayCounters] = useState(5);

  // 4. Group of 5
  const [countedRows, setCountedRows] = useState(0);

  // 5. Talk & Turn
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [selectedPrompts, setSelectedPrompts] = useState(new Set());
  const [teacherNotes, setTeacherNotes] = useState('');
  const recordTimerRef = useRef(null);

  // 6. Sound Hunt
  const [huntStage, setHuntStage] = useState(1);
  const [huntSelectedItems, setHuntSelectedItems] = useState(new Set());

  // 7. Sound Sorter
  const [sorterRoundIndex, setSorterRoundIndex] = useState(0);
  const [sorterAnswers, setSorterAnswers] = useState([]);
  const [sorterFeedback, setSorterFeedback] = useState(null);

  // 8. Blend a Word
  const [blendWordIndex, setBlendWordIndex] = useState(0);
  const [speakingLetter, setSpeakingLetter] = useState(null);
  const [isBlended, setIsBlended] = useState(false);
  const [blendAttempts, setBlendAttempts] = useState(0);

  // Reset interactive sub-states when activity changes
  const resetActivityStates = (act) => {
    if (!act) return;
    if (act.id === 'add-numbers') {
      setLinePosition(act.startNum || 5);
      setCurrentHintIndex(0);
      setHopsTaken([]);
    } else if (act.id === 'bead-string') {
      setSlidBeads(new Set());
    } else if (act.id === 'make-a-ten') {
      setFrameCounters(act.frameStart || 8);
      setTrayCounters(act.trayCount || 5);
    } else if (act.id === 'group-of-5') {
      setCountedRows(0);
    } else if (act.id === 'talk-and-turn') {
      setIsRecording(false);
      setRecordingSeconds(0);
      setSelectedPrompts(new Set());
      setTeacherNotes('');
    } else if (act.id === 'sound-hunt') {
      setHuntStage(1);
      setHuntSelectedItems(new Set());
    } else if (act.id === 'sound-sorter') {
      setSorterRoundIndex(0);
      setSorterAnswers([]);
      setSorterFeedback(null);
    } else if (act.id === 'blend-a-word') {
      setBlendWordIndex(0);
      setSpeakingLetter(null);
      setIsBlended(false);
      setBlendAttempts(0);
    }
  };

  // Timer effect for Talk & Turn recording
  useEffect(() => {
    if (isRecording) {
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(recordTimerRef.current);
    }
    return () => clearInterval(recordTimerRef.current);
  }, [isRecording]);

  // --------------------------------------------------------------------------
  // Navigation Handlers
  // --------------------------------------------------------------------------

  const handleSelectActivity = (act) => {
    setSelectedActivity(act);
    resetActivityStates(act);
    setView('select-learner');
  };

  const handleStartActivity = () => {
    if (!selectedLearner) return;
    resetActivityStates(selectedActivity);
    setView('play');
  };

  const handleFinishActivity = (finalSession) => {
    setSessionData(finalSession);
    const genReview = generateActivityLesediReview({
      activity: selectedActivity,
      learner: selectedLearner,
      sessionData: finalSession,
      subject: currentSubject
    });
    setReview(genReview);
    setEditedReview({ ...genReview });
    setSelectedTierChange(genReview.recommendedTier || null);
    setView('review');
  };

  // --------------------------------------------------------------------------
  // Teacher Decision Handlers (Approval / Rejection)
  // --------------------------------------------------------------------------

  const handleApproveAssessment = () => {
    const finalReview = editedReview || review;
    const assessmentRecord = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      learnerId: selectedLearner.id,
      learnerName: selectedLearner.name,
      teacherId: `teacher-${classroom?.grade || '2'}`,
      subject: currentSubject,
      activityName: selectedActivity.name,
      activityId: selectedActivity.id,
      academicYear: 2026,
      term: 4,
      date: new Date().toISOString().slice(0, 10),
      rawScore: sessionData.correct,
      maxScore: sessionData.total,
      percentage: Math.round((sessionData.correct / sessionData.total) * 100),
      finding: finalReview.finding,
      whyItMatters: finalReview.whyItMatters,
      whatToCheck: finalReview.whatToCheck,
      whatToDo: finalReview.whatToDo,
      confidence: finalReview.confidence,
      approvedTierChange: selectedTierChange,
      approvedBy: classroom?.teacher || 'Teacher',
      approvedAt: new Date().toISOString(),
      status: 'Approved'
    };

    onSaveAssessment && onSaveAssessment(assessmentRecord);
    setNotice(`Assessment approved for ${selectedLearner.name}. Academic record updated.`);
    setView('celebration');
  };

  const handleRejectDraft = () => {
    setNotice('Draft rejected. No changes were made to learner records.');
    setView('list');
  };

  const handleNextLearner = () => {
    setSelectedLearner(null);
    setView('select-learner');
  };

  const handleBackToActivities = () => {
    setSelectedActivity(null);
    setSelectedLearner(null);
    setView('list');
  };

  // --------------------------------------------------------------------------
  // RENDER 1: "What shall we play?" Home Screen (Page 1 of PDF)
  // --------------------------------------------------------------------------
  if (view === 'list') {
    return (
      <div className="act-shell" role="region" aria-label="Activities">
        {/* Top Header */}
        <div className="act-top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="act-lesedi-avatar" style={{ width: '40px', height: '40px' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <span className="act-subject-tag">{currentSubject} Activities</span>
              <h1>What shall we play?</h1>
            </div>
          </div>
          {onBack && (
            <button className="act-icon-btn" onClick={onBack} title="Back to Home" aria-label="Back to Home">
              <ArrowLeft size={18} />
            </button>
          )}
        </div>

        {notice && <div className="pd-note" role="status">{notice}</div>}

        {/* 4 Activity Cards based on Subject */}
        <div className="act-cards-list">
          {activities.map(act => (
            <button
              key={act.id}
              className="act-menu-card"
              onClick={() => handleSelectActivity(act)}
            >
              <div
                className="act-card-icon-box"
                style={{ background: act.iconColor }}
              >
                {act.id === 'add-numbers' && <span style={{ fontSize: '20px', fontWeight: 900 }}>+</span>}
                {act.id === 'bead-string' && <Layers size={24} />}
                {act.id === 'make-a-ten' && <Grid size={24} />}
                {act.id === 'group-of-5' && <span style={{ fontSize: '18px', fontWeight: 900 }}>5×</span>}
                {act.id === 'talk-and-turn' && <Mic size={24} />}
                {act.id === 'sound-hunt' && <span style={{ fontSize: '22px', fontWeight: 900 }}>S</span>}
                {act.id === 'sound-sorter' && <Shapes size={24} />}
                {act.id === 'blend-a-word' && <span style={{ fontSize: '16px', fontWeight: 900 }}>c·a·t</span>}
              </div>

              <div className="act-card-details">
                <span className="act-card-title">{act.name}</span>
                <span className="act-card-desc">{act.description}</span>
              </div>

              <ChevronRight size={18} style={{ color: '#8c8577' }} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER 2: "Who's playing?" Learner Selection Screen
  // --------------------------------------------------------------------------
  if (view === 'select-learner') {
    const learners = classroom?.learners || [];

    return (
      <div className="act-shell" role="region" aria-label="Select Learner">
        <div className="act-top-bar">
          <button className="act-icon-btn" onClick={() => setView('list')} aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1, textAlign: 'left', marginLeft: '6px' }}>
            <span className="act-selection-badge">Activity: {selectedActivity?.name}</span>
            <h1 style={{ marginTop: '4px' }}>Who’s playing?</h1>
          </div>
        </div>

        {/* 3-Column Responsive Grid */}
        <div className="act-learner-grid">
          {learners.map((l, index) => {
            const isSelected = selectedLearner?.id === l.id;
            const hasConsent = l.consent !== false;
            const isCompleted = (classroom?.assessedIds || []).includes(l.id);

            // Avatar colors: soft coral, yellow, pink, periwinkle, peach
            const avatarColors = ['#FF6B4A', '#FDD85D', '#F48FB1', '#8E9BFF', '#FFAB91'];
            const avatarColor = avatarColors[index % avatarColors.length];

            return (
              <button
                key={l.id}
                type="button"
                className={`act-learner-cell ${isSelected ? 'selected' : ''}`}
                onClick={() => hasConsent && setSelectedLearner(l)}
                disabled={!hasConsent}
                title={!hasConsent ? 'Recording consent required' : `Select ${l.name}`}
              >
                <div
                  className="act-learner-avatar"
                  style={{ background: avatarColor }}
                >
                  {l.name?.[0] || 'L'}
                  {isCompleted && (
                    <div className="act-cell-check" title="Completed today">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  )}
                  {!hasConsent && (
                    <div className="act-cell-lock" title="Needs consent">
                      <Lock size={12} />
                    </div>
                  )}
                </div>

                <span className="act-learner-name">{l.name}</span>
                <span className="act-learner-tier">{!hasConsent ? 'Needs consent' : l.group || 'Reading'}</span>
              </button>
            );
          })}
        </div>

        {/* Sticky Action Footer */}
        <div className="act-sticky-footer">
          <button
            type="button"
            className="act-primary-btn"
            disabled={!selectedLearner}
            onClick={handleStartActivity}
          >
            Start with {selectedLearner ? selectedLearner.name : 'Learner'} →
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER 3: Interactive Activity Screen (All 8 Activities)
  // --------------------------------------------------------------------------
  if (view === 'play') {
    return (
      <div className="act-shell" role="region" aria-label={selectedActivity.name}>
        {/* Top Header */}
        <div className="act-top-bar">
          <button className="act-icon-btn" onClick={() => setView('select-learner')} aria-label="Close activity">
            <X size={18} />
          </button>
          <div style={{ flex: 1, textAlign: 'left', marginLeft: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#6e6783' }}>
              {selectedLearner?.name}’s turn · {currentSubject}
            </span>
            <h1 style={{ fontSize: '22px' }}>{selectedActivity.name}</h1>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* 1. MATHEMATICS: ADD NUMBERS / ADD TO 10 (Page 2 of PDF)              */}
        {/* ------------------------------------------------------------------ */}
        {selectedActivity.id === 'add-numbers' && (
          <div>
            <div className="act-math-formula">{selectedActivity.question}</div>

            <div className="act-numberline-box">
              <div className="act-numberline-track">
                <div className="act-numberline-line" />
                {Array.from({ length: 11 }, (_, i) => {
                  const isStart = i === selectedActivity.startNum;
                  const isTarget = i === selectedActivity.answer;
                  const isCurrent = i === linePosition;
                  const isHopped = hopsTaken.includes(i);

                  let nodeClass = 'act-numberline-node';
                  if (isStart) nodeClass += ' start-dot';
                  else if (isCurrent && isTarget) nodeClass += ' active-land';
                  else if (isHopped) nodeClass += ' hopped-dot';

                  return (
                    <button
                      key={i}
                      type="button"
                      className={nodeClass}
                      onClick={() => {
                        setLinePosition(i);
                        setHopsTaken(prev => [...new Set([...prev, i])]);
                        speakOrChime(String(i));
                      }}
                      title={`Hop to ${i}`}
                    >
                      {i}
                    </button>
                  );
                })}
              </div>

              <p className="act-instruction-sub">Start on the coral dot. Hop on the line.</p>
            </div>

            {/* Hint Speech Bubble */}
            <div className="act-lesedi-bubble">
              <div className="act-lesedi-avatar">
                <Sparkles size={18} />
              </div>
              <div className="act-lesedi-text">
                <strong>Hint {currentHintIndex + 1}:</strong> {selectedActivity.hints[currentHintIndex]}
              </div>
            </div>

            <div className="act-sticky-footer">
              <button
                type="button"
                className="act-secondary-btn"
                onClick={() => {
                  setCurrentHintIndex((currentHintIndex + 1) % selectedActivity.hints.length);
                  speakOrChime(selectedActivity.hints[(currentHintIndex + 1) % selectedActivity.hints.length]);
                }}
              >
                Show Me Another Hint
              </button>
              <button
                type="button"
                className="act-primary-btn act-coral-btn"
                onClick={() => {
                  const correct = linePosition === selectedActivity.answer;
                  handleFinishActivity({
                    total: 1,
                    correct: correct ? 1 : 0,
                    finalAnswer: linePosition,
                    isCorrect: correct,
                    hintsUsed: currentHintIndex + 1
                  });
                }}
              >
                I've Got It
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 2. MATHEMATICS: BEAD STRING (Page 5 of PDF)                        */}
        {/* ------------------------------------------------------------------ */}
        {selectedActivity.id === 'bead-string' && (
          <div>
            <div className="act-bead-card">
              <div className="act-bead-big-count">{slidBeads.size}</div>

              {/* Row 1 (10 beads) */}
              <div className="act-bead-string-row">
                <div className="act-bead-wire" />
                {Array.from({ length: 10 }, (_, i) => {
                  const isSlid = slidBeads.has(i);
                  return (
                    <div
                      key={i}
                      className={`act-bead-item ${isSlid ? 'slid' : ''}`}
                      onClick={() => {
                        const next = new Set(slidBeads);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        setSlidBeads(next);
                        speakOrChime(String(next.size));
                      }}
                      title={`Bead ${i + 1}`}
                    />
                  );
                })}
              </div>

              {/* Row 2 (10 beads) */}
              <div className="act-bead-string-row">
                <div className="act-bead-wire" />
                {Array.from({ length: 10 }, (_, i) => {
                  const idx = i + 10;
                  const isSlid = slidBeads.has(idx);
                  return (
                    <div
                      key={idx}
                      className={`act-bead-item ${isSlid ? 'slid' : ''}`}
                      onClick={() => {
                        const next = new Set(slidBeads);
                        if (next.has(idx)) next.delete(idx);
                        else next.add(idx);
                        setSlidBeads(next);
                        speakOrChime(String(next.size));
                      }}
                      title={`Bead ${idx + 1}`}
                    />
                  );
                })}
              </div>

              <p style={{ fontSize: '13px', color: '#6A6480', margin: '14px 0 0' }}>
                Tap a bead to slide the beads across.
              </p>
            </div>

            <div className="act-lesedi-bubble">
              <div className="act-lesedi-avatar">
                <Sparkles size={18} />
              </div>
              <div className="act-lesedi-text">
                Slide the beads across. Count each one. Can you count {selectedActivity.targetCount || 7} beads?
              </div>
            </div>

            <div className="act-sticky-footer">
              <button
                type="button"
                className="act-secondary-btn"
                onClick={() => setSlidBeads(new Set())}
              >
                Start Again
              </button>
              <button
                type="button"
                className="act-primary-btn act-coral-btn"
                onClick={() => {
                  const correct = slidBeads.size === (selectedActivity.targetCount || 7);
                  handleFinishActivity({
                    total: selectedActivity.targetCount || 7,
                    correct: Math.min(slidBeads.size, selectedActivity.targetCount || 7),
                    slidCount: slidBeads.size,
                    isCorrect: correct
                  });
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 3. MATHEMATICS: MAKE A TEN (Page 6 of PDF)                          */}
        {/* ------------------------------------------------------------------ */}
        {selectedActivity.id === 'make-a-ten' && (
          <div>
            <div className="act-math-formula">{selectedActivity.question}</div>

            <div className="act-tenframe-box">
              <div className="act-tenframe-grid">
                {Array.from({ length: 10 }, (_, i) => {
                  const isFilled = i < frameCounters;
                  const isAddedFromTray = i >= selectedActivity.frameStart && i < frameCounters;

                  return (
                    <div
                      key={i}
                      className={`act-tenframe-slot ${isFilled ? 'filled' : ''}`}
                    >
                      {isFilled && (
                        <div
                          className={`act-counter-circle ${isAddedFromTray ? 'act-counter-blue' : 'act-counter-coral'}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <p style={{ textAlign: 'center', fontSize: '13px', color: '#69647C', margin: 0 }}>
                Tap a counter in the tray to move it into the ten-frame
              </p>

              {/* Lower Tray of Counters */}
              <div className="act-tray-container">
                {Array.from({ length: trayCounters }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className="act-counter-circle act-counter-blue"
                    onClick={() => {
                      if (frameCounters < 10) {
                        setFrameCounters(f => f + 1);
                        setTrayCounters(t => Math.max(0, t - 1));
                        speakOrChime(String(frameCounters + 1));
                      }
                    }}
                    title="Move counter to frame"
                  />
                ))}
                {trayCounters === 0 && (
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--act-navy)' }}>
                    Tray empty (All counters placed)
                  </span>
                )}
              </div>
            </div>

            <div className="act-lesedi-bubble">
              <div className="act-lesedi-avatar">
                <Sparkles size={18} />
              </div>
              <div className="act-lesedi-text">
                {selectedActivity.frameStart} needs how many more to make 10? Tap counters to find out.
              </div>
            </div>

            <div className="act-sticky-footer">
              <button
                type="button"
                className="act-secondary-btn"
                onClick={() => {
                  setFrameCounters(selectedActivity.frameStart);
                  setTrayCounters(selectedActivity.trayCount);
                }}
              >
                Start Again
              </button>
              <button
                type="button"
                className="act-primary-btn act-coral-btn"
                onClick={() => {
                  const correct = frameCounters === 10;
                  handleFinishActivity({
                    total: 10,
                    correct: frameCounters === 10 ? 10 : 8,
                    placedInFrame: frameCounters - selectedActivity.frameStart,
                    remainingInTray: trayCounters,
                    isCorrect: correct
                  });
                }}
              >
                I've Got It
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 4. MATHEMATICS: GROUP OF 5 (Page 7 of PDF)                         */}
        {/* ------------------------------------------------------------------ */}
        {selectedActivity.id === 'group-of-5' && (
          <div>
            <div className="act-groups5-card">
              <h2 style={{ fontSize: '24px', fontWeight: 900, textAlign: 'center', margin: '0 0 16px' }}>
                4 Groups of 5
              </h2>

              <div className="act-groups5-rows">
                {Array.from({ length: selectedActivity.rows }, (_, r) => {
                  const isCounted = r < countedRows;
                  const rowVal = (r + 1) * 5;

                  return (
                    <div
                      key={r}
                      className={`act-group5-row-item ${isCounted ? 'active' : ''}`}
                      onClick={() => {
                        setCountedRows(r + 1);
                        speakOrChime(String(rowVal));
                      }}
                    >
                      <div className="act-group5-dots">
                        {Array.from({ length: 5 }, (_, c) => (
                          <div
                            key={c}
                            className="act-counter-circle act-counter-coral"
                            style={{ opacity: isCounted ? 1 : 0.45 }}
                          />
                        ))}
                      </div>

                      <div className="act-group5-badge">
                        {isCounted ? rowVal : '·'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="act-lesedi-bubble">
              <div className="act-lesedi-avatar">
                <Sparkles size={18} />
              </div>
              <div className="act-lesedi-text">
                Count in fives. Tap to count one row at a time.
              </div>
            </div>

            <div className="act-sticky-footer">
              <button
                type="button"
                className="act-primary-btn act-coral-btn"
                onClick={() => {
                  const nextCount = countedRows < selectedActivity.rows ? countedRows + 1 : countedRows;
                  setCountedRows(nextCount);
                  speakOrChime(String(nextCount * 5));

                  if (nextCount === selectedActivity.rows) {
                    handleFinishActivity({
                      total: selectedActivity.total,
                      correct: selectedActivity.total,
                      countedTotal: nextCount * 5,
                      isCorrect: true
                    });
                  }
                }}
              >
                {countedRows >= selectedActivity.rows ? 'Finish Group of 5 →' : 'Count a row'}
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 5. ENGLISH: TALK & TURN (Page 3 of PDF)                             */}
        {/* ------------------------------------------------------------------ */}
        {selectedActivity.id === 'talk-and-turn' && (
          <div>
            <div className="act-scene-card">
              <div className="act-scene-title">{selectedActivity.imageLabel}</div>

              {/* Stylized Market Day Art Illustration */}
              <svg className="act-illustration-art" viewBox="0 0 320 160" fill="none">
                <rect width="320" height="160" rx="16" fill="#DCE1FF" />
                <path d="M40 120 L160 40 L280 120 Z" fill="#8E9BFF" opacity="0.6" />
                <rect x="70" y="80" width="80" height="60" rx="8" fill="#FDD85D" />
                <rect x="180" y="70" width="85" height="70" rx="8" fill="#FFAB91" />
                <circle cx="110" cy="70" r="14" fill="#FF6B4A" />
                <circle cx="220" cy="60" r="16" fill="#25D366" />
                <path d="M60 140 H260" stroke="#101438" strokeWidth="4" strokeLinecap="round" />
              </svg>

              <h2 style={{ fontSize: '18px', fontWeight: 900, margin: '14px 0 6px' }}>
                {selectedActivity.guideText || 'Tell Lesedi one thing you can see.'}
              </h2>

              {/* Prompt Pills */}
              <div className="act-vocab-pills">
                {selectedActivity.prompts.map(p => {
                  const isActive = selectedPrompts.has(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`act-vocab-pill ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        const next = new Set(selectedPrompts);
                        if (next.has(p)) next.delete(p);
                        else next.add(p);
                        setSelectedPrompts(next);
                        speakOrChime(p);
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Speech bubble */}
            <div className="act-lesedi-bubble">
              <div className="act-lesedi-avatar">
                <Sparkles size={18} />
              </div>
              <div className="act-lesedi-text">
                Take your time. I'm listening.
              </div>
            </div>

            {/* Teacher manual observation notes (Optional) */}
            <div style={{ background: '#ffffff', borderRadius: '18px', padding: '12px 16px', border: '1px solid var(--act-border)', marginBottom: '80px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#68617D', display: 'block', marginBottom: '6px' }}>
                Teacher Observations (Optional):
              </label>
              <input
                type="text"
                placeholder="Teacher observations (vocabulary, sentence construction, confidence)"
                value={teacherNotes}
                onChange={e => setTeacherNotes(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid #dcd4c3', fontSize: '12.5px' }}
              />
            </div>

            <div className="act-sticky-footer">
              <button
                type="button"
                className={`act-primary-btn ${isRecording ? '' : 'act-coral-btn'}`}
                style={{ background: isRecording ? '#dc2626' : undefined }}
                onClick={() => {
                  if (!isRecording) {
                    setIsRecording(true);
                    speakOrChime('I am listening.');
                  } else {
                    setIsRecording(false);
                  }
                }}
              >
                <Mic size={18} />
                {isRecording ? `Recording... (${recordingSeconds}s) · Tap to finish` : 'Tap and Talk'}
              </button>
              <button
                type="button"
                className="act-secondary-btn"
                onClick={() => speakOrChime('Tell Lesedi one thing you can see in the market.')}
              >
                <Volume2 size={16} /> Hear It Again
              </button>
              <button
                type="button"
                className="act-primary-btn"
                style={{ marginTop: '8px' }}
                onClick={() => {
                  handleFinishActivity({
                    total: 3,
                    correct: Math.max(1, selectedPrompts.size),
                    selectedPrompts: Array.from(selectedPrompts),
                    hasAudio: recordingSeconds > 0,
                    teacherNotes
                  });
                }}
              >
                Finish Talk & Turn →
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 6. ENGLISH: SOUND HUNT (Page 8 of PDF)                              */}
        {/* ------------------------------------------------------------------ */}
        {selectedActivity.id === 'sound-hunt' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <span className="pd-tag" style={{ background: '#FDD85D', color: '#101438', fontSize: '13px', fontWeight: 900 }}>
                Today's Sound: {selectedActivity.targetSound}
              </span>
            </div>

            <div className="act-hunt-stages">
              {selectedActivity.stages.map(st => {
                const isActive = st.stage === huntStage;
                return (
                  <div
                    key={st.stage}
                    className="act-stage-row"
                    style={{ borderColor: isActive ? 'var(--act-navy)' : undefined, background: isActive ? '#fff' : '#fcfaf6' }}
                  >
                    <div
                      className="act-stage-number"
                      style={{ background: st.stage === 1 ? '#FDD85D' : st.stage === 2 ? '#F48FB1' : '#8E9BFF' }}
                    >
                      {st.stage}
                    </div>

                    <div className="act-stage-content">
                      <div className="act-stage-title">{st.title}</div>
                      <div className="act-stage-instruction">{st.instruction}</div>

                      {st.items && (
                        <div className="act-stage-items-grid">
                          {st.items.map((it, idx) => {
                            const key = `${st.stage}-${idx}`;
                            const isChosen = huntSelectedItems.has(key);
                            return (
                              <button
                                key={idx}
                                type="button"
                                className={`act-chip-btn ${isChosen ? 'selected' : ''}`}
                                onClick={() => {
                                  const next = new Set(huntSelectedItems);
                                  if (next.has(key)) next.delete(key);
                                  else next.add(key);
                                  setHuntSelectedItems(next);
                                  speakOrChime(it.word || it.label);
                                }}
                              >
                                {it.emoji ? `${it.emoji} ` : ''}{it.word || it.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {st.sentence && (
                        <div style={{ fontStyle: 'italic', fontWeight: 800, marginTop: '6px', fontSize: '14px', color: 'var(--act-navy)' }}>
                          "{st.sentence}"
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="act-lesedi-bubble">
              <div className="act-lesedi-avatar">
                <Sparkles size={18} />
              </div>
              <div className="act-lesedi-text">
                Listen for the 's' sound. Spot three things that start with it.
              </div>
            </div>

            <div className="act-sticky-footer">
              <button
                type="button"
                className="act-primary-btn act-coral-btn"
                onClick={() => {
                  if (huntStage < 3) {
                    setHuntStage(s => s + 1);
                  } else {
                    handleFinishActivity({
                      total: 4,
                      correct: Math.min(4, Math.max(2, huntSelectedItems.size)),
                      stage: huntStage
                    });
                  }
                }}
              >
                {huntStage < 3 ? `Next Stage (${huntStage}/3) →` : 'Finish Sound Hunt →'}
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 7. ENGLISH: SOUND SORTER (Page 10 of PDF)                           */}
        {/* ------------------------------------------------------------------ */}
        {selectedActivity.id === 'sound-sorter' && (
          <div>
            {(() => {
              const round = selectedActivity.rounds[sorterRoundIndex];
              return (
                <div>
                  <div className="act-scene-card" style={{ padding: '36px 20px' }}>
                    <h2 style={{ fontSize: '32px', fontWeight: 900, margin: '0 0 10px' }}>
                      {round.imageText}
                    </h2>
                    <p style={{ fontSize: '16px', fontWeight: 800, color: 'var(--act-navy)', margin: 0 }}>
                      Which sound do you hear first?
                    </p>
                  </div>

                  {/* Two large square sound buttons */}
                  <div className="act-sound-options-row">
                    {round.options.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        className="act-sound-btn"
                        style={{
                          background: opt === round.options[0] ? round.soundAColor : round.soundBColor
                        }}
                        onClick={() => {
                          const isCorrect = opt.toLowerCase() === round.correct.toLowerCase();
                          setSorterFeedback(isCorrect ? 'correct' : 'retry');
                          speakOrChime(opt);

                          const updatedAnswers = [...sorterAnswers, { roundId: round.id, chosen: opt, isCorrect }];
                          setSorterAnswers(updatedAnswers);

                          setTimeout(() => {
                            setSorterFeedback(null);
                            if (sorterRoundIndex + 1 < selectedActivity.rounds.length) {
                              setSorterRoundIndex(i => i + 1);
                            } else {
                              const correctCount = updatedAnswers.filter(a => a.isCorrect).length;
                              handleFinishActivity({
                                total: selectedActivity.rounds.length,
                                correct: correctCount,
                                attempts: updatedAnswers.length
                              });
                            }
                          }, 650);
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  <div className="act-lesedi-bubble">
                    <div className="act-lesedi-avatar">
                      <Sparkles size={18} />
                    </div>
                    <div className="act-lesedi-text">
                      {sorterFeedback === 'correct' ? 'Super job! That is right.' : sorterFeedback === 'retry' ? 'Listen closely and try.' : 'Listen carefully. Tap the sound you hear first.'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: 800, color: '#68617D' }}>
                    Question {sorterRoundIndex + 1} of {selectedActivity.rounds.length}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 8. ENGLISH: BLEND A WORD (Page 11 of PDF)                           */}
        {/* ------------------------------------------------------------------ */}
        {selectedActivity.id === 'blend-a-word' && (
          <div>
            {(() => {
              const item = selectedActivity.words[blendWordIndex];
              return (
                <div>
                  <div className="act-scene-card" style={{ background: '#ffffff', border: '1px solid var(--act-border)' }}>
                    <div className="act-letters-row">
                      {item.letters.map((ltr, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`act-letter-card ${speakingLetter === ltr ? 'speaking' : ''}`}
                          onClick={() => {
                            setSpeakingLetter(ltr);
                            speakOrChime(ltr);
                            setTimeout(() => setSpeakingLetter(null), 500);
                          }}
                          title={`Sound: ${ltr}`}
                        >
                          {ltr}
                        </button>
                      ))}
                    </div>

                    <p style={{ fontSize: '13px', fontWeight: 800, color: '#6A6482', margin: 0 }}>
                      Tap each letter to hear its sound.
                    </p>
                  </div>

                  <div className="act-lesedi-bubble">
                    <div className="act-lesedi-avatar">
                      <Sparkles size={18} />
                    </div>
                    <div className="act-lesedi-text">
                      {isBlended
                        ? `Great blending! "${item.word}"`
                        : 'Tap each letter. I will say its sound.'}
                    </div>
                  </div>

                  <div className="act-sticky-footer">
                    <button
                      type="button"
                      className="act-secondary-btn"
                      onClick={() => {
                        setIsBlended(true);
                        speakOrChime(item.word);
                        setBlendAttempts(a => a + 1);
                      }}
                    >
                      Slide the sounds together → "{item.word}"
                    </button>
                    <button
                      type="button"
                      className="act-primary-btn act-coral-btn"
                      onClick={() => {
                        if (blendWordIndex + 1 < selectedActivity.words.length) {
                          setBlendWordIndex(i => i + 1);
                          setIsBlended(false);
                        } else {
                          handleFinishActivity({
                            total: selectedActivity.words.length,
                            correct: selectedActivity.words.length,
                            attempts: blendAttempts + 1
                          });
                        }
                      }}
                    >
                      {blendWordIndex + 1 < selectedActivity.words.length ? 'Next Word →' : 'Finish Blend a Word →'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER 4: Lesedi's Performance Review Screen (Page 4 of PDF)
  // --------------------------------------------------------------------------
  if (view === 'review') {
    const activeRev = editedReview || review;
    const isEnglish = currentSubject !== 'Mathematics';

    return (
      <div className="act-shell" role="region" aria-label="Lesedi's Assessment Review">
        {/* Header */}
        <div className="act-top-bar">
          <button className="act-icon-btn" onClick={() => setView('play')} aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <div className="act-draft-badge">Draft · Teacher Decides</div>
        </div>

        <div className="act-review-header">
          <h1 className="act-review-title">{activeRev.title}</h1>
          <div className="act-review-sub">
            {selectedLearner?.name} · {currentSubject} · {selectedActivity?.name}
          </div>
        </div>

        {/* 4 Structured Review Cards */}
        <div className="act-review-cards">
          <div className="act-review-card">
            <span className="act-review-label">Finding</span>
            <p className="act-review-body">{activeRev.finding}</p>
          </div>

          <div className="act-review-card">
            <span className="act-review-label">Why it matters</span>
            <p className="act-review-body">{activeRev.whyItMatters}</p>
          </div>

          <div className="act-review-card">
            <span className="act-review-label">What to check</span>
            <p className="act-review-body">{activeRev.whatToCheck}</p>
          </div>

          <div className="act-review-card">
            <span className="act-review-label">What to do</span>
            <p className="act-review-body">{activeRev.whatToDo}</p>
          </div>
        </div>

        {/* Confidence indicator */}
        <div className="act-confidence-pill">
          Confidence: {activeRev.confidence.toLowerCase()}. Based on {sessionData.correct}/{sessionData.total} responses recorded during this activity.
        </div>

        {/* Reading Tier Recommendation (English Only, Teacher approval required) */}
        {isEnglish && activeRev.recommendedTier && (
          <div className="act-tier-recommendation">
            <div className="act-tier-rec-header">
              <span className="act-tier-rec-title">Reading Tier Recommendation</span>
              <span className="pd-pill" style={{ background: '#FDD85D', color: '#101438' }}>Teacher Decision</span>
            </div>
            <p className="act-tier-rec-p">
              Lesedi suggests moving <strong>{selectedLearner?.name}</strong> to <strong>{activeRev.recommendedTier}</strong>.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`act-chip-btn ${selectedTierChange === activeRev.recommendedTier ? 'selected' : ''}`}
                onClick={() => setSelectedTierChange(activeRev.recommendedTier)}
              >
                Move to Recommended Tier ({activeRev.recommendedTier})
              </button>
              <button
                type="button"
                className={`act-chip-btn ${selectedTierChange === null ? 'selected' : ''}`}
                onClick={() => setSelectedTierChange(null)}
              >
                Keep Current Tier ({selectedLearner?.group || 'Current'})
              </button>
            </div>
          </div>
        )}

        {/* Edit Modal Trigger */}
        <div style={{ textAlign: 'right', marginBottom: '90px' }}>
          <button
            type="button"
            className="pd-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
            onClick={() => setIsEditingReview(true)}
          >
            <Edit2 size={14} /> Edit Review Findings
          </button>
        </div>

        {/* Action Buttons */}
        <div className="act-sticky-footer">
          <button
            type="button"
            className="act-secondary-btn"
            onClick={() => setIsEditingReview(true)}
          >
            Edit Review
          </button>
          <button
            type="button"
            className="act-primary-btn"
            onClick={handleApproveAssessment}
          >
            Approve Assessment
          </button>
          <button
            type="button"
            onClick={handleRejectDraft}
            style={{ background: 'none', border: 'none', color: '#888299', fontSize: '12px', fontWeight: 700, padding: '8px 0', width: '100%', cursor: 'pointer', textAlign: 'center' }}
          >
            Reject Draft
          </button>
        </div>

        {/* Modal for Teacher Editing */}
        {isEditingReview && (
          <div className="act-modal-overlay" role="dialog" aria-modal="true">
            <div className="act-modal-window">
              <h2 className="act-modal-title">Edit Lesedi Review</h2>

              <div className="act-modal-field">
                <label>Finding</label>
                <textarea
                  value={editedReview.finding}
                  onChange={e => setEditedReview({ ...editedReview, finding: e.target.value })}
                />
              </div>

              <div className="act-modal-field">
                <label>Why it matters</label>
                <textarea
                  value={editedReview.whyItMatters}
                  onChange={e => setEditedReview({ ...editedReview, whyItMatters: e.target.value })}
                />
              </div>

              <div className="act-modal-field">
                <label>What to check</label>
                <textarea
                  value={editedReview.whatToCheck}
                  onChange={e => setEditedReview({ ...editedReview, whatToCheck: e.target.value })}
                />
              </div>

              <div className="act-modal-field">
                <label>What to do</label>
                <textarea
                  value={editedReview.whatToDo}
                  onChange={e => setEditedReview({ ...editedReview, whatToDo: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="act-primary-btn"
                  onClick={() => setIsEditingReview(false)}
                >
                  Save Edits
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER 5: Completion Screen ("Well done, Thando!")
  // --------------------------------------------------------------------------
  if (view === 'celebration') {
    return (
      <div className="act-shell" role="region" aria-label="Activity Complete">
        <div className="act-completion-shell">
          <div className="act-completion-circle">
            <ThumbsUp size={44} />
          </div>

          <h1 className="act-completion-h1">Well done, {selectedLearner?.name}!</h1>
          <p className="act-completion-p">
            Your activity is complete. The teacher has approved your assessment!
          </p>

          <button
            type="button"
            className="act-primary-btn act-coral-btn"
            style={{ marginBottom: '12px' }}
            onClick={handleNextLearner}
          >
            Next Learner →
          </button>

          <button
            type="button"
            className="act-secondary-btn"
            onClick={handleBackToActivities}
          >
            Back to Activities
          </button>
        </div>
      </div>
    );
  }

  return null;
}
