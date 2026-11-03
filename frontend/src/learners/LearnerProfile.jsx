import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  BookOpen,
  MessageCircle,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Plus,
  Trash2,
  UserCheck,
  ShieldAlert,
  ChevronDown,
  Edit2
} from 'lucide-react';
import { GROUPS } from '../dashboardData.js';
import {
  getLearnerFullName,
  getLearnerAcademicRecord,
  getCapsRating
} from './learnerData.js';
import './learners.css';

export default function LearnerProfile({
  learner,
  classroom,
  selectedTier = 'All',
  onBack,
  onUpdateLearner,
  onStartMessage,
  isParent = false
}) {
  const grade = classroom?.grade || '2';
  const room = classroom?.room || grade;
  const teacherName = classroom?.teacher || 'Teacher';

  // Academic year and term selection
  const [academicYear, setAcademicYear] = useState(2026);
  const [selectedTerm, setSelectedTerm] = useState(4); // Default to Term 4 (current in-session)

  // Modals & form state
  const [showAddObsModal, setShowAddObsModal] = useState(false);
  const [obsText, setObsText] = useState('');
  const [obsTerm, setObsTerm] = useState(4);

  // Attendance recording state
  const [attDate, setAttDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attStatus, setAttStatus] = useState('Present');
  const [attReason, setAttReason] = useState('');

  // Selected assessment modal
  const [inspectedAssessment, setInspectedAssessment] = useState(null);

  if (!learner) return null;

  // Build academic record
  const record = getLearnerAcademicRecord(learner, grade, teacherName);
  const fullName = record.fullName;
  const isGradeR = grade === 'R';

  // Term assessments for the active term tab
  const termAssessments = record.assessments.filter(a => a.term === selectedTerm);
  const termAverage = record.termAverages[selectedTerm];
  const termRating = termAverage != null ? getCapsRating(termAverage) : null;
  const termAttendance = record.attendanceSummary.terms[selectedTerm] || {
    schoolDays: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    percentage: 100
  };

  // Observations for this learner
  const observations = record.observations;

  // Reading tier change handler
  const handleTierChange = (newTier) => {
    if (newTier === learner.group) return;
    if (window.confirm(`Move ${fullName} from ${learner.group} to ${newTier}?`)) {
      onUpdateLearner && onUpdateLearner({
        ...learner,
        group: newTier
      });
    }
  };

  // Attendance recording handler
  const handleRecordAttendance = (e) => {
    e.preventDefault();
    if (!attDate) return;

    const existingRecords = learner.attendanceRecords || record.attendanceRecords || [];
    // Prevent duplicate entries for same date by replacing existing or adding new
    const updatedRecords = [
      { date: attDate, status: attStatus, term: selectedTerm, reason: attReason.trim() },
      ...existingRecords.filter(r => r.date !== attDate)
    ];

    onUpdateLearner && onUpdateLearner({
      ...learner,
      attendanceRecords: updatedRecords
    });

    setAttReason('');
    alert(`Attendance for ${fullName} on ${attDate} recorded as "${attStatus}".`);
  };

  // Add observation handler
  const handleAddObservation = (e) => {
    e.preventDefault();
    if (!obsText.trim()) return;

    const newObs = {
      id: `obs-${Date.now()}`,
      term: Number(obsTerm),
      date: new Date().toISOString().slice(0, 10),
      author: teacherName,
      text: obsText.trim()
    };

    const existingObs = learner.observations || record.observations || [];
    onUpdateLearner && onUpdateLearner({
      ...learner,
      observations: [newObs, ...existingObs]
    });

    setObsText('');
    setShowAddObsModal(false);
  };

  // Delete observation handler
  const handleDeleteObservation = (obsId) => {
    if (!window.confirm('Delete this teacher observation?')) return;
    const existingObs = learner.observations || record.observations || [];
    onUpdateLearner && onUpdateLearner({
      ...learner,
      observations: existingObs.filter(o => o.id !== obsId)
    });
  };

  // Initials
  const initials = fullName
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('');

  return (
    <section className="pula-learners-container" aria-label={`Academic Profile of ${fullName}`}>
      {/* Top Navigation Bar */}
      <div className="pula-back-bar">
        <button
          type="button"
          className="pula-back-btn"
          onClick={onBack}
          aria-label={isParent ? 'Back to Home' : `Back to ${selectedTier} Learners`}
        >
          <ArrowLeft size={16} /> {isParent ? 'Back to Home' : `Back to ${selectedTier === 'All' ? 'Learners' : `${selectedTier} Learners`}`}
        </button>

        {onStartMessage && (
          <button
            type="button"
            className="pula-message-parent-btn"
            onClick={() => onStartMessage('Progress', null, learner.id)}
            title={isParent ? `Message ${teacherName}` : "Message learner's parent"}
          >
            <MessageCircle size={15} /> {isParent ? `Message ${teacherName} →` : 'Message Parent →'}
          </button>
        )}
      </div>

      <div className="pula-profile-shell">
        {/* Profile Hero Card */}
        <div className="pula-profile-hero">
          <div className="pula-hero-top">
            <div className={`pula-hero-avatar avatar-${learner.group}`}>
              {initials}
            </div>

            <div className="pula-hero-details">
              <h1 className="pula-hero-name">{fullName}</h1>

              <div className="pula-hero-sub">
                <span style={{ fontWeight: 800 }}>Grade {room}</span>
                <span>·</span>
                <span>{academicYear} Academic Year</span>
                <span>·</span>
                {/* Reading Tier Selector / Display */}
                {isParent ? (
                  <span className={`pula-badge-pill badge-${learner.group}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 800 }}>
                    Reading Tier: {learner.group}
                  </span>
                ) : (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <span className={`pula-badge-pill badge-${learner.group}`}>
                      Tier:
                    </span>
                    <select
                      value={learner.group}
                      onChange={e => handleTierChange(e.target.value)}
                      style={{
                        border: '1px solid #dcd4c3',
                        borderRadius: '8px',
                        padding: '2px 6px',
                        fontSize: '12px',
                        fontWeight: 800,
                        background: '#fff',
                        cursor: 'pointer'
                      }}
                      title="Change reading tier"
                    >
                      {GROUPS.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Quick Academic Stats */}
          <div className="pula-hero-stats">
            <div className="pula-hero-stat-card">
              <small>Academic Average</small>
              <b>{record.yearAverage != null ? `${record.yearAverage}%` : 'Competency'}</b>
              {record.yearAverage != null && (
                <div style={{ fontSize: '10px', color: '#6e6783', fontWeight: 700 }}>
                  CAPS Rating {record.code || 4}/7
                </div>
              )}
            </div>

            <div className="pula-hero-stat-card">
              <small>Attendance Rate</small>
              <b>{record.attendanceSummary.overallPercentage}%</b>
              <div style={{ fontSize: '10px', color: '#1a5433', fontWeight: 700 }}>
                {termAttendance.absent} absences this term
              </div>
            </div>

            <div className="pula-hero-stat-card">
              <small>Improvement</small>
              <b>
                {record.improvement != null ? (
                  <span className="pula-improvement-badge pula-positive-imp">
                    +{record.improvement} pts
                  </span>
                ) : (
                  <span className="pula-improvement-badge pula-neutral-imp">
                    Steady
                  </span>
                )}
              </b>
              <div style={{ fontSize: '10px', color: '#6e6783', fontWeight: 700 }}>
                {isGradeR ? 'Early literacy' : 'Trajectory T1 → T4'}
              </div>
            </div>
          </div>
        </div>

        {/* Academic Year & Term Navigation Bar */}
        <div className="pula-nav-tabs-bar">
          <div className="pula-year-badge">
            <Calendar size={15} /> Academic Year: <strong>{academicYear}</strong>
          </div>

          <div className="pula-term-tabs" role="tablist" aria-label="Select Academic Term">
            {[1, 2, 3, 4].map(t => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={selectedTerm === t}
                className={`pula-term-tab-btn ${selectedTerm === t ? 'active' : ''}`}
                onClick={() => setSelectedTerm(t)}
              >
                Term {t} {t === 4 ? '· Active' : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Year-to-Date Trajectory Overview */}
        <div className="pula-section-card">
          <div className="pula-section-header">
            <h2 className="pula-section-title">Academic Performance Overview</h2>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#6c6680' }}>
              Terms 1 – 4 Progression
            </span>
          </div>

          {/* Bar Chart across 4 Terms */}
          <div className="pula-trajectory-chart" aria-label="Term-by-term performance trajectory">
            {[1, 2, 3, 4].map(t => {
              const avg = record.termAverages[t];
              const isCurrent = t === selectedTerm;
              const heightPct = avg != null ? Math.max(15, (avg / 100) * 100) : 0;

              return (
                <div key={t} className="pula-chart-bar-group">
                  <span className="pula-chart-val">
                    {avg != null ? `${avg}%` : 'Pending'}
                  </span>
                  <div
                    className={`pula-chart-bar ${isCurrent ? 'current' : ''}`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="pula-chart-label">
                    Term {t} {t === 4 ? '(In Prog)' : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {record.improvement != null && (
            <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: '#1a5433', fontWeight: 800 }}>
              <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Academic Improvement: +{record.improvement} percentage points from Term 1 to Term {selectedTerm}.
            </p>
          )}
        </div>

        {/* Term-by-Term Detailed Performance */}
        <div className="pula-section-card">
          <div className="pula-section-header">
            <div>
              <h2 className="pula-section-title">
                Term {selectedTerm} — Academic Performance
              </h2>
              <small style={{ color: '#67617b' }}>
                {selectedTerm === 4 ? 'Current Term (In progress)' : `Finalized Results · Term ${selectedTerm}`}
              </small>
            </div>

            {termAverage != null && termRating && (
              <span
                className="pula-score-pill"
                style={{ background: termRating.bg, color: termRating.color }}
              >
                Term Average: {termAverage}% ({termRating.label})
              </span>
            )}
          </div>

          {termAssessments.length === 0 ? (
            <div className="pula-empty-state">
              <p style={{ margin: 0 }}>No academic results have been recorded for this term.</p>
            </div>
          ) : (
            <div className="pula-table-responsive">
              <table className="pula-assessment-table">
                <thead>
                  <tr>
                    <th>Assessment & Subject</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Result</th>
                    <th>Teacher Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {termAssessments.map(a => {
                    const rating = a.percentage != null ? getCapsRating(a.percentage) : null;
                    return (
                      <tr
                        key={a.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setInspectedAssessment(a)}
                        title="Click to view full assessment details"
                      >
                        <td className="pula-assessment-title-cell">
                          <b>{a.name}</b>
                          <small>{a.subject}</small>
                        </td>

                        <td>
                          <span className="pula-badge-pill" style={{ background: '#f5f0ec', color: '#443f5a' }}>
                            {a.type}
                          </span>
                        </td>

                        <td style={{ fontSize: '12px', color: '#68617d', whiteSpace: 'nowrap' }}>
                          {a.date}
                        </td>

                        <td>
                          {a.percentage != null ? (
                            <span
                              className="pula-score-pill"
                              style={{ background: rating?.bg, color: rating?.color }}
                            >
                              {a.percentage}% {a.maxMark ? `(${a.achievedMark}/${a.maxMark})` : ''}
                            </span>
                          ) : (
                            <span className="pula-badge-pill" style={{ background: '#dce9df', color: '#1a5433' }}>
                              {a.competencyLevel || 'Achieved'}
                            </span>
                          )}
                        </td>

                        <td style={{ fontSize: '12px', color: '#57516e', maxWidth: '240px' }}>
                          {a.feedback}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Approved Activity Assessments (Lesedi Interactive Learning) */}
        <div className="pula-section-card" data-testid="activity-assessments-section">
          <div className="pula-section-header">
            <h2 className="pula-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="#FF6B4A" /> Interactive Activity Assessments
            </h2>
            <span className="pula-badge-pill" style={{ background: '#eef2ff', color: '#3730a3' }}>
              {(learner.activityAssessments || []).length} Recorded
            </span>
          </div>
          {(learner.activityAssessments || []).length === 0 ? (
            <p style={{ fontSize: '13px', color: '#68617d', margin: '4px 0 10px' }}>
              No interactive activity assessments recorded yet for {record.fullName.split(' ')[0]}.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {(learner.activityAssessments || []).map((act, idx) => (
                <div
                  key={act.id || idx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #ebd9c8',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    boxShadow: '0 1px 4px rgba(16, 20, 56, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: act.subject === 'Mathematics' ? '#2563eb' : '#d946ef', marginRight: '6px' }}>
                        {act.subject}
                      </span>
                      <strong style={{ fontSize: '14px', color: '#101438' }}>{act.activityName}</strong>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '10px' }}>
                      {act.status || 'Approved'}
                    </span>
                  </div>

                  {act.percentage !== null && act.percentage !== undefined && (
                    <div style={{ fontSize: '12.5px', color: '#101438', marginBottom: '6px' }}>
                      <strong>Result: </strong>{act.score}/{act.maxScore} ({act.percentage}%)
                    </div>
                  )}

                  {act.finding && (
                    <p style={{ fontSize: '12.5px', color: '#4b5563', margin: '4px 0' }}>
                      <strong>Lesedi Finding: </strong>{act.finding}
                    </p>
                  )}

                  {act.teacherNotes && (
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0', fontStyle: 'italic' }}>
                      <strong>Teacher notes: </strong>{act.teacherNotes}
                    </p>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', marginTop: '6px', borderTop: '1px solid #f3f4f6', paddingTop: '6px' }}>
                    <span>Term: {act.term || 'Term 4'} · {act.academicYear || '2026'}</span>
                    <span>Approved by {act.approvedBy || 'Teacher'} · {new Date(act.approvedAt || act.completedAt || Date.now()).toLocaleDateString('en-ZA')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reading Development & Tier Progression */}
        <div className="pula-section-card">
          <div className="pula-section-header">
            <h2 className="pula-section-title">Reading Development & Tier Progression</h2>
            <span className={`pula-badge-pill badge-${learner.group}`}>
              Current Tier: {learner.group}
            </span>
          </div>

          {/* Tier Progression Flow */}
          <div className="pula-tier-progression">
            {[1, 2, 3, 4].map((t, idx) => {
              const tier = record.tierHistory[t] || 'Seed';
              return (
                <React.Fragment key={t}>
                  <div className="pula-prog-step">
                    <small>Term {t}</small>
                    <span className={`pula-prog-tier badge-${tier}`}>
                      {tier}
                    </span>
                  </div>
                  {idx < 3 && <span className="pula-prog-arrow">→</span>}
                </React.Fragment>
              );
            })}
          </div>

          {/* Grade R Early Literacy vs Grade 1-3 Words Per Minute */}
          {isGradeR ? (
            <div>
              <h3 style={{ fontSize: '14px', margin: '14px 0 8px' }}>Foundation Phase Early Literacy Indicators</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {record.gradeRLiteracy?.map(ind => (
                  <div key={ind.area} style={{ background: '#fdf9f0', padding: '10px 12px', borderRadius: '12px', border: '1px solid #ebd9c8' }}>
                    <small style={{ fontWeight: 800, color: '#68617d', display: 'block' }}>{ind.area}</small>
                    <b style={{ color: ind.status === 'Proficient' ? '#1f593b' : '#775c13' }}>{ind.status}</b>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h3 style={{ fontSize: '14px', margin: '14px 0 8px' }}>Reading Fluency (Words Per Minute)</h3>
              <div className="pula-trajectory-chart" style={{ height: '110px' }}>
                {[1, 2, 3, 4].map(t => {
                  const wpm = record.history[t - 1] || 0;
                  const maxWpm = Math.max(...record.history, 45);
                  const heightPct = Math.max(15, (wpm / maxWpm) * 100);

                  return (
                    <div key={t} className="pula-chart-bar-group">
                      <span className="pula-chart-val">{wpm} WPM</span>
                      <div className="pula-chart-bar" style={{ height: `${heightPct}%`, background: '#dce7f2' }} />
                      <span className="pula-chart-label">Term {t}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p style={{ fontSize: '12.5px', color: '#635c78', marginTop: '12px' }}>
            <strong>Teacher Strategy: </strong>{record.strategy}. Reviewed on {record.reviewDate}.
          </p>
        </div>

        {/* Attendance and Absenteeism Tracking */}
        <div className="pula-section-card">
          <div className="pula-section-header">
            <h2 className="pula-section-title">Attendance Overview</h2>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#1a5433' }}>
              Term {selectedTerm} Attendance: {termAttendance.percentage}%
            </span>
          </div>

          <div className="pula-attendance-summary-grid">
            <div className="pula-att-stat">
              <small>School Days</small>
              <b>{termAttendance.schoolDays}</b>
            </div>
            <div className="pula-att-stat">
              <small>Present</small>
              <b style={{ color: '#1f593b' }}>{termAttendance.present}</b>
            </div>
            <div className="pula-att-stat">
              <small>Absent</small>
              <b style={{ color: '#8a2312' }}>{termAttendance.absent}</b>
            </div>
            <div className="pula-att-stat">
              <small>Late</small>
              <b style={{ color: '#8e4b10' }}>{termAttendance.late}</b>
            </div>
          </div>

          {/* Attendance Log List */}
          <h3 style={{ fontSize: '14px', margin: '14px 0 8px' }}>Recorded Attendance Exceptions</h3>
          {record.attendanceRecords.filter(r => r.term === selectedTerm).length === 0 ? (
            <p style={{ fontSize: '12.5px', color: '#69627e', margin: '4px 0' }}>
              No absence or lateness records captured for Term {selectedTerm}. Full attendance.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {record.attendanceRecords
                .filter(r => r.term === selectedTerm)
                .map((rec, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#fffdf9',
                      border: '1px solid #ebd9c8',
                      borderRadius: '12px',
                      padding: '8px 12px',
                      fontSize: '12.5px'
                    }}
                  >
                    <span>
                      <strong style={{ marginRight: '8px' }}>{rec.date}</strong>
                      <span
                        className="pula-badge-pill"
                        style={{
                          background:
                            rec.status === 'Absent' ? '#fcdcd5' : rec.status === 'Late' ? '#fbf3dc' : '#dce9df',
                          color:
                            rec.status === 'Absent' ? '#8a2312' : rec.status === 'Late' ? '#715814' : '#1f593b'
                        }}
                      >
                        {rec.status}
                      </span>
                    </span>
                    <small style={{ color: '#6a6480' }}>{rec.reason || 'Recorded by teacher'}</small>
                  </div>
                ))}
            </div>
          )}

          {/* Teacher Attendance Recording Form (Teacher only) */}
          {!isParent && (
            <form className="pula-att-record-form" onSubmit={handleRecordAttendance}>
              <h4 style={{ fontSize: '13px', fontWeight: 800, margin: '0 0 10px', color: 'var(--pula-navy)' }}>
                <UserCheck size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Record Attendance for {fullName}
              </h4>
              <div className="pula-att-form-grid">
                <label style={{ fontSize: '11px', fontWeight: 800 }}>
                  Date
                  <input
                    required
                    type="date"
                    value={attDate}
                    onChange={e => setAttDate(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid #ccc' }}
                  />
                </label>

                <label style={{ fontSize: '11px', fontWeight: 800 }}>
                  Status
                  <select
                    value={attStatus}
                    onChange={e => setAttStatus(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid #ccc' }}
                  >
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Late">Late</option>
                    <option value="Excused">Excused</option>
                  </select>
                </label>
              </div>

              <label style={{ fontSize: '11px', fontWeight: 800, display: 'block', marginBottom: '10px' }}>
                Reason / Teacher Note (Optional)
                <input
                  type="text"
                  placeholder="e.g. Doctor's note, transport delay..."
                  value={attReason}
                  onChange={e => setAttReason(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid #ccc' }}
                />
              </label>

              <button
                type="submit"
                className="pd-primary"
                style={{ minHeight: '36px', padding: '6px 14px', fontSize: '12px' }}
              >
                Save Attendance Record
              </button>
            </form>
          )}
        </div>

        {/* Teacher Observations and Development Notes */}
        <div className="pula-section-card">
          <div className="pula-section-header">
            <h2 className="pula-section-title">Teacher Observations</h2>
            {!isParent && (
              <button
                type="button"
                className="pd-link"
                onClick={() => setShowAddObsModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12.5px' }}
              >
                <Plus size={15} /> Add Observation
              </button>
            )}
          </div>

          <div className="pula-observations-list">
            {observations.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#68617d' }}>No teacher observations recorded yet.</p>
            ) : (
              observations.map(obs => (
                <div key={obs.id} className="pula-obs-card">
                  <div className="pula-obs-header">
                    <span className="pula-obs-author">
                      {obs.author || teacherName} · Term {obs.term}
                    </span>
                    <span className="pula-obs-date">{obs.date}</span>
                  </div>

                  <p className="pula-obs-text">{obs.text}</p>

                  {!isParent && (
                    <button
                      type="button"
                      className="pula-obs-delete-btn"
                      onClick={() => handleDeleteObservation(obs.id)}
                      title="Delete observation"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <p style={{ fontSize: '11px', color: '#7a748c', marginTop: '14px', borderTop: '1px solid #eee5d4', paddingTop: '8px' }}>
            <ShieldAlert size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            Confidential academic development notes protected in accordance with POPIA regulations.
          </p>
        </div>

        {/* Term Performance Summary */}
        <div className="pula-section-card" style={{ background: '#fcfaf5', borderColor: '#e5dcce' }}>
          <h2 className="pula-section-title" style={{ marginBottom: '10px' }}>
            Term {selectedTerm} Summary
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: '#ffffff', padding: '10px', borderRadius: '12px', border: '1px solid #eee' }}>
              <small style={{ color: '#6a6480', display: 'block', fontWeight: 800 }}>Academic Average</small>
              <b style={{ fontSize: '15px' }}>{termAverage != null ? `${termAverage}%` : 'Competency'}</b>
            </div>

            <div style={{ background: '#ffffff', padding: '10px', borderRadius: '12px', border: '1px solid #eee' }}>
              <small style={{ color: '#6a6480', display: 'block', fontWeight: 800 }}>Reading Tier</small>
              <b style={{ fontSize: '15px' }}>{record.tierHistory[selectedTerm] || learner.group}</b>
            </div>

            <div style={{ background: '#ffffff', padding: '10px', borderRadius: '12px', border: '1px solid #eee' }}>
              <small style={{ color: '#6a6480', display: 'block', fontWeight: 800 }}>Attendance</small>
              <b style={{ fontSize: '15px' }}>{termAttendance.percentage}%</b>
            </div>

            <div style={{ background: '#ffffff', padding: '10px', borderRadius: '12px', border: '1px solid #eee' }}>
              <small style={{ color: '#6a6480', display: 'block', fontWeight: 800 }}>Assessments</small>
              <b style={{ fontSize: '15px' }}>{termAssessments.length} recorded</b>
            </div>
          </div>

          {observations.find(o => o.term === selectedTerm) && (
            <div style={{ background: '#ffffff', padding: '12px', borderRadius: '12px', border: '1px solid #eee' }}>
              <small style={{ fontWeight: 800, color: '#6b6582', display: 'block', marginBottom: '4px' }}>
                Latest Term {selectedTerm} Teacher Observation:
              </small>
              <p style={{ margin: 0, fontSize: '13px', fontStyle: 'italic', color: '#443f5a' }}>
                "{observations.find(o => o.term === selectedTerm)?.text}"
              </p>
            </div>
          )}
        </div>

        {/* End-of-Year Academic Summary (Annual Overview) */}
        <div className="pula-section-card" style={{ background: 'var(--pula-cream)', borderColor: '#ded4c3' }}>
          <div className="pula-section-header">
            <h2 className="pula-section-title">
              {selectedTerm === 4 ? 'Year-to-Date Progress' : 'Academic Year Overview'}
            </h2>
            <span className="pula-badge-pill" style={{ background: '#ffffff', color: 'var(--pula-navy)' }}>
              {academicYear} Academic Year
            </span>
          </div>

          <p style={{ fontSize: '13px', color: '#57516e', margin: '0 0 12px' }}>
            Comprehensive annual summary across all four school terms for <strong>{fullName}</strong> (Grade {room}).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
            {[1, 2, 3, 4].map(t => (
              <div key={t} style={{ background: '#ffffff', padding: '10px', borderRadius: '12px', border: '1px solid #e8decb' }}>
                <small style={{ color: '#6e6783', display: 'block', fontWeight: 800 }}>Term {t} {t === 4 ? '(In Prog)' : ''}</small>
                <b>{record.termAverages[t] != null ? `${record.termAverages[t]}%` : 'Pending'}</b>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                  Tier: {record.tierHistory[t]}
                </div>
              </div>
            ))}
          </div>

          {record.yearAverage != null && (
            <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #ded5c2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 800 }}>Overall Annual Performance</span>
              <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--pula-navy)' }}>
                {record.yearAverage}% Average
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Add Observation Modal */}
      {showAddObsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(25, 24, 63, 0.45)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            maxWidth: '460px',
            width: '100%',
            padding: '22px',
            boxShadow: '0 10px 40px rgba(25, 24, 63, 0.25)'
          }}>
            <h3 style={{ marginTop: 0 }}>Add Teacher Observation</h3>
            <p style={{ fontSize: '12.5px', color: '#6a6480', marginTop: '-4px' }}>
              Record academic strengths, areas for improvement, and support interventions for {fullName}.
            </p>

            <form onSubmit={handleAddObservation}>
              <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '8px' }}>
                Academic Term
                <select
                  value={obsTerm}
                  onChange={e => setObsTerm(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ccc', marginTop: '4px' }}
                >
                  <option value={1}>Term 1</option>
                  <option value={2}>Term 2</option>
                  <option value={3}>Term 3</option>
                  <option value={4}>Term 4 (Current)</option>
                </select>
              </label>

              <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '16px' }}>
                Observation & Development Notes
                <textarea
                  required
                  rows={4}
                  minLength={5}
                  placeholder="Record strengths, learning challenges, and positive progress..."
                  value={obsText}
                  onChange={e => setObsText(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ccc', marginTop: '4px', resize: 'vertical' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="pd-link"
                  onClick={() => setShowAddObsModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pd-primary"
                  style={{ minHeight: '36px', padding: '8px 16px', fontSize: '12.5px' }}
                >
                  Save Observation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assessment Inspection Modal */}
      {inspectedAssessment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(25, 24, 63, 0.45)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            maxWidth: '460px',
            width: '100%',
            padding: '22px',
            boxShadow: '0 10px 40px rgba(25, 24, 63, 0.25)'
          }}>
            <span className="pula-badge-pill" style={{ background: '#f5f0ec', color: '#443f5a' }}>
              {inspectedAssessment.type} · Term {inspectedAssessment.term}
            </span>

            <h3 style={{ margin: '10px 0 4px' }}>{inspectedAssessment.name}</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#68617d' }}>{inspectedAssessment.subject} · {inspectedAssessment.date}</p>

            <div style={{ background: 'var(--pula-cream)', padding: '14px', borderRadius: '14px', margin: '16px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800 }}>Achieved Mark</span>
                <span style={{ fontSize: '15px', fontWeight: 900 }}>
                  {inspectedAssessment.achievedMark != null && inspectedAssessment.maxMark != null
                    ? `${inspectedAssessment.achievedMark} / ${inspectedAssessment.maxMark} (${inspectedAssessment.percentage}%)`
                    : inspectedAssessment.competencyLevel || 'Achieved'}
                </span>
              </div>

              {inspectedAssessment.feedback && (
                <div>
                  <small style={{ fontSize: '11px', fontWeight: 800, color: '#68617d', display: 'block', marginBottom: '2px' }}>
                    Teacher Feedback:
                  </small>
                  <p style={{ margin: 0, fontSize: '13px', color: '#38334c' }}>
                    "{inspectedAssessment.feedback}"
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="pd-primary"
                style={{ minHeight: '36px', padding: '8px 16px', fontSize: '12.5px' }}
                onClick={() => setInspectedAssessment(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

