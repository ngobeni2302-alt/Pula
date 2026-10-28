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
  ShieldCheck
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
  const current = learners.find(l => l.id === selected);
  const counts = Object.fromEntries(groups.map(g => [g, learners.filter(l => l.group === g).length]));

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
    go({ class: 'dashboard', read: 'choose', groups: 'groups', notes: 'notes' }[t]);
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
        ['notes', MessageSquare, 'Notes']
      ].map(([k, Icon, label]) => (
        <button key={k} className={tab === k ? 'active' : ''} onClick={() => chooseTab(k)}>
          <Icon size={19} />
          <small>{label}</small>
        </button>
      ))}
    </nav>
  );

  const header = (title, back = 'dashboard') => (
    <div className="page-header">
      <button className="back" onClick={() => go(back)}>
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
                {data.classroom.name} · {learners.length} learners
              </p>
            </div>
            <button className="icon-btn" onClick={() => go('settings')} aria-label="Settings">
              <Settings size={20} />
            </button>
          </div>

          <div className="coral-card">
            <h2>Reading round</h2>
            <p>Hear each learner read aloud, one at a time. Pula helps you keep track.</p>
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

          <button className="note-banner" onClick={() => chooseTab('notes')}>
            <span>▤</span>
            <div>
              <strong>{notes.filter(n => n.status === 'draft').length} parent notes ready</strong>
              <small>Drafts need your approval.</small>
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
          </div>
        </main>
      )}

      {page === 'choose' && (
        <main>
          {header("Who's reading?")}
          <div className="info-banner">
            <BookOpen size={25} />
            <div>
              <small>Reading task</small>
              <strong>Short passage · Phonics</strong>
            </div>
            <button onClick={() => go('passages')}>Change</button>
          </div>
          <div className="learner-grid">
            {learners.map(l => (
              <button
                key={l.id}
                className={
                  'learner-tile ' +
                  (selected === l.id ? 'selected' : '') +
                  (!l.consent ? 'locked' : '')
                }
                onClick={() => setSelected(l.id)}
              >
                <span className="avatar">{l.consent ? l.name[0] : '♙'}</span>
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
              ? 'I’m listening. Take your time.'
              : speaking
              ? 'Pula is reading...'
              : 'Take your time. I’m here.'}
          </div>

          <p className="duration">
            {recording ? 'Listening · ' : 'Reading time · '}
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </p>

          <textarea
            className="transcript"
            aria-label="Recognized words"
            placeholder="Recognized words appear here. You can also type or correct the transcript."
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
          />

          <div className="reading-buttons">
            <Button
              secondary
              onClick={() => {
                stop();
                setTranscript('');
                setSeconds(0);
              }}
            >
              <RefreshCcw size={15} /> Reset
            </Button>

            <Button secondary onClick={readAloud}>
              {speaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
              {speaking ? 'Stop' : 'Pula read'}
            </Button>

            {recording ? (
              <Button onClick={stop}>Stop listening</Button>
            ) : (
              <Button onClick={listen}>
                <Mic size={16} /> Listen
              </Button>
            )}
          </div>

          <Button
            className="done"
            disabled={busy || !transcript.trim() || seconds < 1}
            onClick={submit}
          >
            I'm done <Check size={17} />
          </Button>
          <small className="muted">
            Microphone recognition works directly on-device. Teacher review is required.
          </small>
        </main>
      )}

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
                Suggested group: <b>{result.suggestedGroup}</b> (not yet applied)
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
                {result.reviewed ? 'Group reviewed ✓' : 'Approve suggested group'}
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

      {page === 'groups' && (
        <main className="with-nav">
          {header('Reading groups')}
          <div className="info-banner">
            <Pula />
            <p>Pula suggests groups. You decide. Tap a learner to move them.</p>
          </div>
          {groups.map(g => (
            <section className="group-card" key={g}>
              <div className="group-card-heading">
                <GroupIcon group={g} />
                <h3>{g}</h3>
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
              <span>CAPS-inspired · Grade {data.classroom.grade}</span>
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
              A 10-minute micro-lesson for this reading group. Editable template; not AI-generated
              or officially CAPS-certified.
            </p>
            {(activity?.group === group
              ? activity.steps
              : {
                  Seed: [
                    'Say three simple letter sounds together.',
                    'Find objects starting with those sounds.',
                    'Blend short words aloud.'
                  ],
                  Sprout: [
                    'Say a word with the new sound.',
                    'Find three things beginning with that sound.',
                    'Read a short passage together.'
                  ],
                  Bloom: [
                    'Read a short paragraph aloud.',
                    'Identify the main idea and details.',
                    'Retell the story with a partner.'
                  ],
                  Tree: [
                    'Read a passage independently.',
                    'Answer two questions with evidence.',
                    'Explain three new words.'
                  ]
                }[group]
            ).map((s, i) => (
              <div className="activity-step" key={i}>
                <span>{i + 1}</span>
                <p>{s}</p>
                <small>{i === 0 ? '2 min' : '4 min'}</small>
              </div>
            ))}
            <Button
              className="coral"
              onClick={() =>
                run(async () =>
                  setActivity(
                    await api('/activities', {
                      method: 'POST',
                      body: JSON.stringify({ group })
                    })
                  )
                )
              }
            >
              ▶ {activity?.group === group ? 'Restart' : 'Start with ' + group}
            </Button>
          </div>
          <div className="info-banner">
            Whole-class warm-up <b>5 min</b>
          </div>
          <Button onClick={() => chooseTab('notes')}>
            Review parent notes <ArrowRight size={16} />
          </Button>
        </main>
      )}

      {page === 'notes' && (
        <main className="with-nav">
          {header('Parent notes')}
          <div className="info-banner">
            <Pula />
            <p>
              Nothing is sent until you approve. Approval saves to the mobile record. No external
              SMS sent.
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
                    {l.name}
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
                    <small>
                      {n.language} · {n.channel}
                    </small>
                  </div>
                  <span className={'status ' + n.status}>{n.status}</span>
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
                  {n.status === 'draft' && (
                    <button
                      className="approve"
                      onClick={() =>
                        run(async () =>
                          api('/notes/' + n.id, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: 'approved' })
                          })
                        )
                      }
                    >
                      <Check size={14} /> Approve
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <p className="muted">
            Approved notes are stored safely in your mobile app.
          </p>
        </main>
      )}

      {page === 'learners' && (
        <main>
          {header('Manage learners')}
          <div className="card">
            <h3>Add learner</h3>
            <input id="newlearner" placeholder="Learner name" />
            <Button
              onClick={() =>
                run(async () => {
                  await api('/learners', {
                    method: 'POST',
                    body: JSON.stringify({ name: document.getElementById('newlearner').value })
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
                  {l.group} · {l.consent ? 'Consent recorded' : 'No consent'}
                </small>
              </div>
              <ChevronRight />
            </button>
          ))}
        </main>
      )}

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
                    <option>SMS</option>
                    <option>WhatsApp</option>
                  </select>
                </label>
                <label>
                  Parent contact
                  <input
                    id="econtact"
                    defaultValue={l.parentContact}
                    placeholder="Optional; stored locally"
                  />
                </label>
                <label className="checkline">
                  <input type="checkbox" id="econsent" defaultChecked={l.consent} /> Parent/guardian
                  consent confirmed
                </label>
                <p className="muted">
                  Only mark consent after obtaining valid consent outside this demo.
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
              <p className="muted">No assessments yet.</p>
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

      {['dashboard', 'groups', 'notes', 'activities'].includes(page) && nav}
    </div>
  );
}
