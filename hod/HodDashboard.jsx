import React, { useState } from 'react';
import { ArrowLeft, Leaf, CircleAlert, Clock, Check } from 'lucide-react';
import { loadData, PLANS, STORAGE_KEY, mean } from '../frontend/src/dashboardData.js';
import './HodDashboard.css';

const uid = () => crypto.randomUUID();
const fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });

const CODE_COLORS = { 1: 'var(--code1)', 2: 'var(--code2)', 3: 'var(--code3)', 4: 'var(--code4)', 5: 'var(--code5)', 6: 'var(--code6)', 7: 'var(--code7)' };
const CODE_LABELS = { 1: 'Code 1 - 0 to 29%', 2: 'Code 2 - 30 to 39%', 3: 'Code 3 - 40 to 49%', 4: 'Code 4 - 50 to 59%', 5: 'Code 5 - 60 to 69%', 6: 'Code 6 - 70 to 79%', 7: 'Code 7 - 80 to 100%' };

function supportTierShare(cl) {
  return Math.round((cl.learners.filter(l => l.code <= 2).length / cl.learners.length) * 100);
}

// ── Stacked Bar ─────────────────────────────────────
function StackedBar({ classroom }) {
  const [tip, setTip] = useState(null);
  const counts = {};
  classroom.learners.forEach(l => { counts[l.code] = (counts[l.code] || 0) + 1; });
  const total = classroom.learners.length;
  const segments = [1,2,3,4,5,6,7].filter(c => counts[c]).map(c => ({ code: c, count: counts[c], pct: (counts[c] / total) * 100 }));
  const ariaLabel = 'Code distribution for Grade ' + classroom.room + ': ' + segments.map(s => 'Code ' + s.code + ': ' + s.count + ' learners').join(', ');
  return (
    <div className='hod-bar-wrap' role='img' aria-label={ariaLabel}>
      {segments.map((seg, idx) => (
        <div
          key={seg.code}
          className='hod-segment'
          style={{ width: seg.pct + '%', background: CODE_COLORS[seg.code] }}
          aria-label={'Code ' + seg.code + ': ' + seg.count + ' learners'}
          onMouseEnter={() => setTip(idx)}
          onMouseLeave={() => setTip(null)}
        >
          {seg.pct >= 10 && <span className='hod-seg-label'>{seg.count}</span>}
          {tip === idx && (
            <div className='hod-tooltip' role='tooltip'>
              Code {seg.code} {String.fromCharCode(183)} {seg.count} learner{seg.count !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Flag Badge ──────────────────────────────────────
function FlagBadge({ classroom }) {
  const current = mean(classroom);
  const prev = classroom.previousAverage;
  const share = supportTierShare(classroom);
  const hasDanger = current < prev;
  const hasWarning = share > 25;
  if (!hasDanger && !hasWarning) return <div className='hod-flags'><span className='hod-flag hod-flag-steady'>Steady</span></div>;
  return (
    <div className='hod-flags'>
      {hasDanger && <span className='hod-flag hod-flag-danger'>Average down {prev - current} points</span>}
      {hasWarning && <span className='hod-flag hod-flag-warning'>High share in codes 1 and 2</span>}
    </div>
  );
}

// ── Status Chip ─────────────────────────────────────
function StatusChip({ value }) {
  const cls = value === 'Done' ? 'done' : value === 'In progress' ? 'pending' : '';
  const Icon = value === 'Done' ? Check : value === 'In progress' ? Clock : CircleAlert;
  return <span className={'hod-status ' + cls}><Icon size={14} aria-hidden='true' />{value}</span>;
}

// ── Field wrapper ────────────────────────────────────
function Field({ label, children }) {
  return <label className='hod-field'><span>{label}</span>{children}</label>;
}

// ── Worth a look ─────────────────────────────────────
function InsightPanel({ classes }) {
  const byShare = [...classes].sort((a, b) => supportTierShare(b) - supportTierShare(a));
  const topShare = byShare[0];
  const drops = classes.map(cl => ({ cl, drop: cl.previousAverage - mean(cl) })).filter(x => x.drop > 0).sort((a, b) => b.drop - a.drop);
  const topDrop = drops[0];
  return (
    <div className='hod-insight' role='note'>
      <span className='hod-insight-label'>Worth a look</span>
      {topShare && (
        <p>
          <strong>Grade {topShare.room}</strong> has the highest Support Tier share at{' '}
          <strong>{supportTierShare(topShare)}%</strong> of learners in codes 1 and 2.
          {topDrop && topDrop.cl.grade !== topShare.grade
            ? ' Grade ' + topDrop.cl.room + String.fromCharCode(39) + 's average also fell ' + topDrop.drop + ' point' + (topDrop.drop !== 1 ? 's' : '') + '. Both are tracked in Interventions.'
            : ' This is tracked in Interventions.'
          }
        </p>
      )}
      {topDrop && topDrop.cl.grade === topShare?.grade && (
        <p>
          <strong>Grade {topDrop.cl.room}</strong>'s average fell{' '}
          <strong>{topDrop.drop} point{topDrop.drop !== 1 ? 's' : ''}</strong> compared to
          the previous term. Tracked in Interventions.
        </p>
      )}
    </div>
  );
}

// ── Class Performance tab ────────────────────────────
function ClassPerformanceTab({ data }) {
  return (
    <div className='hod-panel'>
      <h2>Class performance and variance</h2>
      <p className='hod-panel-sub'>Share of learners in each code, Term 4 so far. Example data.</p>
      <div className='hod-legend' aria-label='Assessment code colour key'>
        {[1,2,3,4,5,6,7].map(c => (
          <span key={c} className='hod-legend-item'>
            <span className='hod-swatch' style={{ background: CODE_COLORS[c] }} aria-hidden='true' />
            {CODE_LABELS[c]}
          </span>
        ))}
      </div>
      <div className='hod-table-wrap'>
        <table className='hod-table'>
          <thead><tr><th>Class</th><th>Codes 1 to 7</th><th>Average</th><th>Support Tier</th><th>Flag</th></tr></thead>
          <tbody>
            {data.classes.map(cl => {
              const current = mean(cl);
              const diff = Math.abs(current - cl.previousAverage);
              const trend = current >= cl.previousAverage ? 'Up ' + diff : 'Down ' + diff;
              return (
                <tr key={cl.grade}>
                  <td><div className='hod-class-name'>Grade {cl.room}</div><div className='hod-class-teacher'>{cl.teacher} {String.fromCharCode(183)} {cl.learners.length} learners</div></td>
                  <td className='hod-bar-cell'><StackedBar classroom={cl} /></td>
                  <td><div className='hod-avg-current'>{current}%</div><div className='hod-avg-prev'>{trend} point{diff !== 1 ? 's' : ''}</div></td>
                  <td><div className='hod-avg-current'>{supportTierShare(cl)}%</div><div className='hod-avg-prev'>in codes 1 and 2</div></td>
                  <td><FlagBadge classroom={cl} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <InsightPanel classes={data.classes} />
    </div>
  );
}

// ── CAPS Tracker tab ─────────────────────────────────
function CapsTrackerTab({ data, updateClass }) {
  return (
    <div className='hod-panel'>
      <h2>Lesson logs against the ATP</h2>
      <p className='hod-panel-sub'>Sample Term 4, Week 4 plan. Tick a lesson to record completion.</p>
      <div className='hod-table-wrap'>
        <table className='hod-table'>
          <thead><tr><th>Class</th><th>Phonics / sounds</th><th>Shared reading</th><th>Guided reading</th><th>Writing / mark making</th><th>Completed</th></tr></thead>
          <tbody>
            {data.classes.map(cl => (
              <tr key={cl.grade}>
                <td>Grade {cl.room}</td>
                {cl.logs.map((done, i) => (
                  <td key={i}>
                    <label>
                      <input type='checkbox' checked={done} aria-label={'Grade ' + cl.grade + ' ' + ['sounds','shared reading','guided reading','writing'][i] + ' completed'} onChange={() => updateClass(cl.grade, old => ({ ...old, logs: old.logs.map((x,j) => i===j ? !x : x) }))} />
                      {' '}{done ? 'Logged' : 'Behind'}
                    </label>
                  </td>
                ))}
                <td>{cl.logs.filter(Boolean).length}/4</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Teacher Logs tab ─────────────────────────────────
function TeacherLogsTab({ data, persist, setNotice }) {
  return (
    <div className='hod-panel'>
      <h2>Confidential teacher observations</h2>
      <p className='hod-panel-sub'>HOD workspace. These notes are excluded from teacher and parent screens.</p>
      <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); if (persist({ ...data, observations: [{ id: uid(), grade: f.get('grade'), text: f.get('text').trim(), date: f.get('date') }, ...data.observations] })) { e.currentTarget.reset(); setNotice('Confidential observation saved.'); } }}>
        <div className='hod-form-grid'>
          <Field label='Teacher'><select name='grade'>{PLANS.map(p => <option key={p.grade} value={p.grade}>{p.teacher} {String.fromCharCode(183)} {p.room}</option>)}</select></Field>
          <Field label='Observation date'><input required type='date' name='date' defaultValue='2026-11-01' /></Field>
        </div>
        <Field label='Observation and follow-up'><textarea required name='text' minLength={3} /></Field>
        <button className='hod-primary'>Save confidential note</button>
      </form>
      <h3>Earlier observations</h3>
      {!data.observations.length && <p>No observations yet.</p>}
      {data.observations.map(o => (
        <div className='hod-row' key={o.id}>
          <div><b>{PLANS.find(p => p.grade === o.grade)?.teacher} {String.fromCharCode(183)} {fmtDate(o.date)}</b><p>{o.text}</p></div>
        </div>
      ))}
    </div>
  );
}

// ── Interventions tab ────────────────────────────────
function InterventionsTab({ data, updateClass }) {
  return (
    <div className='hod-panel'>
      <h2>Support Tier interventions</h2>
      <p className='hod-panel-sub'>Codes 1 and 2. Review strategies when the latest term shows no improvement.</p>
      <div className='hod-table-wrap'>
        <table className='hod-table'>
          <thead><tr><th>Learner</th><th>Teacher strategy</th><th>Reading speed</th><th>Review date</th><th>Next step</th></tr></thead>
          <tbody>
            {data.classes.flatMap(cl => cl.learners.filter(l => l.code <= 2).map(l => (
              <tr key={l.id}>
                <td><b>{l.name}</b><small>Grade {cl.room} {String.fromCharCode(183)} Code {l.code}</small></td>
                <td><input aria-label={'Strategy for ' + l.name + ' in ' + cl.room} value={l.strategy} onChange={e => updateClass(cl.grade, old => ({ ...old, learners: old.learners.map(x => x.id === l.id ? { ...x, strategy: e.target.value } : x) }))} /></td>
                <td>{l.history.at(-2)} {String.fromCharCode(8594)} {l.history.at(-1)} WPM<small>{l.history.at(-1) - l.history.at(-2)} change</small></td>
                <td><input type='date' aria-label={'Review date for ' + l.name + ' in ' + cl.room} value={l.review} onChange={e => updateClass(cl.grade, old => ({ ...old, learners: old.learners.map(x => x.id === l.id ? { ...x, review: e.target.value } : x) }))} /></td>
                <td>{l.history.at(-1) <= l.history.at(-2) ? <span className='hod-flag hod-flag-danger'><CircleAlert size={13} aria-hidden='true' />Stalled</span> : 'Continue; reassess at review date.'}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Action Items tab ─────────────────────────────────
function ActionItemsTab({ data, persist, setNotice }) {
  return (
    <div className='hod-panel'>
      <h2>Action item follow-up</h2>
      <p className='hod-panel-sub'>Directives, ownership and progress.</p>
      <div className='hod-table-wrap'>
        <table className='hod-table'>
          <thead><tr><th>Directive</th><th>Teacher</th><th>Due</th><th>Status</th></tr></thead>
          <tbody>
            {data.directives.map(d => (
              <tr key={d.id}>
                <td>{d.text}</td>
                <td>{PLANS.find(p => p.grade === d.grade)?.teacher}</td>
                <td>{fmtDate(d.due)}</td>
                <td>
                  <StatusChip value={d.status} />
                  <select aria-label={'Status: ' + d.text} value={d.status} onChange={e => persist({ ...data, directives: data.directives.map(x => x.id === d.id ? { ...x, status: e.target.value } : x) })}>
                    {['Open','In progress','Done'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className='hod-note'>
        <h3 style={{ margin: '0 0 12px' }}>Give a new directive</h3>
        <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); if (persist({ ...data, directives: [...data.directives, { id: uid(), grade: f.get('grade'), due: f.get('due'), text: f.get('text').trim(), status: 'Open' }] })) { e.currentTarget.reset(); setNotice('Directive issued in the demo workspace.'); } }}>
          <div className='hod-form-grid'>
            <Field label='Teacher'><select name='grade'>{PLANS.map(p => <option key={p.grade} value={p.grade}>{p.teacher} {String.fromCharCode(183)} {p.room}</option>)}</select></Field>
            <Field label='Due date'><input required name='due' type='date' /></Field>
          </div>
          <Field label='Directive'><textarea required minLength={3} name='text' /></Field>
          <button className='hod-primary'>Issue directive</button>
        </form>
      </div>
    </div>
  );
}

// ── Main HOD Dashboard ────────────────────────────────
export default function HodDashboard({ onBack }) {
  const [data, setData] = useState(loadData);
  const [tab, setTab] = useState('Class performance');
  const [notice, setNotice] = useState('');

  const persist = next => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setData(next); return true; } catch { setNotice('Storage is full. Your change was not saved.'); return false; } };
  const updateClass = (grade, fn) => persist({ ...data, classes: data.classes.map(c => c.grade === grade ? fn(c) : c) });

  const openActions = data.directives.filter(d => d.status !== 'Done').length;
  const supportTierCount = data.classes.flatMap(cl => cl.learners).filter(l => l.code <= 2).length;
  const capsBehind = data.classes.reduce((s, cl) => s + cl.logs.filter(x => !x).length, 0);

  const TABS = ['Class performance', 'CAPS tracker', 'Teacher logs', 'Interventions', 'Action items'];

  return (
    <div className='hod-shell'>
      <div className='hod-top'>
        {onBack && <button onClick={onBack} aria-label='Switch profile'><ArrowLeft size={16} aria-hidden='true' /> Switch profile</button>}
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Leaf size={15} aria-hidden='true' /> Pula {String.fromCharCode(183)} HOD</span>
      </div>

      <div className='hod-heading'>
        <div>
          <span className='hod-eyebrow'>FOUNDATION PHASE {String.fromCharCode(183)} GRADES R TO 3 {String.fromCharCode(183)} TERM 4, 2026</span>
          <h1>Quality assurance</h1>
          <p>A shared plan. A clear next step.</p>
        </div>
        <span className='hod-pill'>Term 4 sign-off due</span>
      </div>

      <div className='hod-stats'>
        {[
          ['Classes monitored', data.classes.length, '148 learners, Grades R to 3'],
          ['Support Tier learners', supportTierCount, 'Codes 1 and 2, below grade level'],
          ['CAPS areas behind', capsBehind, 'Against the Annual Teaching Plan'],
          ['Open action items', openActions, openActions + ' due this week'],
        ].map(([title, value, sub]) => (
          <div className='hod-card' key={title}>
            <small>{title}</small>
            <strong className='hod-number'>{value}</strong>
            <small>{sub}</small>
          </div>
        ))}
      </div>

      <div className='hod-tabs' role='tablist'>
        {TABS.map(t => (
          <button key={t} role='tab' aria-selected={tab === t} className={'hod-tab' + (tab === t ? ' active' : '')} onClick={() => { setTab(t); setNotice(''); }}>
            {t}
            {t === 'Action items' && <span className='hod-tab-badge' aria-label={openActions + ' open'}>{openActions}</span>}
          </button>
        ))}
      </div>

      {notice && <div role='status' className='hod-note'>{notice}</div>}

      {tab === 'Class performance' && <ClassPerformanceTab data={data} />}
      {tab === 'CAPS tracker' && <CapsTrackerTab data={data} updateClass={updateClass} />}
      {tab === 'Teacher logs' && <TeacherLogsTab data={data} persist={persist} setNotice={setNotice} />}
      {tab === 'Interventions' && <InterventionsTab data={data} updateClass={updateClass} />}
      {tab === 'Action items' && <ActionItemsTab data={data} persist={persist} setNotice={setNotice} />}

      <footer className='hod-footer'>
        Lesedi suggests, people decide. Demo data is stored on this device.
        Confidentiality requires authenticated access before real use.
      </footer>
    </div>
  );
}
