import React, { useEffect, useRef, useState } from 'react';
import {
  Home,
  Mic,
  Users,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Check,
  Lock,
  Plus,
  Edit3,
  Trash2,
  Volume2,
  VolumeX,
  RefreshCcw,
  Settings,
  ArrowRight,
  Download,
  Smartphone,
  Upload,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  Calendar,
  Send,
  FileText,
  CheckCircle2,
  AlertCircle,
  Shield,
  Sparkles,
  Award
} from 'lucide-react';
import {
  api,
  resetDatabaseToDefault,
  exportDatabaseJson,
  importDatabaseJson
} from './services/copilotStore.js';

const PASSAGES = [
  'The sun is up. The cat sat on a mat.',
  'I can see a big red ball. We play in the sun.',
  'The little bird sat in the tree. It sang a happy song.'
];

const groups = ['Seed', 'Sprout', 'Bloom', 'Tree'];
const emoji = { Seed: '◒', Sprout: '♟', Bloom: '▣', Tree: '▥' };

function Pula({ large = false, happy = false }) {
  return (
    <div className={'pula ' + (large ? 'pula-large ' : '') + (happy ? 'happy ' : '')}>
      <img
        src="/icon.png"
        alt="Pula character"
        className="pula-avatar"
      />
    </div>
  );
}

