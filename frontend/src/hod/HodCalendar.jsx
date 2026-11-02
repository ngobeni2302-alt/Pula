import React, { useState, useMemo } from 'react';
import './HodCalendar.css';

const TYPE_STYLE = {
  'Test':          { chip: 'hod-chip-lavender', bar: '#6a5ab5', bg: '#e5dff0', text: '#3d2f8a', label: 'Test' },
  'Spelling test': { chip: 'hod-chip-lavender', bar: '#6a5ab5', bg: '#e5dff0', text: '#3d2f8a', label: 'Spelling test' },
  'Exam':          { chip: 'hod-chip-orange',   bar: '#d4650a', bg: '#fae2cc', text: '#7a3010', label: 'Exam' },
  'Homework':      { chip: 'hod-chip-blue',     bar: '#2c5f8a', bg: '#dce7f2', text: '#1d4f7a', label: 'Homework' },
  'Directive':     { chip: 'hod-chip-sand',     bar: '#8a7840', bg: '#f1e4bf', text: '#19183f', label: 'Directive' },
};
function typeStyle(type) { return TYPE_STYLE[type] || TYPE_STYLE['Homework']; }

const GRADE_DOT = ['#c0392b','#6a5ab5','#2e7d63','#2c5f8a'];
const GRADE_BG  = ['#fde8e5','#e5dff0','#dce9df','#dce7f2'];
const DOW    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function buildEvents(classes, directives, plans) {
  const ev = [];
  classes.forEach((cl, gi) => {
    cl.items.forEach(item => {
      ev.push({ id: item.id, date: item.date, title: item.title, type: item.type,
        detail: item.detail, gradeIdx: gi, grade: cl.grade, room: cl.room, teacher: cl.teacher });
    });
  });
  directives.forEach(d => {
    const plan = plans.find(p => p.grade === d.grade);
    ev.push({ id: d.id, date: d.due, title: d.text, type: 'Directive',
      detail: 'Status: ' + d.status, gradeIdx: classes.findIndex(cl => cl.grade === d.grade),
      grade: d.grade, room: plan?.room || d.grade, teacher: plan?.teacher || '' });
  });
  return ev;
}

function isoToDate(iso) { const [y,m,d] = iso.split('-').map(Number); return new Date(y, m-1, d); }
function dateKey(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function weekLabel(date) {
  const mon = new Date(date); mon.setDate(date.getDate() - ((date.getDay()+6)%7));
  const fri = new Date(mon); fri.setDate(mon.getDate()+4);
  const f = d => d.toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
  return 'Week of '+f(mon)+' \u2013 '+f(fri);
}

function EventChip({ ev, onClick }) {
  const ts = typeStyle(ev.type);
  return (
    <button className={'hod-cal-chip ' + ts.chip} title={ev.type+': '+ev.title+' \u2013 '+ev.teacher}
      aria-label={ev.type+': '+ev.title+' for Grade '+ev.room} onClick={() => onClick(ev)}>
      <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:ts.bar, verticalAlign:'middle', marginRight:4 }} aria-hidden='true' />
      Gr.{ev.room} {ev.title}
    </button>
  );
}

function EventPopover({ ev, onClose }) {
  if (!ev) return null;
  const ts = typeStyle(ev.type);
  const gi = ev.gradeIdx >= 0 ? ev.gradeIdx : 0;
  const fmtFull = d => isoToDate(d).toLocaleDateString('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  return (
    <div className='hod-cal-popover-overlay' onClick={e => e.target===e.currentTarget && onClose()} role='dialog' aria-modal='true' aria-label='Event detail'>
      <div className='hod-cal-popover'>
        <button className='hod-cal-popover-close' onClick={onClose} aria-label='Close'>&times;</button>
        <div className='hod-cal-popover-color-bar' style={{ background: ts.bar }} aria-hidden='true' />
        <p style={{ margin:'0 0 6px', display:'flex', alignItems:'center', gap:8 }}>
          <span className='hod-cal-grade-tag' style={{ background: GRADE_BG[gi]||GRADE_BG[0], color: GRADE_DOT[gi]||GRADE_DOT[0] }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:GRADE_DOT[gi]||GRADE_DOT[0], display:'inline-block' }} aria-hidden='true' />
            Grade {ev.room}
          </span>
          <span className={'hod-cal-type-tag ' + ts.chip}>{ev.type}</span>
        </p>
        <h3>{ev.title}</h3>
        <p><strong>Teacher:</strong> {ev.teacher}</p>
        <p><strong>Date:</strong> {fmtFull(ev.date)}</p>
        {ev.detail && <p style={{ color:'#575779' }}>{ev.detail}</p>}
      </div>
    </div>
  );
}

