import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Check,
  Trash2,
  Edit2,
  Send,
  AlertCircle,
  BookOpen,
  Info
} from 'lucide-react';
import {
  getSouthAfricanPublicHolidays,
  getDBESchoolCalendar,
  isSchoolHoliday,
  getSASTToday,
  getMonthName,
  buildMonthMatrix,
  EVENT_CATEGORY_CONFIG
} from './calendarData.js';
import './calendar.css';

export default function SchoolCalendar({
  role = 'Teacher',
  classroom = null,
  classes = [],
  items = [],
  onDeleteItem = null,
  onNotifyParents = null,
  onEditItem = null,
  childrenList = [],
  activeChildId = null,
  onSelectChild = null
}) {
  const isTeacher = role === 'Teacher';
  const isHOD = role === 'HOD';
  const isParent = role === 'Parent';

  // Live South African Standard Time date
  const [today, setToday] = useState(() => getSASTToday());

  // Active view year and month
  const [viewYear, setViewYear] = useState(() => today.year);
  const [viewMonth, setViewMonth] = useState(() => today.month - 1); // 0-indexed

  // Selected date (defaults to today)
  const [selectedDate, setSelectedDate] = useState(() => today.dateStr);

  // HOD Grade filter: 'All' | 'R' | '1' | '2' | '3'
  const [hodFilter, setHodFilter] = useState('All');

  // Schoolwork category filter: 'All' | 'Test' | 'Exam' | 'Spelling test' | 'Homework'
  const [typeFilter, setTypeFilter] = useState('All');

  // Edit item modal state (for Teacher)
  const [editingItem, setEditingItem] = useState(null);

  // Refresh today date every minute and on midnight / visibility change
  useEffect(() => {
    const checkDate = () => {
      const current = getSASTToday();
      setToday(current);
    };

    const interval = setInterval(checkDate, 60000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkDate();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // South African Public Holidays for the selected year
  const publicHolidays = getSouthAfricanPublicHolidays(viewYear);

  // Official DBE School Calendar for the selected year
  const dbeCalendar = getDBESchoolCalendar(viewYear);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleTodayClick = () => {
    const t = getSASTToday();
    setViewYear(t.year);
    setViewMonth(t.month - 1);
    setSelectedDate(t.dateStr);
  };

  // Compile all relevant schoolwork items based on role
  let relevantSchoolwork = [];
  if (isHOD) {
    // HOD sees schoolwork across authorized classrooms
    const targetClasses = hodFilter === 'All'
      ? classes
      : classes.filter(cl => String(cl.grade) === String(hodFilter));

    relevantSchoolwork = targetClasses.flatMap(cl =>
      (cl.items || []).map(i => ({
        ...i,
        grade: cl.grade,
        classroomName: `Grade ${cl.room || cl.grade}`,
        teacherName: cl.teacher
      }))
    );
  } else if (isTeacher) {
    relevantSchoolwork = (items || []).map(i => ({
      ...i,
      grade: classroom?.grade,
      classroomName: `Grade ${classroom?.room || classroom?.grade}`,
      teacherName: classroom?.teacher
    }));
  } else if (isParent) {
    // Parent sees their child's classroom schoolwork
    relevantSchoolwork = (items || []).map(i => ({
      ...i,
      grade: classroom?.grade,
      classroomName: `Grade ${classroom?.room || classroom?.grade}`,
      teacherName: classroom?.teacher
    }));
  }

  // Filter schoolwork by type if a type filter is active
  if (typeFilter !== 'All') {
    relevantSchoolwork = relevantSchoolwork.filter(i => i.type === typeFilter);
  }

  // Build events lookup by date
  const eventsByDate = {};

  const addEventToDate = (dStr, evt) => {
    if (!eventsByDate[dStr]) eventsByDate[dStr] = [];
    eventsByDate[dStr].push(evt);
  };

  // 1. Add South African Public Holidays
  for (const ph of publicHolidays) {
    addEventToDate(ph.date, {
      id: ph.id,
      title: ph.title,
      type: 'Public holiday',
      category: 'Public holiday',
      detail: ph.description,
      isPublicHoliday: true
    });
  }

  // 2. Add DBE School Milestones (opening, closing, term starts/ends)
  if (dbeCalendar.available) {
    for (const evt of dbeCalendar.events) {
      addEventToDate(evt.date, {
        id: evt.id,
        title: evt.title,
        type: evt.type,
        category: evt.type,
        detail: evt.description,
        isSchoolMilestone: true
      });
    }
  }

  // 3. Add Teacher-created Schoolwork items
  for (const item of relevantSchoolwork) {
    if (item.date) {
      addEventToDate(item.date, {
        id: item.id,
        title: item.title,
        type: item.type,
        category: item.type,
        detail: item.detail,
        grade: item.grade,
        classroomName: item.classroomName,
        teacherName: item.teacherName,
        told: item.told,
        rawItem: item,
        isSchoolwork: true
      });
    }
  }

  // Month matrix (Mon to Sun)
  const monthMatrix = buildMonthMatrix(viewYear, viewMonth);

  // Selected date events
  const selectedDateEvents = eventsByDate[selectedDate] || [];

  // Check if selected date is in an official school holiday period
  const activeHolidayPeriod = isSchoolHoliday(selectedDate, viewYear);

  return (
    <section className="pula-calendar-wrapper" aria-label="School Calendar">
      {/* Live Date Banner */}
      <div className="pula-cal-live-banner">
        <span className="pula-cal-live-date">
          <Clock size={16} /> Today: {today.displayFull}
        </span>
      </div>

      {/* Calendar Header with Navigation */}
      <div className="pula-cal-header">
        <div className="pula-cal-title-wrap">
          <h3 className="pula-cal-month-title">
            {getMonthName(viewMonth)}
          </h3>

          <select
            className="pula-cal-year-select"
            value={viewYear}
            onChange={e => setViewYear(parseInt(e.target.value, 10))}
            aria-label="Select Academic Year"
          >
            {[2024, 2025, 2026, 2027, 2028, 2029].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="pula-cal-nav-btns">
          <button
            className="pula-cal-nav-btn"
            onClick={handlePrevMonth}
            title="Previous month"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            className="pula-cal-today-btn"
            onClick={handleTodayClick}
          >
            Today
          </button>

          <button
            className="pula-cal-nav-btn"
            onClick={handleNextMonth}
            title="Next month"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Notice if future school calendar is not yet published */}
      {!dbeCalendar.available && (
        <div className="pula-cal-notice">
          <AlertCircle size={16} />
          <span>{dbeCalendar.message} Public holidays are calculated automatically.</span>
        </div>
      )}

      {/* HOD Grade Filters Bar */}
      {isHOD && (
        <div className="pula-cal-filters-bar">
          <span style={{ fontSize: '12px', fontWeight: 800, marginRight: '4px' }}>Filter Grade:</span>
          {['All', 'R', '1', '2', '3'].map(g => (
            <button
              key={g}
              className={`pula-cal-filter-chip ${hodFilter === g ? 'active' : ''}`}
              onClick={() => setHodFilter(g)}
            >
              {g === 'All' ? 'All Grades' : `Grade ${g}`}
            </button>
          ))}
        </div>
      )}

      {/* Parent Child Switcher (if parent has multiple children) */}
      {isParent && childrenList && childrenList.length > 1 && (
        <div className="pula-cal-filters-bar">
          <span style={{ fontSize: '12px', fontWeight: 800, marginRight: '4px' }}>Viewing for:</span>
          {childrenList.map(ch => (
            <button
              key={ch.id}
              className={`pula-cal-filter-chip ${activeChildId === ch.id ? 'active' : ''}`}
              onClick={() => onSelectChild && onSelectChild(ch.id)}
            >
              {ch.name} (Grade {ch.grade})
            </button>
          ))}
        </div>
      )}

      {/* 7-Column Calendar Grid */}
      <div className="pula-cal-grid" role="grid">
        {/* Column Weekday Headers */}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, idx) => (
          <div
            key={dayName}
            className={`pula-cal-col-header ${idx >= 5 ? 'weekend' : ''}`}
          >
            {dayName}
          </div>
        ))}

        {/* Days Matrix */}
        {monthMatrix.flatMap(week =>
          week.map(cell => {
            const dateEvents = eventsByDate[cell.dateStr] || [];
            const isToday = cell.dateStr === today.dateStr;
            const isSelected = cell.dateStr === selectedDate;
            const inSchoolHoliday = isSchoolHoliday(cell.dateStr, viewYear);

            return (
              <div
                key={cell.dateStr}
                role="gridcell"
                aria-selected={isSelected}
                tabIndex={0}
                className={`pula-cal-day-cell ${
                  !cell.isCurrentMonth ? 'other-month' : ''
                } ${cell.isWeekend ? 'weekend-day' : ''} ${
                  inSchoolHoliday ? 'school-holiday-period' : ''
                } ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedDate(cell.dateStr)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDate(cell.dateStr);
                  }
                }}
              >
                <span className="pula-cal-day-num">{cell.day}</span>

                {/* Event Indicators */}
                <div className="pula-cal-indicators">
                  {dateEvents.slice(0, 3).map((evt, idx) => {
                    const cfg = EVENT_CATEGORY_CONFIG[evt.category] || {
                      bg: '#dce7f2',
                      color: '#1a4369',
                      dotColor: '#2563eb',
                      icon: '📌'
                    };

                    return (
                      <React.Fragment key={evt.id || idx}>
                        {/* Dot for mobile / compact view */}
                        <span
                          className={`pula-cal-dot dot-${(evt.category || '').toLowerCase().replace(/\s+/g, '-')}`}
                          style={{ backgroundColor: cfg.dotColor || cfg.color }}
                          title={`${evt.type}: ${evt.title}`}
                          aria-label={`${evt.type}: ${evt.title}`}
                        />

                        {/* Pill for desktop / wide view */}
                        <span
                          className="pula-cal-pill"
                          style={{ background: cfg.bg, color: cfg.color }}
                          title={`${evt.type}: ${evt.title}`}
                        >
                          <span className="pula-cal-pill-icon">{cfg.icon}</span>
                          <span className="pula-cal-pill-title">{evt.title}</span>
                        </span>
                      </React.Fragment>
                    );
                  })}

                  {dateEvents.length > 3 && (
                    <span className="pula-cal-more-count" title={`${dateEvents.length - 3} more events`}>
                      +{dateEvents.length - 3}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selected Date Details Panel */}
      <div className="pula-cal-details-panel">
        <div className="pula-cal-details-header">
          <div>
            <h4 className="pula-cal-details-title">
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-ZA', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </h4>
            {activeHolidayPeriod && (
              <small style={{ color: '#55427d', fontWeight: 700 }}>
                🏖️ {activeHolidayPeriod.name}
              </small>
            )}
          </div>

          <span style={{ fontSize: '12px', fontWeight: 800, color: '#6a657c' }}>
            {selectedDateEvents.length} event{selectedDateEvents.length === 1 ? '' : 's'}
          </span>
        </div>

        {selectedDateEvents.length === 0 ? (
          <div className="pula-cal-empty-events">
            No events scheduled for this date.
          </div>
        ) : (
          <div className="pula-cal-events-list">
            {selectedDateEvents.map(evt => {
              const cfg = EVENT_CATEGORY_CONFIG[evt.category] || {
                bg: '#dce7f2',
                color: '#1a4369',
                icon: '📌'
              };

              return (
                <div key={evt.id} className="pula-cal-event-card">
                  <span className="pula-cal-event-icon">{cfg.icon}</span>

                  <div className="pula-cal-event-body">
                    <span
                      className="pula-cal-event-badge"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {evt.type}
                    </span>

                    <h5 className="pula-cal-event-title">{evt.title}</h5>

                    {evt.detail && (
                      <p className="pula-cal-event-detail">
                        {evt.isSchoolwork && <strong>Parent guidance: </strong>}
                        {evt.detail}
                      </p>
                    )}

                    {evt.classroomName && (
                      <small style={{ display: 'block', marginTop: '4px', color: '#68637c' }}>
                        {evt.classroomName} {evt.teacherName ? `· ${evt.teacherName}` : ''}
                      </small>
                    )}

                    {/* Teacher Actions on Schoolwork Item */}
                    {isTeacher && evt.isSchoolwork && (
                      <div className="pula-cal-event-actions">
                        {onNotifyParents && (
                          <button
                            className="pula-cal-btn-notify"
                            onClick={() => onNotifyParents(evt.type, evt.rawItem)}
                          >
                            {evt.told ? (
                              <><Check size={13} /> Parents told</>
                            ) : (
                              <><Send size={13} /> Tell parents</>
                            )}
                          </button>
                        )}

                        {onEditItem && (
                          <button
                            className="pd-link"
                            style={{ fontSize: '11.5px', padding: 0 }}
                            onClick={() => setEditingItem(evt.rawItem)}
                          >
                            <Edit2 size={13} style={{ verticalAlign: 'middle', marginRight: '3px' }} />
                            Edit
                          </button>
                        )}

                        {onDeleteItem && (
                          <button
                            className="pula-cal-btn-delete"
                            onClick={() => {
                              if (window.confirm(`Delete "${evt.title}"?`)) {
                                onDeleteItem(evt.rawItem.id);
                              }
                            }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Teacher Inline Edit Modal */}
      {editingItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(25, 24, 63, 0.4)',
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
            boxShadow: '0 10px 40px rgba(25, 24, 63, 0.2)'
          }}>
            <h3 style={{ marginTop: 0 }}>Edit Schoolwork</h3>
            <form onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              onEditItem && onEditItem({
                ...editingItem,
                type: f.get('type'),
                date: f.get('date'),
                title: f.get('title').trim(),
                detail: f.get('detail').trim()
              });
              setEditingItem(null);
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800 }}>
                  Type
                  <select name="type" defaultValue={editingItem.type} style={{ width: '100%', padding: '8px', borderRadius: '8px' }}>
                    {['Test', 'Exam', 'Spelling test', 'Homework'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: '12px', fontWeight: 800 }}>
                  Date
                  <input required type="date" name="date" defaultValue={editingItem.date} style={{ width: '100%', padding: '8px', borderRadius: '8px' }} />
                </label>
              </div>

              <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '10px' }}>
                Title
                <input required name="title" defaultValue={editingItem.title} style={{ width: '100%', padding: '8px', borderRadius: '8px' }} />
              </label>

              <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '16px' }}>
                Parent guidance
                <input name="detail" defaultValue={editingItem.detail} style={{ width: '100%', padding: '8px', borderRadius: '8px' }} />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="pd-link" onClick={() => setEditingItem(null)}>Cancel</button>
                <button type="submit" className="pd-primary" style={{ minHeight: '36px', padding: '8px 16px' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

