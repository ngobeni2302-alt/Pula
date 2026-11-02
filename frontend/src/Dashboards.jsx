// @ts-nocheck
import React, { useState } from 'react';
import { ArrowLeft, BookOpen, MessageCircle, CalendarDays, Home, TrendingUp, Download, ChevronRight, Mic, Check, Leaf, Bean, Sprout, Flower2, TreeDeciduous, CircleAlert, Clock } from 'lucide-react';
import HodDashboard from './hod/HodDashboard.jsx';
import TeacherApp from '../../teacher/App.jsx';
import MessagingHub from './messaging/MessagingHub.jsx';
import SchoolCalendar from './calendar/SchoolCalendar.jsx';
import ReadingTierList from './learners/ReadingTierList.jsx';
import LearnerProfile from './learners/LearnerProfile.jsx';
import TeacherReadingExperience from './reading/TeacherReadingExperience.jsx';
import { GROUPS, TOPICS, PLANS, loadData, STORAGE_KEY, tips } from './dashboardData.js';
import './dashboards.css';
import WelcomeScreen from './WelcomeScreen.jsx';

const uid = () => crypto.randomUUID();
const date = d => new Date(`${d}T12:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
function GroupIcon({ group, size = 22 }) { const Icon = { Seed: Bean, Sprout, Bloom: Flower2, Tree: TreeDeciduous }[group] || Leaf; return <Icon size={size} aria-hidden="true" />; }
function Status({ value }) { const Icon = value === 'Done' ? Check : value === 'In progress' ? Clock : CircleAlert; return <span className={`pd-status ${value === 'Done' ? 'done' : value === 'In progress' ? 'pending' : 'attention'}`}><Icon size={15} aria-hidden="true" />{value}</span>; }
function Choices({ values, value, onChange }) { return <div className="pd-choices">{values.map(v => <button key={v} aria-pressed={value === v} className={value === v ? 'active' : ''} onClick={() => onChange(v)}>{value === v && <Check size={14} aria-hidden="true" />}{v}</button>)}</div>; }
function Card({ children, className = '' }) { return <section className={`pd-card ${className}`}>{children}</section>; }
function Chart({ history }) { return <div className="pd-chart" aria-label={`Words per minute by term: ${history.join(', ')}`}>{history.map((v, i) => <div key={i}><b>{v}</b><span style={{ height: `${Math.max(5, v / Math.max(...history) * 100)}px` }} /><small>Term {i + 1}</small></div>)}</div>; }
function Field({ label, children }) { return <label className="pd-field"><span>{label}</span>{children}</label>; }

export default function Dashboards() {
    const [data, setData] = useState(loadData);
    const [profile, setProfile] = useState(null);
    const [switchCount, setSwitchCount] = useState(0);
    const [page, setPage] = useState('Home');
    const [filter, setFilter] = useState('All');
    const [notice, setNotice] = useState('');
    const [resource, setResource] = useState(null);
    const [legacy, setLegacy] = useState(false);
    const [saved, setSaved] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('pula_offline_plans') || '{}');
        } catch {
            return {};
        }
    });
    const [msgLearnerId, setMsgLearnerId] = useState(null);
    const [msgTopic, setMsgTopic] = useState(null);
    const [tierView, setTierView] = useState('All');
    const [activeLearnerId, setActiveLearnerId] = useState(null);
    const persist = next => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setData(next); return true; } catch { setNotice('Storage is full or unavailable. Your change was not saved.'); return false; } };
    const updateClass = (grade, fn) => persist({ ...data, classes: data.classes.map(c => c.grade === grade ? fn(c) : c) });
    const c = data.classes.find(c => c.grade === profile?.grade) || data.classes[2];
    const child = c.learners.find(l => l.id === profile?.childId) || c.learners[0];
    const selectedLearner = c.learners.find(l => l.id === activeLearnerId) || c.learners[0];
    const teacher = profile?.role === 'Teacher';
    const select = p => { setProfile(p); setPage('Home'); setResource(null); setNotice(''); setTierView('All'); setActiveLearnerId(null); setSwitchCount(n => n + 1); };
    function startMessage(topic = 'Progress', item = null, learnerId = null) { setMsgLearnerId(learnerId || null); setMsgTopic(topic || null); setPage('Messages'); }

    const nav = teacher ? [['Home', Home], ['Read', Mic], ['Planner', CalendarDays], ['Messages', MessageCircle]] : [['Home', Home], ['Progress', TrendingUp], ['Schoolwork', BookOpen], ['Messages', MessageCircle]];
    const changePage = p => { if (p === 'Groups') { setTierView('All'); setActiveLearnerId(null); setPage('TierLearners'); } else { setPage(p); } setMsgLearnerId(null); setMsgTopic(null); setNotice(''); setFilter('All'); };
    if (legacy) return <><div className="pd-legacy"><button onClick={() => setLegacy(false)}>← Back to dashboards</button><span>Original reading demo · separate data</span></div><TeacherApp /></>;
    if (!profile) return <WelcomeScreen key={switchCount} classes={data.classes} onSelect={select} />;
    const header = <header className="pd-top"><button onClick={() => { setProfile(null); setLegacy(false); setSwitchCount(n => n + 1); }}><ArrowLeft size={16} /> Switch profile</button><span><Leaf size={16} /> Pula · {profile.role}</span></header>;

    // HOD dashboard from main
    if (profile.role === 'HOD') return <HodDashboard onBack={() => { setProfile(null); setLegacy(false); }} />;

    return (
        <div className={`pd-shell ${page === 'Messages' ? 'pd-messages-active' : page === 'Read' ? 'pd-reading-active' : 'pd-mobile'}`}>
            {page !== 'Read' && header}
            <main>
                {page !== 'Messages' && page !== 'TierLearners' && page !== 'LearnerProfile' && page !== 'Read' && (
                    <div className="pd-heading">
                        <div>
                            <span className="pd-eyebrow">GRADE {c.grade} ONLY · TERM 4</span>
                            <h1>{page === 'Home' ? (teacher ? `Good morning, ${c.teacher}!` : 'Sawubona!') : page}</h1>
                            <p>{teacher ? `Grade ${c.room} · ${c.learners.length} learners` : `${child.name} · Grade ${c.room} · ${c.teacher}’s class`}</p>
                        </div>
                    </div>
                )}
                {page !== 'Read' && notice && <div role="status" className="pd-note">{notice}</div>}
                {page === 'Home' && teacher && (
                    <>
                        <Choices values={['English', 'Maths']} value={filter === 'All' ? 'English' : filter} onChange={setFilter} />
                        <Card className="pd-coral">
                            <div className="pd-split">
                                <span className="pd-tag">Now · {filter === 'Maths' ? 'Mathematics' : c.grade === 'R' ? 'Listening and speaking' : 'Home Language'}</span>
                                <small>{c.heard} of {c.learners.length} heard</small>
                            </div>
                            <h2>{c.grade === 'R' ? 'Sound and rhyme round' : 'Reading round'}</h2>
                            <button className="pd-primary" onClick={() => changePage('Read')}><Mic size={18} /> Continue reading round</button>
                        </Card>
                        <div className="pd-section">
                            <h2>This week for parents</h2>
                            <button onClick={() => changePage('Planner')}>Planner →</button>
                        </div>
                        <div className="pd-week">
                            {c.items.slice(0, 3).map(i => (
                                <button key={i.id} onClick={() => { changePage('Planner'); setFilter(i.type); }}>
                                    <span className={`pd-work-badge work-${i.type.toLowerCase().replaceAll(" ", "-")}`}><BookOpen size={15} aria-hidden="true" />{i.type}</span>
                                    <b>{i.title}</b>
                                    <span>{date(i.date)}</span>
                                </button>
                            ))}
                        </div>
                        <div className="pd-section">
                            <h2>Reading groups</h2>
                            <button onClick={() => { setTierView('All'); setActiveLearnerId(null); setPage('TierLearners'); }}>See all →</button>
                        </div>
                        <div className="pd-groups pd-teacher-groups">
                            {GROUPS.map((g, i) => (
                                <button className={`pd-group g${i}`} key={g} onClick={() => { setTierView(g); setActiveLearnerId(null); setPage('TierLearners'); }}>
                                    <GroupIcon group={g} />
                                    <b>{c.learners.filter(l => l.group === g).length}</b>
                                    <small>{g}</small>
                                </button>
                            ))}
                        </div>
                        {[
                            ['Guidelines', `Grade ${c.grade} guidelines and resources`, 'CAPS plan, weekly focus and teaching resources', BookOpen],
                            ['Messages', 'Parent messages', 'Message a group or one parent', MessageCircle],
                            ['Planner', 'Class planner', 'Tests, exams, spelling and homework', CalendarDays]
                        ].map(([target, title, sub, Icon]) => (
                            <button className="pd-row pd-card" key={target} onClick={() => changePage(target)}>
                                <span className="pd-icon"><Icon /></span>
                                <span><b>{title}</b><small>{sub}</small></span>
                                <ChevronRight />
                            </button>
                        ))}
                        <button className="pd-note pd-full" onClick={() => changePage('Messages')}>
                            {data.messages.filter(m => m.grade === c.grade && m.status === 'draft').length} parent notes ready · Lesedi drafts, you approve →
                        </button>
                    </>
                )}
                {page === 'Guidelines' && (
                    <>
                        <button className="pd-link" onClick={() => changePage('Home')}>← Class home</button>
                        <Card>
                            <span className="pd-pill">Grade {c.grade} · This week</span>
                            <h2>{c.focus}</h2>
                            <p>{c.description}</p>
                            <div className="pd-split"><b>Term 4 plan (ATP)</b><small>Week 4 of 9</small></div>
                            <progress value={4} max={9} />
                        </Card>
                        <h2>How to teach it</h2>
                        <Card><ol>{c.steps.map(s => <li key={s}>{s}</li>)}</ol></Card>
                        <h2>Resources for Grade {c.grade}</h2>
                        {c.resources.map((r, i) => (
                            <button key={r} className="pd-card pd-row" onClick={() => setResource(resource === i ? null : i)}>
                                <b>{r}</b><small>{i % 2 ? 'Printable' : 'Activity'}</small>
                            </button>
                        ))}
                        {typeof resource === 'number' && (
                            <Card>
                                <h3>{c.resources[resource]}</h3>
                                <p>{c.steps[resource % 3]}</p>
                                <ol>
                                    <li>Model the activity with the class.</li>
                                    <li>Practise together in pairs using familiar words or objects.</li>
                                    <li>Ask each learner to demonstrate and record who needs support.</li>
                                </ol>
                                <p className="pd-muted">Editable demonstration resource; curriculum review pending.</p>
                            </Card>
                        )}
                        <button className="pd-primary pd-full" onClick={() => { try { const next = { ...saved, [c.grade]: { ...c, savedAt: new Date().toISOString() } }; localStorage.setItem('pula_offline_plans', JSON.stringify(next)); setSaved(next); setNotice('Weekly plan and all four built-in resource guides saved on this device.'); } catch { setNotice('Offline save failed. Check available device storage.'); } }}>
                            <Download size={18} /> {saved[c.grade] ? 'Update offline copy' : 'Save for offline use'}
                        </button>
                        {saved[c.grade] && <p className="pd-muted">Saved {new Date(saved[c.grade].savedAt).toLocaleString('en-ZA')} · Available in this installed app offline.</p>}
                        <p className="pd-muted">Sample guidance based on the reference. CAPS/ATP content needs curriculum review.</p>
                    </>
                )}
                {page === 'TierLearners' && (
                    <ReadingTierList classroom={c} initialTier={tierView} onSelectLearner={id => { setActiveLearnerId(id); setPage('LearnerProfile'); }} onBack={() => changePage('Home')} />
                )}
                {page === 'LearnerProfile' && selectedLearner && (
                    <LearnerProfile learner={selectedLearner} classroom={c} selectedTier={tierView || 'All'} onBack={() => setPage('TierLearners')} onUpdateLearner={upd => { updateClass(c.grade, old => ({ ...old, learners: old.learners.map(l => l.id === upd.id ? { ...l, ...upd } : l) })); setNotice(`Academic profile updated for ${upd.name}.`); }} onStartMessage={(topic, item, lid) => startMessage(topic, item, lid)} />
                )}
                {page === 'Read' && (
                    <TeacherReadingExperience
                        classroom={c}
                        onBack={() => changePage('Home')}
                        onSaveSession={(learnerId, { wpm, duration, taskTitle }) => {
                            updateClass(c.grade, old => {
                                const wasAssessed = (old.assessedIds || []).includes(learnerId);
                                const updatedHeard = wasAssessed ? old.heard : Math.min(old.learners.length, (old.heard || 0) + 1);
                                const updatedAssessedIds = [...new Set([...(old.assessedIds || []), learnerId])];
                                const updatedLearners = old.learners.map(l => {
                                    if (l.id !== learnerId) return l;
                                    const nextWpm = wpm || (l.history.at(-1) + 2);
                                    return {
                                        ...l,
                                        lastReadAt: new Date().toISOString(),
                                        lastReadTask: taskTitle,
                                        history: [...l.history.slice(0, 3), nextWpm]
                                    };
                                });
                                return {
                                    ...old,
                                    heard: updatedHeard,
                                    assessedIds: updatedAssessedIds,
                                    learners: updatedLearners
                                };
                            });
                            setNotice(`Reading session completed for ${c.learners.find(l => l.id === learnerId)?.name || 'learner'}!`);
                        }}
                    />
                )}
                {(page === 'Planner' || page === 'Schoolwork') && (
                    <>
                        <Choices values={['All', 'Test', 'Exam', 'Spelling test', 'Homework']} value={filter} onChange={setFilter} />
                        {teacher && (
                            <Card>
                                <h2>Add schoolwork</h2>
                                <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); if (updateClass(c.grade, old => ({ ...old, items: [...old.items, { id: uid(), type: f.get('type'), title: f.get('title').trim(), date: f.get('date'), detail: f.get('detail').trim(), told: false }] }))) { e.currentTarget.reset(); setNotice('Schoolwork added. Parents can see it in their dashboard.'); } }}>
                                    <div className="pd-form-grid">
                                        <Field label="Type"><select name="type">{TOPICS.slice(1).map(t => <option key={t}>{t}</option>)}</select></Field>
                                        <Field label="Date"><input required type="date" name="date" /></Field>
                                    </div>
                                    <Field label="Title"><input required name="title" /></Field>
                                    <Field label="Parent guidance"><input name="detail" /></Field>
                                    <button className="pd-primary">Add item</button>
                                </form>
                            </Card>
                        )}
                        <SchoolCalendar role={profile.role} classroom={c} classes={data.classes} items={c.items.filter(i => filter === 'All' || i.type === filter)} onDeleteItem={id => { updateClass(c.grade, old => ({ ...old, items: old.items.filter(i => i.id !== id) })); setNotice('Schoolwork removed from calendar.'); }} onEditItem={upd => { updateClass(c.grade, old => ({ ...old, items: old.items.map(i => i.id === upd.id ? upd : i) })); setNotice('Schoolwork updated on calendar.'); }} onNotifyParents={(type, item) => startMessage(type, item)} childrenList={!teacher ? [{ id: child.id, name: child.name, grade: c.grade }, ...(data.classes.filter(cl => cl.grade !== c.grade).slice(0, 1).map(cl => ({ id: cl.learners[1]?.id || `${cl.grade}-2`, name: cl.learners[1]?.name || 'Lerato', grade: cl.grade })))] : []} activeChildId={child?.id} onSelectChild={cid => { const target = data.classes.find(cl => cl.learners.some(l => l.id === cid)); if (target) setProfile(p => ({ ...p, grade: target.grade, childId: cid })); }} />
                    </>
                )}
                {!teacher && page === 'Home' && (
                    <>
                        <Card>
                            <small>{child.name}’s reading group</small>
                            <h2 className="pd-group-title">{child.group}</h2>
                            <div className="pd-groups">
                                {GROUPS.map((g, i) => (
                                    <span className={`pd-group g${i} ${child.group === g ? 'current' : ''}`} key={g}>
                                        <GroupIcon group={g} />
                                        <b>{g}</b>
                                        {child.group === g && <span className="pd-selected"><Check size={12} aria-hidden="true" />Current</span>}
                                    </span>
                                ))}
                            </div>
                            <p>Only {c.teacher} can change {child.name}’s group.</p>
                        </Card>
                        <Card>
                            <div className="pd-split">
                                <h2>Reading speed</h2>
                                <small>Up {child.history.at(-1) - child.history[0]} since Term 1</small>
                            </div>
                            <strong className="pd-number">{child.history.at(-1)}</strong>
                            <span>words a minute</span>
                        </Card>
                        <div className="pd-section">
                            <h2>Coming up</h2>
                            <button onClick={() => changePage('Schoolwork')}>See all →</button>
                        </div>
                        {c.items.slice(0, 3).map(i => (
                            <Card key={i.id}>
                                <div className="pd-row">
                                    <span className="pd-date">{date(i.date)}</span>
                                    <span><b>{i.title}</b><small>{i.type} · {i.detail}</small></span>
                                </div>
                            </Card>
                        ))}
                        <button className="pd-card pd-row" onClick={() => changePage('Messages')}>
                            <MessageCircle />
                            <span><b>Message {c.teacher}</b><small>{data.messages.filter(m => m.sender === 'teacher' && m.status === 'sent' && m.recipientIds.includes(child.id)).length} teacher messages</small></span>
                            <ChevronRight />
                        </button>
                        <Card className="pd-lavender">
                            <h3>Try this at home</h3>
                            <p>{tips(child)[1]}</p>
                            <small>From {c.teacher}</small>
                        </Card>
                    </>
                )}
                {!teacher && page === 'Progress' && (
                    <>
                        <Card>
                            <h2>Reading speed</h2>
                            <p>Words per minute, by term</p>
                            <Chart history={child.history} />
                            <small>Term 4 is still in progress</small>
                        </Card>
                        <Card>
                            <h3>Reading group: {child.group}</h3>
                            <p>Only {c.teacher} can change this.</p>
                            <h3>What {child.name} can improve</h3>
                            <small>From {c.teacher} · This week</small>
                            <ol>{tips(child).map(t => <li key={t}>{t}</li>)}</ol>
                            <span className="pd-pill">Sounds to practise: {child.sounds.join(', ')}</span>
                        </Card>
                    </>
                )}
                {page === 'Messages' && (
                    <MessagingHub profile={profile} classroom={c} classes={data.classes} initialLearnerId={msgLearnerId} initialTopic={msgTopic} onNavigateHome={() => changePage('Home')} />
                )}
            </main>
            {page !== 'Read' && (
                <nav className="pd-nav" aria-label={`${profile.role} navigation`}>
                    {nav.map(([name, Icon]) => {
                        const active = page === name || (name === 'Home' && (page === 'TierLearners' || page === 'LearnerProfile'));
                        return (
                            <button key={name} aria-current={active ? 'page' : undefined} className={active ? 'active' : ''} onClick={() => changePage(name)}>
                                <Icon size={19} />
                                <small>{name}</small>
                            </button>
                        );
                    })}
                </nav>
            )}
        </div>
    );
}
