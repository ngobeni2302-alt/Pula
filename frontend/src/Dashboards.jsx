// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, MessageCircle, CalendarDays, Home, TrendingUp, Download, ChevronRight, Mic, Check, Leaf, Bean, Sprout, Flower2, TreeDeciduous, CircleAlert, Clock, Users, X, Sparkles } from 'lucide-react';
import HodDashboard from './hod/HodDashboard.jsx';
import TeacherApp from '../../teacher/App.jsx';
import MessagingHub from './messaging/MessagingHub.jsx';
import SchoolCalendar from './calendar/SchoolCalendar.jsx';
import ReadingTierList from './learners/ReadingTierList.jsx';
import LearnerProfile from './learners/LearnerProfile.jsx';
import TeacherReadingExperience from './reading/TeacherReadingExperience.jsx';
import ActivitiesHub from './activities/ActivitiesHub.jsx';
import { GROUPS, TOPICS, PLANS, loadData, STORAGE_KEY, tips } from './dashboardData.js';
import { getUnreadMessagesCountForUser, getLatestUnreadMessageForUser, formatMessageTime } from './messaging/messagingService.js';
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
    const [unreadCount, setUnreadCount] = useState(0);
    const [toastNotification, setToastNotification] = useState(null);
    const [dismissedNotificationIds, setDismissedNotificationIds] = useState(() => new Set());

    const persist = next => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setData(next); return true; } catch { setNotice('Storage is full or unavailable. Your change was not saved.'); return false; } };
    const updateClass = (grade, fn) => persist({ ...data, classes: data.classes.map(c => c.grade === grade ? fn(c) : c) });
    const c = data.classes.find(c => c.grade === profile?.grade) || data.classes[2];
    const child = c.learners.find(l => l.id === profile?.childId) || c.learners[0];
    const selectedLearner = c.learners.find(l => l.id === activeLearnerId) || c.learners[0];
    const teacher = profile?.role === 'Teacher';
    const currentGrade = String(c?.grade || profile?.grade || '2');
    const currentUserId = teacher ? `teacher-${currentGrade}` : `parent-${profile?.childId || c?.learners?.[0]?.id || '2-9'}`;

    useEffect(() => {
        if (!profile) return;
        const updateUnread = () => {
            const count = getUnreadMessagesCountForUser({ role: profile.role, userId: currentUserId, grade: currentGrade });
            setUnreadCount(count);

            if (count > 0 && page !== 'Messages') {
                const latest = getLatestUnreadMessageForUser({ role: profile.role, userId: currentUserId, grade: currentGrade });
                if (latest && !dismissedNotificationIds.has(latest.message.id || latest.conversation.id)) {
                    setToastNotification({
                        id: latest.message.id || latest.conversation.id,
                        senderName: latest.message.senderName || latest.conversation.title,
                        text: latest.message.text || latest.conversation.lastMessage,
                        time: formatMessageTime(latest.message.createdAt || latest.conversation.lastMessageAt) || 'Just now',
                        learnerId: latest.conversation.learnerId,
                        conversationId: latest.conversation.id
                    });
                }
            } else if (page === 'Messages') {
                setToastNotification(null);
            }
        };

        updateUnread();
        const handleUpdate = () => updateUnread();
        window.addEventListener('pula_messaging_update', handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener('pula_messaging_update', handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [profile, currentUserId, currentGrade, page, switchCount]);

    useEffect(() => {
        if (!toastNotification) return;
        const timer = setTimeout(() => {
            setToastNotification(null);
        }, 7000);
        return () => clearTimeout(timer);
    }, [toastNotification]);

    const select = p => { setProfile(p); setPage('Home'); setResource(null); setNotice(''); setTierView('All'); setActiveLearnerId(null); setSwitchCount(n => n + 1); };
    function startMessage(topic = 'Progress', item = null, learnerId = null) { setMsgLearnerId(learnerId || null); setMsgTopic(topic || null); setPage('Messages'); }

    const nav = teacher ? [['Home', Home], ['Activities', Sparkles], ['Students', Users], ['Planner', CalendarDays], ['Messages', MessageCircle]] : [['Home', Home], ['Progress', TrendingUp], ['Schoolwork', BookOpen], ['Messages', MessageCircle]];
    const changePage = p => { if (p === 'Groups' || p === 'Students') { setTierView('All'); setActiveLearnerId(null); setPage('Students'); } else { setPage(p); } setMsgLearnerId(null); setMsgTopic(null); setNotice(''); if (p !== 'Activities' && p !== 'Read') setFilter('All'); };
    if (legacy) return <><div className="pd-legacy"><button onClick={() => setLegacy(false)}>← Back to dashboards</button><span>Original reading demo · separate data</span></div><TeacherApp /></>;
    if (!profile) return <WelcomeScreen key={switchCount} classes={data.classes} onSelect={select} />;
    const header = <header className="pd-top"><button onClick={() => { setProfile(null); setLegacy(false); setSwitchCount(n => n + 1); }}><ArrowLeft size={16} /> Switch profile</button><span><Leaf size={16} /> Pula · {profile.role}</span></header>;

    // HOD dashboard from main
    if (profile.role === 'HOD') return <HodDashboard onBack={() => { setProfile(null); setLegacy(false); }} />;

    return (
        <div className={`pd-shell ${page === 'Messages' ? 'pd-messages-active' : (page === 'Activities' || page === 'Read') ? 'pd-reading-active pd-activities-active' : 'pd-mobile'}`}>
            {toastNotification && page !== 'Messages' && (
                <div
                    className="pd-whatsapp-toast"
                    role="alert"
                    onClick={() => {
                        const targetLid = toastNotification.learnerId;
                        setToastNotification(null);
                        startMessage('Progress', null, targetLid);
                    }}
                    title="Click to view message"
                >
                    <div className="pd-toast-icon-wrap">
                        <MessageCircle size={22} />
                    </div>
                    <div className="pd-toast-body">
                        <div className="pd-toast-header">
                            <span className="pd-toast-sender">{toastNotification.senderName}</span>
                            <span className="pd-toast-time">{toastNotification.time}</span>
                        </div>
                        <p className="pd-toast-text">{toastNotification.text}</p>
                    </div>
                    <button
                        type="button"
                        className="pd-toast-close"
                        onClick={(e) => {
                            e.stopPropagation();
                            setDismissedNotificationIds(prev => new Set([...prev, toastNotification.id]));
                            setToastNotification(null);
                        }}
                        aria-label="Dismiss notification"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}
            {page !== 'Activities' && page !== 'Read' && header}
            <main>
                {page !== 'Messages' && page !== 'TierLearners' && page !== 'Students' && page !== 'LearnerProfile' && page !== 'Activities' && page !== 'Read' && page !== 'Progress' && (
                    <div className="pd-heading">
                        <div>
                            <span className="pd-eyebrow">GRADE {c.grade} ONLY · TERM 4</span>
                            <h1>{page === 'Home' ? (teacher ? `Good morning, ${c.teacher}!` : 'Sawubona!') : page}</h1>
                            <p>{teacher ? `Grade ${c.room} · ${c.learners.length} learners` : `${child.name} · Grade ${c.room} · ${c.teacher}’s class`}</p>
                        </div>
                    </div>
                )}
                {page !== 'Activities' && page !== 'Read' && notice && <div role="status" className="pd-note">{notice}</div>}
                {page === 'Home' && teacher && (
                    <>
                        <Choices values={['English', 'Maths']} value={filter === 'All' ? 'English' : filter} onChange={setFilter} />
                        <Card className="pd-coral">
                            <div className="pd-split">
                                <span className="pd-tag">{filter === 'Maths' ? 'Mathematics · 10:30' : `Now · ${c.grade === 'R' ? 'Listening and speaking' : 'Home Language'}`}</span>
                                <small>{filter === 'Maths' ? `${c.mathChecked || 0} of ${c.learners.length} checked` : `${c.heard} of ${c.learners.length} heard`}</small>
                            </div>
                            <h2>{filter === 'Maths' ? 'Maths round' : (c.grade === 'R' ? 'Sound and rhyme round' : 'Reading round')}</h2>
                            {filter === 'Maths' ? (
                                <button className="pd-primary" onClick={() => { setFilter('Maths'); changePage('Activities'); }}><Check size={18} /> Start number check</button>
                            ) : (
                                <button className="pd-primary" onClick={() => { setFilter('English'); changePage('Activities'); }}><Mic size={18} /> Continue reading round</button>
                            )}
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
                {(page === 'TierLearners' || page === 'Students') && (
                    <ReadingTierList classroom={c} initialTier={tierView} title={page === 'Students' ? 'Students' : undefined} onSelectLearner={id => { setActiveLearnerId(id); setPage('LearnerProfile'); }} onBack={() => changePage('Home')} />
                )}
                {page === 'LearnerProfile' && selectedLearner && (
                    <LearnerProfile learner={selectedLearner} classroom={c} selectedTier={tierView || 'All'} onBack={() => setPage(tierView === 'All' ? 'Students' : 'TierLearners')} onUpdateLearner={upd => { updateClass(c.grade, old => ({ ...old, learners: old.learners.map(l => l.id === upd.id ? { ...l, ...upd } : l) })); setNotice(`Academic profile updated for ${upd.name}.`); }} onStartMessage={(topic, item, lid) => startMessage(topic, item, lid)} />
                )}
                {(page === 'Activities' || page === 'Read') && (
                    <ActivitiesHub
                        classroom={c}
                        subject={filter === 'Maths' ? 'Mathematics' : 'English'}
                        onBack={() => changePage('Home')}
                        onSaveAssessment={(payload) => {
                            updateClass(c.grade, old => {
                                const session = payload.session || {};
                                const draft = payload.draft || {};
                                const learnerId = payload.learnerId || session.learnerId;
                                const subject = payload.subject || session.subject || (filter === 'Maths' ? 'Mathematics' : 'English');
                                const isMath = subject === 'Mathematics';
                                const targetAssessedIds = isMath ? (old.mathAssessedIds || []) : (old.assessedIds || []);
                                const wasAssessed = targetAssessedIds.includes(learnerId);
                                const updatedAssessedIds = [...new Set([...targetAssessedIds, learnerId])];

                                let updatedHeard = old.heard || 0;
                                let updatedMathChecked = old.mathChecked || 0;
                                if (!wasAssessed) {
                                    if (isMath) {
                                        updatedMathChecked = Math.min(old.learners.length, updatedMathChecked + 1);
                                    } else {
                                        updatedHeard = Math.min(old.learners.length, updatedHeard + 1);
                                    }
                                }

                                const actId = payload.activityId || session.activityId || 'activity';
                                const actName = payload.activityName || session.activityName || 'Activity';
                                const approvedTier = typeof payload.approvedTierChange === 'string' ? payload.approvedTierChange : payload.approvedTierChange?.newTier;

                                const updatedLearners = old.learners.map(l => {
                                    if (l.id !== learnerId) return l;

                                    const newAssessment = {
                                        id: payload.id || session.sessionId || uid(),
                                        sessionId: session.sessionId || payload.id || uid(),
                                        activityId: actId,
                                        activityName: actName,
                                        subject: subject,
                                        academicYear: '2026',
                                        term: 'Term 4',
                                        completedAt: payload.completedAt || session.completedAt || new Date().toISOString(),
                                        score: payload.rawScore ?? payload.score ?? session.summary?.score ?? null,
                                        maxScore: payload.maxScore ?? session.summary?.maxScore ?? null,
                                        percentage: payload.percentage ?? session.summary?.percentage ?? null,
                                        status: 'Approved',
                                        finding: payload.finding || draft.finding || '',
                                        whyItMatters: payload.whyItMatters || draft.whyItMatters || '',
                                        whatToCheck: payload.whatToCheck || draft.whatToCheck || '',
                                        whatToDo: payload.whatToDo || draft.whatToDo || '',
                                        confidence: payload.confidence || draft.confidence || 'High',
                                        approvedAt: new Date().toISOString(),
                                        approvedBy: c.teacher || 'Teacher',
                                        teacherNotes: payload.teacherNotes || session.teacherNotes || ''
                                    };

                                    const currentAssessments = l.activityAssessments || [];
                                    const nextAssessments = [newAssessment, ...currentAssessments.filter(a => a.sessionId !== newAssessment.sessionId)];

                                    let nextGroup = l.group;
                                    let nextTierHistory = l.tierHistory || [];
                                    if (approvedTier && approvedTier !== l.group) {
                                        nextGroup = approvedTier;
                                        nextTierHistory = [
                                            ...nextTierHistory,
                                            {
                                                previousTier: l.group,
                                                newTier: approvedTier,
                                                changedAt: new Date().toISOString(),
                                                changedBy: c.teacher || 'Teacher',
                                                term: 'Term 4',
                                                reason: 'Approved following Lesedi activity assessment recommendation',
                                                supportingActivity: actName
                                            }
                                        ];
                                    }

                                    return {
                                        ...l,
                                        group: nextGroup,
                                        tierHistory: nextTierHistory,
                                        activityAssessments: nextAssessments,
                                        lastActivityAt: new Date().toISOString(),
                                        lastActivityName: actName
                                    };
                                });

                                return {
                                    ...old,
                                    heard: updatedHeard,
                                    assessedIds: isMath ? old.assessedIds : updatedAssessedIds,
                                    mathChecked: updatedMathChecked,
                                    mathAssessedIds: isMath ? updatedAssessedIds : old.mathAssessedIds,
                                    learners: updatedLearners
                                };
                            });

                            const targetId = payload.learnerId || payload.session?.learnerId;
                            const learnerName = c.learners.find(l => l.id === targetId)?.name || 'Learner';
                            setNotice(`Activity assessment for ${learnerName} approved and recorded.`);
                        }}
                    />
                )}
                {false && <TeacherReadingExperience classroom={c} onBack={() => {}} onSaveSession={() => {}} />}
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
                            <div className="pd-groups pd-parent-groups">
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
                    </>
                )}
                {!teacher && page === 'Progress' && (
                    <LearnerProfile
                        learner={child}
                        classroom={c}
                        isParent={true}
                        onBack={() => changePage('Home')}
                        onStartMessage={(topic, item, lid) => startMessage(topic, item, lid)}
                    />
                )}
                {page === 'Messages' && (
                    <MessagingHub profile={profile} classroom={c} classes={data.classes} initialLearnerId={msgLearnerId} initialTopic={msgTopic} onNavigateHome={() => changePage('Home')} />
                )}
            </main>
            {page !== 'Activities' && page !== 'Read' && (
                <nav className="pd-nav" aria-label={`${profile.role} navigation`}>
                    {nav.map(([name, Icon]) => {
                        const active = page === name || (name === 'Activities' && (page === 'Activities' || page === 'Read')) || (name === 'Students' && (page === 'TierLearners' || page === 'LearnerProfile'));
                        const isMsg = name === 'Messages';
                        return (
                            <button key={name} aria-current={active ? 'page' : undefined} className={active ? 'active' : ''} onClick={() => changePage(name)}>
                                <div className="pd-nav-icon-wrap">
                                    <Icon size={19} />
                                    {isMsg && unreadCount > 0 && (
                                        <span className="pd-nav-badge" aria-label={`${unreadCount} unread messages`}>
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </span>
                                    )}
                                </div>
                                <small>{name}</small>
                            </button>
                        );
                    })}
                </nav>
            )}
        </div>
    );
}