function Button({ children, onClick, secondary = false, disabled = false, className = '' }) {
  return (
    <button
      className={'button ' + (secondary ? 'secondary ' : '') + className}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function GroupIcon({ group }) {
  return <span className={'group-icon ' + group.toLowerCase()}>{emoji[group]}</span>;
}

function ReadingSpeedChart({ termProgress = [] }) {
  const defaultTerms = [
    { term: 1, label: 'Term 1', wpm: 18 },
    { term: 2, label: 'Term 2', wpm: 24 },
    { term: 3, label: 'Term 3', wpm: 31 },
    { term: 4, label: 'Term 4', wpm: 38, isCurrent: true }
  ];

  const points =
    termProgress && termProgress.length >= 3
      ? termProgress.map((t, i) => ({
          term: t.term,
          label: `Term ${t.term}`,
          wpm: t.wpm,
          isCurrent: i === termProgress.length - 1
        }))
      : defaultTerms;

  const width = 310;
  const height = 90;
  const paddingX = 35;
  const paddingY = 24;

  const minWpm = Math.min(...points.map(p => p.wpm), 10);
  const maxWpm = Math.max(...points.map(p => p.wpm), 45);
  const range = maxWpm - minWpm || 1;

  const coords = points.map((p, i) => {
    const x = paddingX + (i / (points.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - ((p.wpm - minWpm) / range) * (height - 2 * paddingY);
    return { ...p, x, y };
  });

  const pathD = coords.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  return (
    <div className="chart-container">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
      >
        <line
          x1={paddingX}
          y1={height - paddingY}
          x2={width - paddingX}
          y2={height - paddingY}
          stroke="#f0eee8"
          strokeWidth="1"
        />
        <line
          x1={paddingX}
          y1={height / 2}
          x2={width - paddingX}
          y2={height / 2}
          stroke="#f0eee8"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <path
          d={pathD}
          fill="none"
          stroke="#8E9BFF"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((pt, i) => (
          <g key={i}>
            <text
              x={pt.x}
              y={pt.y - 10}
              textAnchor="middle"
              fill="#16193F"
              fontSize="13"
              fontWeight="900"
              fontFamily="Nunito, sans-serif"
            >
              {pt.wpm}
            </text>
            <circle
              cx={pt.x}
              cy={pt.y}
              r={pt.isCurrent ? 6 : 5}
              fill={pt.isCurrent ? '#FF6B4A' : '#FFFFFF'}
              stroke={pt.isCurrent ? '#FFFFFF' : '#8E9BFF'}
              strokeWidth="2.5"
            />
            {pt.isCurrent && (
              <circle
                cx={pt.x}
                cy={pt.y}
                r={9}
                fill="none"
                stroke="#FF6B4A"
                strokeWidth="1.5"
                opacity="0.6"
              />
            )}
            <text
              x={pt.x}
              y={height - 2}
              textAnchor="middle"
              fill="#74768A"
              fontSize="11"
              fontWeight="700"
              fontFamily="Nunito, sans-serif"
            >
              {pt.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('welcome');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [passage, setPassage] = useState(PASSAGES[0]);
  const [transcript, setTranscript] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [result, setResult] = useState(null);
  const [group, setGroup] = useState('Sprout');
  const [activity, setActivity] = useState(null);
  const [editNote, setEditNote] = useState(null);
  const [editLearner, setEditLearner] = useState(null);
  const [tab, setTab] = useState('class');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // New features state
  const [role, setRole] = useState('teacher'); // 'teacher' | 'hod'
  const [progressLearner, setProgressLearner] = useState('1'); // learner ID
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [integrationTab, setIntegrationTab] = useState('sasams'); // 'sasams' | 'mtn'
  const [editingActivitySteps, setEditingActivitySteps] = useState(false);
  const [customSteps, setCustomSteps] = useState('');
  const [completedActivities, setCompletedActivities] = useState(['Sprout']);

  const rec = useRef(null);
  const timer = useRef(null);
  const start = useRef(null);
  const fileInputRef = useRef(null);

  const refresh = async () => {
    const state = await api('/state');
    setData(state);
    return state;
  };

  useEffect(() => {
    refresh().catch(e => setError(e.message));

    // Detect standalone PWA mode
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(!!standaloneMode);

    // Capture install prompt for PWA
    const onBeforeInstall = e => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    return () => {
      clearInterval(timer.current);
      rec.current?.stop?.();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  const run = async fn => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const go = p => {
    setError('');
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    setPage(p);
  };

  const handleInstallClick = async () => {
    if (!installPrompt) {
      alert('To install on iOS Safari: Tap the Share button and select "Add to Home Screen".');
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const learners = data?.learners || [];
  const assessments = data?.assessments || [];
  const notes = data?.notes || [];
  const terms = data?.terms || [
    { id: 1, name: 'Term 1', dates: 'Jan to Mar', avgWpm: 21, hodReviewed: true },
    { id: 2, name: 'Term 2', dates: 'Apr to Jun', avgWpm: 27, hodReviewed: true },
    { id: 3, name: 'Term 3', dates: 'Jul to Sep', avgWpm: 33, hodReviewed: true },
    { id: 4, name: 'Term 4', dates: 'Oct to Dec', avgWpm: 36, isCurrent: true, hodReviewed: false }
  ];
  const yearSummary = data?.yearSummary || { learnersHeard: 36, movedUp: 17, parentNotesSent: 112 };

  const current = learners.find(l => l.id === selected);
  const counts = Object.fromEntries(groups.map(g => [g, learners.filter(l => l.group === g).length]));

  const currentProgLearner = learners.find(l => l.id === progressLearner) || learners[0] || {};
  const progPoints = currentProgLearner.termProgress || [
    { term: 1, wpm: 18 },
    { term: 2, wpm: 24 },
    { term: 3, wpm: 31 },
    { term: 4, wpm: 38 }
  ];
  const firstWpm = progPoints[0]?.wpm || 0;
  const lastWpm = progPoints[progPoints.length - 1]?.wpm || 0;
  const wpmDiff = lastWpm - firstWpm;

  const startReading = () => {
    if (!current?.consent) {
      setError('Parent consent is required to assess this learner.');
      return;
    }
    setTranscript('');
    setSeconds(0);
    setResult(null);
    go('reading');
  };

  const listen = () => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      setError(
        'Speech recognition is not supported in this browser. You can type words directly in the box below.'
      );
      return;
    }
    setError('');
    const r = new Speech();
    rec.current = r;
    r.lang = 'en-ZA';
    r.continuous = true;
    r.interimResults = true;
    let finalText = '';

    r.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + ' ';
        else interim += t;
      }
      setTranscript(finalText + interim);
    };

    r.onerror = e => setError('Microphone/speech recognition: ' + e.error);
    r.onend = () => {
      setRecording(false);
      clearInterval(timer.current);
    };

    try {
      r.start();
      start.current = Date.now();
      setRecording(true);
      timer.current = setInterval(
        () => setSeconds(Math.max(1, Math.round((Date.now() - start.current) / 1000))),
        500
      );
    } catch (e) {
      setError(e.message);
    }
  };

  const stop = () => {
    rec.current?.stop?.();
    setRecording(false);
    clearInterval(timer.current);
  };

  const readAloud = () => {
    if (!('speechSynthesis' in window)) {
      setError('Speech playback is not available in this browser.');
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(passage);
    utterance.rate = 0.85;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const submit = () =>
    run(async () => {
      stop();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setSpeaking(false);
      const a = await api('/assessments', {
        method: 'POST',
        body: JSON.stringify({
          learnerId: selected,
          passage,
          transcript,
          durationSeconds: Math.max(1, seconds)
        })
      });
      setResult(a);
      go('complete');
    });

  const chooseTab = t => {
    setTab(t);
    go({
      class: 'dashboard',
      read: 'choose',
      groups: 'groups',
      progress: 'progress',
      terms: 'terms'
    }[t]);
  };

  const handleHodReview = termId =>
    run(async () => {
      await api('/terms/' + termId + '/hod-review', {
        method: 'POST',
        body: JSON.stringify({ reviewedBy: 'Mrs. Khumalo (HOD)' })
      });
      alert('Term ' + termId + ' report successfully reviewed and signed off by HOD!');
    });

  const handleApproveAllNotes = () =>
    run(async () => {
      await api('/notes/approve-all', { method: 'POST' });
      alert('All pending parent notes approved and synced to records!');
    });

  const handleToggleActivityCompletion = grp =>
    run(async () => {
      if (completedActivities.includes(grp)) {
        setCompletedActivities(completedActivities.filter(g => g !== grp));
      } else {
        await api('/activities/complete', {
          method: 'POST',
          body: JSON.stringify({ group: grp, title: 'Sound hunt' })
        });
        setCompletedActivities([...completedActivities, grp]);
      }
    });

  const handleDownloadSasamsCsv = () => {
    const headers = 'SASAMS_ID,Learner_Name,Grade,Language,Reading_Tier,Term1_WPM,Term2_WPM,Term3_WPM,Term4_WPM,Consent_Status\n';
    const rows = learners
      .map(
        l =>
          `SASAMS-${l.id.padStart(4, '0')},"${l.name}",${data.classroom.grade},"${l.language}","${l.group}",${
            l.termProgress?.[0]?.wpm || ''
          },${l.termProgress?.[1]?.wpm || ''},${l.termProgress?.[2]?.wpm || ''},${
            l.termProgress?.[3]?.wpm || ''
          },${l.consent ? 'YES' : 'PENDING'}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SA-SAMS-Grade${data.classroom.grade}-Reading-Export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportBackup = () => {
    const json = exportDatabaseJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teacher-copilot-${(data.classroom?.name || 'class').replace(/\s+/g, '_')}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const updated = importDatabaseJson(evt.target.result);
        setData(updated);
        alert('Classroom data successfully restored!');
      } catch (err) {
        setError('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetDemo = () => {
    if (confirm('Reset class data back to the default demo state?')) {
      const reset = resetDatabaseToDefault();
      setData(reset);
      go('dashboard');
    }
  };

  const nav = (
    <nav className="bottom-nav">
      {[
        ['class', Home, 'Class'],
        ['read', Mic, 'Read'],
        ['groups', Users, 'Groups'],
        ['progress', TrendingUp, 'Progress'],
        ['terms', Calendar, 'Terms']
      ].map(([k, Icon, label]) => (
        <button
          key={k}
          className={tab === k ? 'active' : ''}
          onClick={() => chooseTab(k)}
          aria-label={label}
        >
          <Icon size={19} />
          <small>{label}</small>
        </button>
      ))}
    </nav>
  );

  const header = (title, back = 'dashboard') => (
    <div className="page-header">
      <button className="back" onClick={() => go(back)} aria-label="Back">
        <ChevronLeft />
      </button>
      <h1>{title}</h1>
    </div>
  );

  if (!data) return <div className="loading">Loading Teacher Copilot… {error}</div>;

  return (
    <div className={'app ' + (page === 'reading' ? 'night' : '')}>
      {error && (
        <div role="alert" className="error" onClick={() => setError('')}>
          {error} ✕
        </div>
      )}

      {/* 1. Welcome Screen */}
      {page === 'welcome' && (
        <main className="welcome">
          <div className="brand">
            <span className="sunrise">◒</span> Teacher Copilot
            <span className="mobile-pill">
              <Smartphone size={11} /> Standalone Mobile App
            </span>
          </div>
          <div className="hero-orbit">
            <Pula large />
          </div>
          <div className="confetti">●　　✦　　　　●</div>
          <h1>Hi, I'm Pula.</h1>
          <p>
            I listen while your learners read, so every voice in a full classroom gets heard.
            Works completely offline on your phone.
          </p>
          <Button onClick={() => go('setup')}>Get started</Button>
          <Button secondary onClick={() => go('code')}>
            I have a class code
          </Button>
          {installPrompt && (
            <Button secondary className="install-btn" onClick={handleInstallClick}>
              <Download size={16} /> Install App to Phone
            </Button>
          )}
          <div className="privacy">
            <Lock size={12} /> Data is saved locally on this device. Parent consent required.
          </div>
        </main>
      )}

      {/* 2. Join Class Code Screen */}
      {page === 'code' && (
        <main>
          {header('Join a classroom', 'welcome')}
          <div className="card">
            <p>Enter your classroom code.</p>
            <input id="classcode" placeholder="Class code" defaultValue="READ2B" />
            <Button
              onClick={() => {
                const c = document.getElementById('classcode').value.trim();
                if (c.toUpperCase() === (data.classroom?.code || 'READ2B').toUpperCase()) {
                  go('dashboard');
                } else {
                  setError('Code not found. Demo code: READ2B');
                }
              }}
            >
              Join class
            </Button>
            <p className="muted">Demo classroom code: READ2B</p>
          </div>
        </main>
      )}

      {/* 3. Class Setup Screen */}
      {page === 'setup' && (
        <main>
          {header('Set up your class', 'welcome')}
          <div className="card">
            <label>
              Teacher name
              <input id="teacher" defaultValue={data.classroom.teacher} />
            </label>
            <label>
              Class name
              <input id="classname" defaultValue={data.classroom.name} />
            </label>
            <label>
              Grade
              <select id="grade" defaultValue={data.classroom.grade}>
                {[1, 2, 3, 4, 5, 6].map(x => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <Button
              onClick={() =>
                run(async () => {
                  await api('/classroom', {
                    method: 'PATCH',
                    body: JSON.stringify({
                      teacher: document.getElementById('teacher').value,
                      classroom: '',
                      name: document.getElementById('classname').value,
                      grade: Number(document.getElementById('grade').value)
                    })
                  });
                  go('dashboard');
                })
              }
            >
              Open my classroom <ArrowRight size={16} />
            </Button>
          </div>
        </main>
      )}

      {/* 4. Dashboard (Class) Screen */}
      {page === 'dashboard' && (
        <main className="with-nav">
          <div className="greeting">
            <Pula />
            <div>
              <div className="greeting-title">
                <h1>Good morning!</h1>
                <span className="mobile-badge">
                  <Smartphone size={10} /> Mobile Ready
                </span>
              </div>
              <p>
                {data.classroom.name} · {learners.length} learners · Term 4
              </p>
            </div>
            <button className="icon-btn" onClick={() => go('settings')} aria-label="Settings">
              <Settings size={20} />
            </button>
          </div>

          <div className="coral-card">
            <h2>Reading round</h2>
            <p>Hear each learner read aloud, one at a time. Pula does the listening.</p>
            <Button onClick={() => chooseTab('read')}>
              <Mic size={18} /> Start reading round
            </Button>
          </div>

          <div className="section-title">
            <h3>Reading groups</h3>
            <button className="text-link" onClick={() => chooseTab('groups')}>
              See all
            </button>
          </div>
          <div className="group-grid">
            {groups.map(g => (
              <button
                className={'group-tile ' + g.toLowerCase()}
                key={g}
                onClick={() => {
                  setGroup(g);
                  chooseTab('groups');
                }}
              >
                <strong>{emoji[g]}</strong>
                <b>{counts[g]}</b>
                <small>{g}</small>
              </button>
            ))}
          </div>

          <button className="note-banner" onClick={() => go('notes')}>
            <span>▤</span>
            <div>
              <strong>
                {notes.filter(n => n.status === 'draft' || n.status === 'to_review').length} parent notes ready
              </strong>
              <small>Lesedi drafted them. You approve.</small>
            </div>
            <ChevronRight />
          </button>

          <div className="section-title">
            <h3>Quick actions</h3>
          </div>
          <div className="quick-actions">
            <button onClick={() => go('learners')}>
              <Users /> Manage learners
            </button>
            <button onClick={() => go('activities')}>
              <BookOpen /> Activities
            </button>
            <button onClick={() => go('notes')}>
              <MessageSquare /> Parent notes
            </button>
            <button onClick={() => setShowIntegrationModal(true)}>
              <ShieldCheck /> SA-SAMS sync
            </button>
          </div>
        </main>
      )}

      {/* 5. Learner Selection Screen (Who's reading?) */}
      {page === 'choose' && (
        <main>
          {header("Who's reading?")}
          <div className="info-banner">
            <BookOpen size={25} />
            <div>
              <small>Reading task</small>
              <strong>Short passage · Phonics set 2</strong>
            </div>
            <button onClick={() => go('passages')}>Change</button>
          </div>
          <div className="learner-grid">
            {learners.map(l => (
              <button
                key={l.id}
                className={
                  'learner-tile ' +
                  (selected === l.id ? 'selected ' : '') +
                  (!l.consent ? 'locked ' : '')
                }
                onClick={() => setSelected(l.id)}
              >
                <span className="avatar">{l.consent ? l.name[0] : '🔒'}</span>
                <b>{l.name}</b>
                {!l.consent ? (
                  <small>Needs consent</small>
                ) : assessments.some(a => a.learnerId === l.id) ? (
                  <span className="tick">✓</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="sticky-actions">
            <Button disabled={!current || !current.consent} onClick={startReading}>
              Hand the phone to {current?.name || 'a learner'} <ArrowRight size={17} />
            </Button>
            {current && !current.consent && (
              <button
                className="text-link"
                onClick={() => {
                  setEditLearner(current.id);
                  go('learner-edit');
                }}
              >
                Manage parental consent
              </button>
            )}
          </div>
        </main>
      )}

      {/* 6. Passage Selection Screen */}
      {page === 'passages' && (
        <main>
          {header('Choose a reading task', 'choose')}
          {PASSAGES.map((p, i) => (
            <button
              className="card passage-choice"
              key={i}
              onClick={() => {
                setPassage(p);
                go('choose');
              }}
            >
              <strong>Passage {i + 1}</strong>
              <p>{p}</p>
            </button>
          ))}
          <div className="card">
            <label>
              Custom passage
              <textarea value={passage} onChange={e => setPassage(e.target.value)} />
            </label>
            <Button onClick={() => go('choose')}>Use this passage</Button>
          </div>
        </main>
      )}

      {/* 7. Child Reading Screen (Night theme, Calm first: No scores or timers for child) */}
      {page === 'reading' && (
        <main className="reading-page">
          <div className="reading-top">
            <h2>{current?.name}'s turn</h2>
            <button
              onClick={() => {
                stop();
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                setSpeaking(false);
                go('choose');
              }}
            >
              ✕
            </button>
          </div>
          <div className="passage">{passage}</div>

          <div className={'listening-orbit ' + (recording ? 'pulsing' : '')}>
            <Pula large />
          </div>

          <div className="listening-text">
            {recording
              ? "Take your time. I'm listening."
              : speaking
              ? 'Pula is reading...'
              : "Take your time. I'm listening."}
          </div>

          <div className="reading-buttons">
            <Button
              secondary
              onClick={() => {
                stop();
                setTranscript('');
                setSeconds(0);
              }}
            >
              <RefreshCcw size={15} /> Start again
            </Button>

            <Button secondary onClick={readAloud}>
              {speaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
              {speaking ? 'Stop' : 'Listen model'}
            </Button>

            {recording ? (
              <Button onClick={stop}>Pause</Button>
            ) : (
              <Button onClick={listen}>
                <Mic size={16} /> Listen
              </Button>
            )}
          </div>

          <Button
            className="coral done"
            disabled={busy || !transcript.trim() || seconds < 1}
            onClick={submit}
          >
            I'm done <Check size={17} />
          </Button>

          {/* Teacher assistance & transcript adjustment */}
          <details style={{ marginTop: '14px', width: '100%', fontSize: '11px', color: '#a0a4c0' }}>
            <summary style={{ cursor: 'pointer', textAlign: 'center' }}>Teacher audio transcript notes</summary>
            <textarea
              className="transcript"
              style={{ marginTop: '8px' }}
              aria-label="Recognized words"
              placeholder="Audio transcription buffer. You can also correct words here if needed."
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
            />
          </details>
        </main>
      )}

      {/* 8. Celebration & Assessment Screen */}
      {page === 'complete' && (
        <main className="complete">
          <div className="celebrate">
            <Pula large happy />
            <span>✦　★　✦</span>
          </div>
          <h1>
            You read it,
            <br />
            {current?.name}!
          </h1>
          <p>Pula loved listening to you.</p>
          {result && (
            <div className="teacher-result">
              <strong>Teacher-only assessment</strong>
              <div>
                Word match: {result.accuracy}% · Pace: {result.wpm} WPM
              </div>
              <div>
                Suggested group: <b>{result.suggestedGroup}</b> (teacher decides)
              </div>
              <Button
                secondary
                onClick={() =>
                  run(async () => {
                    await api('/assessments/' + result.id + '/approve', {
                      method: 'POST',
                      body: JSON.stringify({ applyGroup: true })
                    });
                    setResult({ ...result, reviewed: true });
                  })
                }
                disabled={result.reviewed}
              >
                {result.reviewed ? 'Group approved ✓' : 'Approve suggested group'}
              </Button>
            </div>
          )}
          <Button
            onClick={() => {
              setSelected(null);
              go('choose');
            }}
          >
            Next friend
          </Button>
          <Button secondary onClick={() => chooseTab('class')}>
            Back to class
          </Button>
        </main>
      )}

      {/* 9. Reading Groups Screen (PDF Page 7) */}
      {page === 'groups' && (
        <main className="with-nav">
          {header('Reading groups')}
          <div className="info-banner">
            <Pula />
            <p>
              Thando just joined Sprout. Lesedi suggests, you decide. Tap a name to move anyone.
            </p>
          </div>
          {groups.map((g, idx) => (
            <section className="group-card" key={g}>
              <div className="group-card-heading">
                <GroupIcon group={g} />
                <h3 className="tier-title">Tier {idx + 1} · {g}</h3>
                <small>{counts[g]} readers</small>
              </div>
              <div className="chips">
                {learners
                  .filter(l => l.group === g)
                  .map(l => (
                    <button
                      key={l.id}
                      onClick={() => {
                        setEditLearner(l.id);
                        go('learner-edit');
                      }}
                    >
                      {l.recentlyMoved && <span className="recently-moved-dot" />}
                      {l.name}
                    </button>
                  ))}
              </div>
            </section>
          ))}
          <Button onClick={() => go('activities')}>
            See today's activities <ArrowRight size={16} />
          </Button>
        </main>
      )}

      {/* 10. Today's Activities Screen (PDF Page 8) */}
      {page === 'activities' && (
        <main className="with-nav">
          {header("Today's activities", 'groups')}
          <div className="tabs">
            {groups.map(g => (
              <button
                key={g}
                className={g === group ? 'active' : ''}
                onClick={() => {
                  setGroup(g);
                  setActivity(null);
                  setEditingActivitySteps(false);
                }}
              >
                {emoji[g]} {g}
              </button>
            ))}
          </div>

          <div className="activity-card">
            <div className="badges">
              <span>
                {group} · {counts[group]} readers
              </span>
              <span>CAPS Grade {data.classroom.grade} · Phonics</span>
            </div>
            <h2>
              {activity?.group === group
                ? activity.title
                : {
                    Seed: 'Sound & letter hunt',
                    Sprout: 'Sound hunt',
                    Bloom: 'Story builders',
                    Tree: 'Reading detectives'
                  }[group]}
            </h2>
            <p>
              A 3-minute micro-lesson Lesedi built for this group's reading round.
            </p>

            {editingActivitySteps ? (
              <div style={{ margin: '12px 0' }}>
                <textarea
                  defaultValue={
                    activity?.steps?.join('\n') ||
                    {
                      Seed: 'Say it. Say three simple letter sounds together.\nFind it. Classroom objects with those sounds.\nRead it. Blend short words aloud in pairs.',
                      Sprout:
                        'Say it. Say a word with the new sound. Children clap when they hear it.\nFind it. Spot three things in the room that start with the sound.\nRead it. Read the short passage together, then in pairs.',
                      Bloom:
                        'Read it. Read a short paragraph aloud.\nFind it. Identify the main idea and three details.\nShare it. Retell the story with a partner.',
                      Tree:
                        'Read it. Read a new passage independently.\nAnalyze it. Find evidence for two comprehension questions.\nDefine it. Explain the meaning of three new words.'
                    }[group]
                  }
                  id="activity-steps-input"
                  style={{ width: '100%', minHeight: '100px' }}
                />
                <Button
                  onClick={() => {
                    const steps = document.getElementById('activity-steps-input').value.split('\n').filter(s => s.trim());
                    setActivity({ ...activity, group, steps, title: 'Customized micro-lesson' });
                    setEditingActivitySteps(false);
                  }}
                >
                  Save lesson steps
                </Button>
              </div>
            ) : (
              (activity?.group === group
                ? activity.steps
                : {
                    Seed: [
                      'Say it. Say three simple letter sounds together. Children repeat.',
                      'Find it. Find classroom objects that start with those sounds.',
                      'Read it. Blend short words and read them aloud in pairs.'
                    ],
                    Sprout: [
                      'Say it. Say a word with the new sound. Children clap when they hear it.',
                      'Find it. Spot three things in the room that start with the sound.',
                      'Read it. Read the short passage together, then in pairs.'
                    ],
                    Bloom: [
                      'Read it. Read a short paragraph aloud together.',
                      'Find it. Identify the main idea and three story details.',
                      'Share it. Retell the story with a partner in home language.'
                    ],
                    Tree: [
                      'Read it. Read a new passage independently and fluently.',
                      'Find it. Find evidence for two comprehension questions.',
                      'Explain it. Explain the meaning of three new vocabulary words.'
                    ]
                  }[group]
              ).map((s, i) => (
                <div className="activity-step" key={i}>
                  <span>{i + 1}</span>
                  <p>{s}</p>
                  <small>1 min</small>
                </div>
              ))
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <Button
                className="coral"
                style={{ flex: 2 }}
                onClick={() => handleToggleActivityCompletion(group)}
              >
                {completedActivities.includes(group) ? 'Completed for today ✓' : '▶ Start with ' + group}
              </Button>
              <Button
                secondary
                style={{ flex: 1 }}
                onClick={() => setEditingActivitySteps(!editingActivitySteps)}
              >
                {editingActivitySteps ? 'Cancel' : 'Edit'}
              </Button>
            </div>
          </div>

          <div className="info-banner" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>Whole-class warm-up</strong>
              <small style={{ display: 'block', color: '#74768a' }}>Everyone, together</small>
            </div>
            <b>2 min</b>
          </div>

          <Button onClick={() => go('notes')}>
            Review parent notes <ArrowRight size={16} />
          </Button>
        </main>
      )}

      {/* 11. Parent Notes Screen (PDF Page 9) */}
      {page === 'notes' && (
        <main className="with-nav">
          {header('Parent notes', 'dashboard')}
          <div className="info-banner">
            <Pula />
            <p>
              Nothing sends until you approve. Home language, zero-rated for parents on MTN.
            </p>
          </div>

          <div className="card">
            <h3>Create a parent note</h3>
            <select id="notelearner" defaultValue="">
              <option value="" disabled>
                Select learner
              </option>
              {learners
                .filter(l => l.consent)
                .map(l => (
                  <option value={l.id} key={l.id}>
                    {l.name} ({l.language})
                  </option>
                ))}
            </select>
            <Button
              onClick={() =>
                run(async () => {
                  const id = document.getElementById('notelearner').value;
                  if (!id) throw new Error('Choose a learner');
                  await api('/notes', {
                    method: 'POST',
                    body: JSON.stringify({ learnerId: id })
                  });
                })
              }
            >
              <Plus size={16} /> Draft note
            </Button>
          </div>

          {notes.map(n => {
            const l = learners.find(x => x.id === n.learnerId);
            return (
              <div className="note-card" key={n.id}>
                <div className="note-heading">
                  <span className="avatar">{l?.name?.[0] || '?'}</span>
                  <div>
                    <b>{l?.name}'s note</b>
                    <span className="note-tag">
                      {n.language || l?.language || 'English'} · {n.channel || l?.channel || 'WhatsApp'}
                    </span>
                  </div>
                  <span
                    className={
                      'status ' + (n.status === 'sent' ? 'sent' : n.status === 'to_review' ? 'to_review' : 'draft')
                    }
                  >
                    {n.status === 'sent' ? '✓ Sent' : n.status === 'to_review' ? 'To review' : 'Draft'}
                  </span>
                </div>
                {editNote === n.id ? (
                  <textarea id={'edit' + n.id} defaultValue={n.text} />
                ) : (
                  <p className="note-text">{n.text}</p>
                )}
                <div className="note-actions">
                  <button
                    onClick={() => {
                      if (editNote === n.id) {
                        run(async () => {
                          await api('/notes/' + n.id, {
                            method: 'PATCH',
                            body: JSON.stringify({
                              text: document.getElementById('edit' + n.id).value
                            })
                          });
                          setEditNote(null);
                        });
                      } else setEditNote(n.id);
                    }}
                  >
                    <Edit3 size={14} /> {editNote === n.id ? 'Save' : 'Edit'}
                  </button>
                  <button
                    onClick={() =>
                      run(async () => {
                        if (confirm('Delete this note?')) {
                          await api('/notes/' + n.id, { method: 'DELETE' });
                        }
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                  {n.status !== 'sent' && (
                    <button
                      className="approve"
                      onClick={() =>
                        run(async () =>
                          api('/notes/' + n.id, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: 'sent' })
                          })
                        )
                      }
                    >
                      <Send size={14} /> Approve and send
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div className="sync-banner">
            <span className="green-dot">●</span>
            <span>Synced to school records (SA-SAMS) and the MTN Foundation dashboard. Consent checked.</span>
          </div>

          <Button
            className="coral"
            onClick={handleApproveAllNotes}
          >
            Approve all {notes.filter(n => n.status !== 'sent').length || 5} notes
          </Button>
        </main>
      )}

      {/* 12. Progress Screen (PDF Page 10) */}
      {page === 'progress' && (
        <main className="with-nav">
          {header('Progress', 'dashboard')}

          {/* Horizontal scrollable learner selector pills */}
          <div className="learner-pills-bar">
            {learners.map(l => (
              <button
                key={l.id}
                className={'learner-pill-btn ' + (progressLearner === l.id ? 'active' : '')}
                onClick={() => setProgressLearner(l.id)}
              >
                <span className="pill-avatar">{l.name[0]}</span>
                <span>{l.name}</span>
              </button>
            ))}
          </div>

          {/* Reading speed card */}
          <div className="progress-speed-card">
            <div className="speed-card-top">
              <div>
                <h3>Reading speed</h3>
                <small className="muted">Words per minute, by term</small>
              </div>
              {wpmDiff > 0 && <span className="up-badge">Up {wpmDiff} since Term 1</span>}
            </div>

            <ReadingSpeedChart termProgress={currentProgLearner.termProgress} />

            <div className="chart-footer-note">
              <span className="orange-dot">●</span>
              <span>Term 4 is still in progress</span>
            </div>
          </div>

          {/* Side-by-side Group journey & Sounds to practise */}
          <div className="split-row">
            <div className="card-half">
              <span className="half-label">Group journey</span>
              <div className="journey-flow">
                <span className={'journey-pill ' + (currentProgLearner.groupJourney?.from || 'Seed').toLowerCase()}>
                  {currentProgLearner.groupJourney?.from || 'Seed'}
                </span>
                <span className="journey-arrow">→</span>
                <span className={'journey-pill ' + (currentProgLearner.groupJourney?.to || currentProgLearner.group || 'Sprout').toLowerCase()}>
                  {currentProgLearner.groupJourney?.to || currentProgLearner.group || 'Sprout'}
                </span>
              </div>
            </div>

            <div className="card-half">
              <span className="half-label">Sounds to practise</span>
              <div className="sounds-row">
                {(currentProgLearner.soundsToPractise || ['th', 'sh']).map(s => (
                  <span className="sound-chip" key={s}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Worth a check-in card (Identification of learners requiring additional reading support) */}
          <div className="checkin-card">
            <h3>Worth a check-in</h3>
            {learners
              .filter(l => l.checkInNote)
              .map(l => (
                <div
                  className="checkin-item"
                  key={l.id}
                  onClick={() => {
                    setSelected(l.id);
                    if (!l.consent) {
                      setEditLearner(l.id);
                      go('learner-edit');
                    } else {
                      startReading();
                    }
                  }}
                >
                  <span className="checkin-name">{l.name}</span>
                  <span className="checkin-reason">{l.checkInNote}</span>
                </div>
              ))}
          </div>
        </main>
      )}

      {/* 13. School Year / Terms Screen (PDF Page 11) */}
      {page === 'terms' && (
        <main className="with-nav">
          {header('School year', 'dashboard')}
          <p className="muted" style={{ marginTop: '-8px', marginBottom: '12px' }}>
            {data.classroom.name} · 4 terms
          </p>

          {/* Role switcher toggle */}
          <div className="role-toggle-bar">
            <button
              className={role === 'teacher' ? 'active' : ''}
              onClick={() => setRole('teacher')}
            >
              Teacher view
            </button>
            <button
              className={role === 'hod' ? 'active' : ''}
              onClick={() => setRole('hod')}
            >
              HOD view
            </button>
          </div>

          {/* Reminder guidance banner */}
          <div className="hod-banner">
            <div className="hod-banner-icon">
              <Shield size={18} />
            </div>
            <div className="hod-banner-content">
              <strong>Reminder: you and your HOD both monitor this.</strong>
              <p>
                Lesedi suggests, people decide. Review groups, notes and progress together every term.
              </p>
            </div>
          </div>

          {/* 2x2 Terms Cards Grid */}
          <div className="terms-grid">
            {terms.map(t => {
              const isCurrent = t.isCurrent || t.id === 4;
              return (
                <div className={'term-card ' + (isCurrent ? 'current' : '')} key={t.id}>
                  <div className="term-header-row">
                    <h3>{t.name}</h3>
                    {isCurrent && <span className="term-badge now-pill">Now</span>}
                  </div>
                  <span className="term-dates">{t.dates}</span>
                  <div className="term-wpm">
                    {t.avgWpm} <small>{isCurrent ? 'wpm so far' : 'wpm avg'}</small>
                  </div>
                  {t.hodReviewed ? (
                    <span className="term-badge reviewed">✓ HOD reviewed</span>
                  ) : role === 'hod' && isCurrent ? (
                    <button
                      className="button signoff-btn"
                      onClick={() => handleHodReview(t.id)}
                    >
                      Sign off as HOD
                    </button>
                  ) : (
                    <span className="term-badge due">HOD review due</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* This year so far summary */}
          <div className="year-stats-card">
            <h3>This year so far</h3>
            <div className="year-stats-grid">
              <div>
                <span className="year-stat-number">{yearSummary.learnersHeard}</span>
                <span className="year-stat-label">learners heard</span>
              </div>
              <div>
                <span className="year-stat-number">{yearSummary.movedUp}</span>
                <span className="year-stat-label">moved up a group</span>
              </div>
              <div>
                <span className="year-stat-number">{yearSummary.parentNotesSent}</span>
                <span className="year-stat-label">parent notes sent</span>
              </div>
            </div>
          </div>

          {/* Sync & Consent footer */}
          <div className="sync-banner">
            <span className="green-dot">●</span>
            <span>Synced to SA-SAMS and the MTN Foundation dashboard. Consent checked.</span>
          </div>

          <Button secondary onClick={() => setShowIntegrationModal(true)}>
            <FileText size={16} /> View SA-SAMS & MTN Reporting Preview
          </Button>
        </main>
      )}

      {/* 14. Manage Learners Screen */}
      {page === 'learners' && (
        <main>
          {header('Manage learners')}
          <div className="card">
            <h3>Add learner</h3>
            <input id="newlearner" placeholder="Learner name" />
            <Button
              onClick={() =>
                run(async () => {
                  const val = document.getElementById('newlearner').value.trim();
                  if (!val) throw new Error('Learner name is required');
                  await api('/learners', {
                    method: 'POST',
                    body: JSON.stringify({ name: val })
                  });
                  document.getElementById('newlearner').value = '';
                })
              }
            >
              <Plus size={16} /> Add learner
            </Button>
          </div>
          {learners.map(l => (
            <button
              className="learner-row"
              key={l.id}
              onClick={() => {
                setEditLearner(l.id);
                go('learner-edit');
              }}
            >
              <span className="avatar">{l.name[0]}</span>
              <div>
                <b>{l.name}</b>
                <small>
                  {l.group} · {l.consent ? 'Consent recorded ✓' : 'Consent pending'}
                </small>
              </div>
              <ChevronRight />
            </button>
          ))}
        </main>
      )}

      {/* 15. Learner Edit Screen */}
      {page === 'learner-edit' &&
        (() => {
          const l = learners.find(x => x.id === editLearner);
          if (!l) return null;
          return (
            <main>
              {header(l.name, 'learners')}
              <div className="card" key={l.id}>
                <label>
                  Name
                  <input id="ename" defaultValue={l.name} />
                </label>
                <label>
                  Reading group
                  <select id="egroup" defaultValue={l.group}>
                    {groups.map(g => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Home language
                  <select id="elang" defaultValue={l.language}>
                    {['English', 'isiZulu', 'Sepedi', 'Setswana', 'isiXhosa', 'Sesotho', 'Other'].map(
                      x => (
                        <option key={x}>{x}</option>
                      )
                    )}
                  </select>
                </label>
                <label>
                  Parent channel
                  <select id="echannel" defaultValue={l.channel}>
                    <option>WhatsApp</option>
                    <option>SMS</option>
                  </select>
                </label>
                <label>
                  Parent contact
                  <input
                    id="econtact"
                    defaultValue={l.parentContact}
                    placeholder="e.g. +27 82 123 4567"
                  />
                </label>
                <label className="checkline">
                  <input type="checkbox" id="econsent" defaultChecked={l.consent} /> Parent/guardian
                  consent confirmed
                </label>
                <p className="muted">
                  Required before recording reading practice or generating parent communications.
                </p>
                <Button
                  onClick={() =>
                    run(async () => {
                      await api('/learners/' + l.id, {
                        method: 'PATCH',
                        body: JSON.stringify({
                          name: document.getElementById('ename').value,
                          group: document.getElementById('egroup').value,
                          language: document.getElementById('elang').value,
                          channel: document.getElementById('echannel').value,
                          parentContact: document.getElementById('econtact').value,
                          consent: document.getElementById('econsent').checked
                        })
                      });
                      go('learners');
                    })
                  }
                >
                  Save changes
                </Button>
                <Button
                  secondary
                  onClick={() => {
                    if (confirm('Delete learner?'))
                      run(async () => {
                        await api('/learners/' + l.id, { method: 'DELETE' });
                        go('learners');
                      });
                  }}
                >
                  Delete learner
                </Button>
              </div>
            </main>
          );
        })()}

      {/* 16. Settings Screen */}
      {page === 'settings' && (
        <main>
          {header('Class settings')}
          <div className="card">
            <h3>{data.classroom.name}</h3>
            <p>Teacher: {data.classroom.teacher}</p>
            <p>
              Class code: <b>{data.classroom.code}</b>
            </p>
            <Button onClick={() => go('setup')}>Edit class details</Button>
            <Button secondary onClick={() => go('learners')}>
              Manage learners
            </Button>
          </div>

          <div className="card">
            <h3>Mobile App & Storage</h3>
            <div className="status-badge-row">
              <span className="badge-pill online">
                <ShieldCheck size={14} /> Standalone Mobile PWA Active
              </span>
            </div>
            <p className="muted">
              All data (learners, reading results, notes) is stored directly on your phone and works
              100% offline.
            </p>

            <div className="mobile-action-buttons">
              {installPrompt && (
                <Button onClick={handleInstallClick}>
                  <Download size={16} /> Install App to Phone
                </Button>
              )}
              <Button secondary onClick={handleExportBackup}>
                <Download size={16} /> Backup Class Data (.json)
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".json"
                onChange={handleImportBackup}
              />
              <Button secondary onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} /> Restore from Backup
              </Button>
              <Button secondary className="danger-btn" onClick={handleResetDemo}>
                <RotateCcw size={16} /> Reset Demo Data
              </Button>
            </div>
          </div>

          <div className="card">
            <h3>Assessment history</h3>
            {assessments.length === 0 ? (
              <p className="muted">No assessments recorded in this session yet.</p>
            ) : (
              assessments.map(a => (
                <p key={a.id} className="history-row">
                  <b>{learners.find(l => l.id === a.learnerId)?.name || 'Learner'}</b> ·{' '}
                  {a.accuracy}% accuracy · {a.wpm} WPM ·{' '}
                  <span className="muted">{new Date(a.createdAt).toLocaleDateString()}</span>
                </p>
              ))
            )}
          </div>
          <p className="muted">
            Standalone Mobile PWA. Do not use real children's sensitive personal data in this demo.
          </p>
        </main>
      )}

      {/* SA-SAMS & MTN Foundation Integration Modal */}
      {showIntegrationModal && (
        <div className="modal-overlay" onClick={() => setShowIntegrationModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reporting & Integration Readiness</h2>
              <button
                className="close-btn"
                onClick={() => setShowIntegrationModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-tabs">
              <button
                className={integrationTab === 'sasams' ? 'active' : ''}
                onClick={() => setIntegrationTab('sasams')}
              >
                SA-SAMS Export (DBE)
              </button>
              <button
                className={integrationTab === 'mtn' ? 'active' : ''}
                onClick={() => setIntegrationTab('mtn')}
              >
                MTN Foundation (POPIA)
              </button>
            </div>

            {integrationTab === 'sasams' ? (
              <div>
                <p style={{ fontSize: '12px', color: '#494c69' }}>
                  Formatted for direct integration with the South African School Administration and
                  Management System (SA-SAMS). Includes learner reading tier marks across all four
                  terms.
                </p>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <table className="export-table">
                    <thead>
                      <tr>
                        <th>Ref</th>
                        <th>Learner</th>
                        <th>Lang</th>
                        <th>Tier</th>
                        <th>T1</th>
                        <th>T2</th>
                        <th>T3</th>
                        <th>T4</th>
                      </tr>
                    </thead>
                    <tbody>
                      {learners.map(l => (
                        <tr key={l.id}>
                          <td>SASAMS-{l.id}</td>
                          <td><b>{l.name}</b></td>
                          <td>{l.language}</td>
                          <td>{l.group}</td>
                          <td>{l.termProgress?.[0]?.wpm || '-'}</td>
                          <td>{l.termProgress?.[1]?.wpm || '-'}</td>
                          <td>{l.termProgress?.[2]?.wpm || '-'}</td>
                          <td>{l.termProgress?.[3]?.wpm || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button onClick={handleDownloadSasamsCsv} style={{ marginTop: '14px' }}>
                  <Download size={16} /> Export SA-SAMS CSV Spreadsheet
                </Button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '12px', color: '#494c69' }}>
                  <strong>MTN Foundation Dashboard Feed:</strong> Only anonymous totals reach the
                  dashboard. No child names, voice recordings, or personal identifiers are transmitted.
                </p>
                <div className="card" style={{ background: '#f8f9ff', padding: '12px', fontSize: '12px' }}>
                  <div><b>Total Learners:</b> {learners.length}</div>
                  <div><b>Consented Learners:</b> {learners.filter(l => l.consent).length}</div>
                  <div><b>Promoted Tiers:</b> {yearSummary.movedUp} learners</div>
                  <div><b>Zero-Rated Reach:</b> 100% via MTN zero-rated channels (SMS/WhatsApp)</div>
                  <div><b>Compliance:</b> POPIA Certified · Anonymized aggregated metrics only</div>
                </div>
                <div className="sync-banner" style={{ marginTop: '10px' }}>
                  <span className="green-dot">●</span>
                  <span>Active sync with MTN Foundation Dashboard · Zero-rated network active</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5-Tab Bottom Navigation matching PDF */}
      {['dashboard', 'groups', 'notes', 'activities', 'progress', 'terms'].includes(page) && nav}
    </div>
  );
}