function MonthGrid({ year, month, events, visibleGrades, onEventClick }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrev  = new Date(year, month,   0).getDate();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    let d, cur = true;
    if (i < startOffset) { d = new Date(year, month-1, daysInPrev - startOffset + 1 + i); cur = false; }
    else if (i - startOffset >= daysInMonth) { d = new Date(year, month+1, i - startOffset - daysInMonth + 1); cur = false; }
    else { d = new Date(year, month, i - startOffset + 1); }
    cells.push({ date: d, cur });
  }
  const byDate = {};
  events.forEach(ev => {
    if (!visibleGrades.has(-1) && !visibleGrades.has(ev.gradeIdx)) return;
    if (!byDate[ev.date]) byDate[ev.date] = [];
    byDate[ev.date].push(ev);
  });
  const [overflow, setOverflow] = useState(null);
  return (
    <>
    <div className='hod-cal-grid' role='grid' aria-label={MONTHS[month]+' '+year}>
      {DOW.map(d => <div key={d} className='hod-cal-dow' role='columnheader'>{d}</div>)}
      {cells.map(({ date, cur }) => {
        const k = dateKey(date);
        const cell = byDate[k] || [];
        const isToday = date.getTime() === today.getTime();
        const MAX = 3; const shown = cell.slice(0, MAX); const extra = cell.length - MAX;
        return (
          <div key={k} className={'hod-cal-cell'+(cur?'':' faded')+(isToday?' today':'')} role='gridcell'
            aria-label={date.toLocaleDateString('en-ZA',{day:'numeric',month:'long'})+(cell.length?', '+cell.length+' event'+(cell.length>1?'s':''):'')}>
            <span className='hod-cal-day-num'>{date.getDate()}</span>
            {shown.map(ev => <EventChip key={ev.id+k} ev={ev} onClick={onEventClick} />)}
            {extra > 0 && <button className='hod-cal-more' onClick={() => setOverflow({ k, cell })} aria-label={'Show '+extra+' more events'}>+{extra} more</button>}
          </div>
        );
      })}
    </div>
    {overflow && (
      <div className='hod-cal-popover-overlay' onClick={e => e.target===e.currentTarget && setOverflow(null)}>
        <div className='hod-cal-popover'>
          <button className='hod-cal-popover-close' onClick={() => setOverflow(null)} aria-label='Close'>&times;</button>
          <h3 style={{ marginBottom:16 }}>{isoToDate(overflow.k).toLocaleDateString('en-ZA',{weekday:'long',day:'numeric',month:'long'})}</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {overflow.cell.map(ev => <EventChip key={ev.id} ev={ev} onClick={e => { setOverflow(null); onEventClick(e); }} />)}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function ListView({ events, visibleGrades }) {
  const [selected, setSelected] = useState(null);
  const filtered = useMemo(() =>
    [...events].filter(ev => visibleGrades.has(-1) || visibleGrades.has(ev.gradeIdx)).sort((a,b) => a.date.localeCompare(b.date)),
    [events, visibleGrades]);
  if (!filtered.length) return <p style={{ color:'#575779', marginTop:20 }}>No events match the selected filters.</p>;
  const weeks = [];
  let curWk = null, curLabel = '';
  filtered.forEach(ev => {
    const lbl = weekLabel(isoToDate(ev.date));
    if (lbl !== curLabel) { curWk = { label: lbl, events: [] }; weeks.push(curWk); curLabel = lbl; }
    curWk.events.push(ev);
  });
  return (
    <div className='hod-cal-list'>
      <EventPopover ev={selected} onClose={() => setSelected(null)} />
      {weeks.map(wk => (
        <div key={wk.label} className='hod-cal-week'>
          <div className='hod-cal-week-label'>{wk.label}</div>
          {wk.events.map(ev => {
            const d = isoToDate(ev.date);
            const ts = typeStyle(ev.type);
            const gi = ev.gradeIdx >= 0 ? ev.gradeIdx : 0;
            return (
              <button key={ev.id} className='hod-cal-event-row' onClick={() => setSelected(ev)}
                aria-label={ev.type+': '+ev.title+' \u2013 Grade '+ev.room+' \u2013 '+ev.teacher}>
                <div className='hod-cal-event-bar' style={{ background: ts.bar }} aria-hidden='true' />
                <div className='hod-cal-event-date'>
                  <div className='day-num'>{d.getDate()}</div>
                  <div className='day-name'>{DOW[d.getDay()]}</div>
                </div>
                <div className='hod-cal-event-body'>
                  <div className='hod-cal-event-title'>{ev.title}</div>
                  <div className='hod-cal-event-meta'>
                    <span className='hod-cal-grade-tag' style={{ background:GRADE_BG[gi]||GRADE_BG[0], color:GRADE_DOT[gi]||GRADE_DOT[0] }}>
                      <span style={{ width:7, height:7, borderRadius:'50%', background:GRADE_DOT[gi]||GRADE_DOT[0], display:'inline-block' }} aria-hidden='true' />
                      Grade {ev.room}
                    </span>
                    <span className={'hod-cal-type-tag ' + ts.chip}>{ev.type}</span>
                    <span>{ev.teacher}</span>
                  </div>
                  {ev.detail && <div className='hod-cal-event-meta' style={{ marginTop:4 }}>{ev.detail}</div>}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function HodCalendar({ data, plans }) {
  const [year, setYear]           = useState(2026);
  const [month, setMonth]         = useState(10);
  const [view, setView]           = useState('month');
  const [selGrades, setSelGrades] = useState(new Set([-1]));
  const [activeEv, setActiveEv]   = useState(null);

  const events = useMemo(() => buildEvents(data.classes, data.directives, plans), [data, plans]);
  const visibleEvents = useMemo(() => {
    if (view === 'list') return events.filter(ev => ev.date >= '2026-11-01');
    const pad = n => String(n).padStart(2,'0');
    const cur  = year+'-'+pad(month+1);
    const prev = month===0  ? (year-1)+'-12'   : year+'-'+pad(month);
    const next = month===11 ? (year+1)+'-01'   : year+'-'+pad(month+2);
    return events.filter(ev => ev.date.startsWith(cur)||ev.date.startsWith(prev)||ev.date.startsWith(next));
  }, [events, year, month, view]);

  const prevMon = () => { if(month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1); };
  const nextMon = () => { if(month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1); };
  const toggleGrade = idx => {
    setSelGrades(prev => {
      const next = new Set(prev);
      if (idx===-1) return new Set([-1]);
      next.delete(-1);
      if (next.has(idx)) { next.delete(idx); if(next.size===0) return new Set([-1]); }
      else next.add(idx);
      return next;
    });
  };

  const LEGEND = [
    { label: 'Test / Spelling', ...TYPE_STYLE['Test'] },
    { label: 'Exam',            ...TYPE_STYLE['Exam'] },
    { label: 'Homework',        ...TYPE_STYLE['Homework'] },
    { label: 'Directive',       ...TYPE_STYLE['Directive'] },
  ];

  return (
    <div className='hod-panel'>
      <div className='hod-cal-header'>
        <div>
          <h2>Term calendar</h2>
          <p style={{ margin:0, fontSize:13, color:'#575779' }}>Schoolwork and directives aligned per grade and teacher. Click any event for details.</p>
        </div>
        <div className='hod-cal-view-toggle' aria-label='Switch calendar view'>
          <button className={view==='month'?'active':''} onClick={() => setView('month')} aria-pressed={view==='month'}>&#9638; Month</button>
          <button className={view==='list' ?'active':''} onClick={() => setView('list')}  aria-pressed={view==='list'}>&#9776; List</button>
        </div>
      </div>
      <div className='hod-cal-filters' role='group' aria-label='Filter by grade'>
        <button className={'hod-cal-filter-all'+(selGrades.has(-1)?' active':'')} onClick={() => toggleGrade(-1)} aria-pressed={selGrades.has(-1)}>All grades</button>
        {data.classes.map((cl, idx) => {
          const dot = GRADE_DOT[idx]||GRADE_DOT[0], bg = GRADE_BG[idx]||GRADE_BG[0], active = selGrades.has(idx);
          return (
            <button key={cl.grade} className={'hod-cal-filter'+(active?' active':'')}
              style={active ? { borderColor:dot, background:bg, color:dot } : {}}
              onClick={() => toggleGrade(idx)} aria-pressed={active}>
              <span className='hod-grade-dot' style={{ background:dot }} aria-hidden='true' />
              Grade {cl.room}
              <span style={{ fontWeight:600, opacity:.7, fontSize:11 }}>{cl.teacher}</span>
            </button>
          );
        })}
      </div>
      {view==='month' && (
        <div className='hod-cal-nav'>
          <button onClick={prevMon} aria-label='Previous month'>&#8249; Prev</button>
          <span className='hod-cal-month-label'>{MONTHS[month]} {year}</span>
          <button onClick={nextMon} aria-label='Next month'>Next &#8250;</button>
        </div>
      )}
      {view==='month' && (
        <>
          <EventPopover ev={activeEv} onClose={() => setActiveEv(null)} />
          <MonthGrid year={year} month={month} events={visibleEvents} visibleGrades={selGrades} onEventClick={setActiveEv} />
        </>
      )}
      {view==='list' && <ListView events={visibleEvents} visibleGrades={selGrades} />}
      <div className='hod-cal-legend' aria-label='Event type colour key'>
        {LEGEND.map(l => (
          <span key={l.label} className='hod-cal-legend-item'>
            <span className='hod-cal-legend-swatch' style={{ background:l.bg, border:'1.5px solid '+l.bar }} aria-hidden='true' />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
