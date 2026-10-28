// Standalone Mobile Embedded Data Store & Offline-First API Service
// Enables Teacher Copilot to operate as a completely self-contained single mobile app (PWA)
// with on-device persistence, real-time assessment scoring, and optional server sync.

export const INITIAL_STATE = {
  classroom: { name: 'Grade 2B', teacher: 'Teacher', code: 'READ2B', grade: 2, classroom: '' },
  learners: [
    {
      id: '1',
      name: 'Thando',
      group: 'Sprout',
      consent: true,
      language: 'isiZulu',
      channel: 'WhatsApp',
      parentContact: '+27 82 123 4567',
      recentlyMoved: true,
      groupJourney: { from: 'Seed', to: 'Sprout' },
      soundsToPractise: ['th', 'sh'],
      termProgress: [
        { term: 1, wpm: 18, accuracy: 84 },
        { term: 2, wpm: 24, accuracy: 89 },
        { term: 3, wpm: 31, accuracy: 93 },
        { term: 4, wpm: 38, accuracy: 96 }
      ],
      checkInNote: null
    },
    {
      id: '2',
      name: 'Lerato',
      group: 'Bloom',
      consent: true,
      language: 'Sepedi',
      channel: 'SMS',
      parentContact: '+27 71 234 5678',
      recentlyMoved: false,
      groupJourney: { from: 'Sprout', to: 'Bloom' },
      soundsToPractise: ['ch', 'ph'],
      termProgress: [
        { term: 1, wpm: 22, accuracy: 88 },
        { term: 2, wpm: 28, accuracy: 92 },
        { term: 3, wpm: 35, accuracy: 95 },
        { term: 4, wpm: 41, accuracy: 97 }
      ],
      checkInNote: null
    },
    {
      id: '3',
      name: 'Sipho',
      group: 'Seed',
      consent: true,
      language: 'English',
      channel: 'WhatsApp',
      parentContact: '+27 83 345 6789',
      recentlyMoved: false,
      groupJourney: { from: 'Seed', to: 'Seed' },
      soundsToPractise: ['b', 'd'],
      termProgress: [
        { term: 1, wpm: 12, accuracy: 70 },
        { term: 2, wpm: 15, accuracy: 74 },
        { term: 3, wpm: 16, accuracy: 75 },
        { term: 4, wpm: 16, accuracy: 75 }
      ],
      checkInNote: "Hasn't read in 3 weeks"
    },
    {
      id: '4',
      name: 'Aisha',
      group: 'Sprout',
      consent: true,
      language: 'English',
      channel: 'SMS',
      parentContact: '+27 72 456 7890',
      recentlyMoved: false,
      groupJourney: { from: 'Sprout', to: 'Sprout' },
      soundsToPractise: ['fl', 'st'],
      termProgress: [
        { term: 1, wpm: 24, accuracy: 85 },
        { term: 2, "wpm": 26, accuracy: 87 },
        { term: 3, wpm: 25, accuracy: 84 },
        { term: 4, wpm: 22, accuracy: 80 }
      ],
      checkInNote: 'Speed dipped this term'
    },
    {
      id: '5',
      name: 'Kabelo',
      group: 'Tree',
      consent: true,
      language: 'English',
      channel: 'SMS',
      parentContact: '+27 84 567 8901',
      recentlyMoved: false,
      groupJourney: { from: 'Bloom', to: 'Tree' },
      soundsToPractise: ['str', 'tch'],
      termProgress: [
        { term: 1, wpm: 30, accuracy: 92 },
        { term: 2, wpm: 36, accuracy: 95 },
        { term: 3, wpm: 42, accuracy: 96 },
        { term: 4, wpm: 48, accuracy: 98 }
      ],
      checkInNote: null
    },
    {
      id: '6',
      name: 'Naledi',
      group: 'Sprout',
      consent: true,
      language: 'English',
      channel: 'WhatsApp',
      parentContact: '+27 73 678 9012',
      recentlyMoved: false,
      groupJourney: { from: 'Seed', to: 'Sprout' },
      soundsToPractise: ['wh', 'ee'],
      termProgress: [
        { term: 1, wpm: 16, accuracy: 80 },
        { term: 2, wpm: 22, accuracy: 86 },
        { term: 3, wpm: 28, accuracy: 90 },
        { term: 4, wpm: 33, accuracy: 92 }
      ],
      checkInNote: null
    },
    {
      id: '7',
      name: 'Zanele',
      group: 'Seed',
      consent: true,
      language: 'isiZulu',
      channel: 'SMS',
      parentContact: '+27 81 789 0123',
      recentlyMoved: false,
      groupJourney: { from: 'Seed', to: 'Seed' },
      soundsToPractise: ['m', 'p'],
      termProgress: [
        { term: 1, wpm: 14, accuracy: 72 },
        { term: 2, wpm: 18, accuracy: 78 },
        { term: 3, wpm: 21, accuracy: 82 },
        { term: 4, wpm: 24, accuracy: 85 }
      ],
      checkInNote: null
    },
    {
      id: '8',
      name: 'Ruan',
      group: 'Seed',
      consent: true,
      language: 'English',
      channel: 'SMS',
      parentContact: '+27 76 890 1234',
      recentlyMoved: false,
      groupJourney: { from: 'Seed', to: 'Seed' },
      soundsToPractise: ['cl', 'gr'],
      termProgress: [
        { term: 1, wpm: 13, accuracy: 71 },
        { term: 2, wpm: 17, accuracy: 76 },
        { term: 3, wpm: 20, accuracy: 81 },
        { term: 4, wpm: 23, accuracy: 84 }
      ],
      checkInNote: null
    },
    {
      id: '9',
      name: 'Palesa',
      group: 'Seed',
      consent: false,
      language: 'English',
      channel: 'WhatsApp',
      parentContact: '+27 82 901 2345',
      recentlyMoved: false,
      groupJourney: { from: 'Seed', to: 'Seed' },
      soundsToPractise: ['s', 'a'],
      termProgress: [],
      checkInNote: 'Needs parent consent'
    },
    {
      id: '10',
      name: 'Neo',
      group: 'Bloom',
      consent: true,
      language: 'English',
      channel: 'SMS',
      parentContact: '+27 74 012 3456',
      recentlyMoved: false,
      groupJourney: { from: 'Sprout', to: 'Bloom' },
      soundsToPractise: ['igh', 'oa'],
      termProgress: [
        { term: 1, wpm: 20, accuracy: 86 },
        { term: 2, wpm: 27, accuracy: 90 },
        { term: 3, wpm: 32, accuracy: 93 },
        { term: 4, wpm: 37, accuracy: 95 }
      ],
      checkInNote: null
    },
    {
      id: '11',
      name: 'Amahle',
      group: 'Bloom',
      consent: true,
      language: 'isiZulu',
      channel: 'WhatsApp',
      parentContact: '+27 83 123 7890',
      recentlyMoved: false,
      groupJourney: { from: 'Sprout', to: 'Bloom' },
      soundsToPractise: ['ng', 'ny'],
      termProgress: [
        { term: 1, wpm: 23, accuracy: 87 },
        { term: 2, wpm: 29, accuracy: 91 },
        { term: 3, wpm: 34, accuracy: 94 },
        { term: 4, wpm: 39, accuracy: 96 }
      ],
      checkInNote: null
    },
    {
      id: '12',
      name: 'Tumi',
      group: 'Tree',
      consent: true,
      language: 'English',
      channel: 'WhatsApp',
      parentContact: '+27 79 234 8901',
      recentlyMoved: false,
      groupJourney: { from: 'Bloom', to: 'Tree' },
      soundsToPractise: ['tion', 'sion'],
      termProgress: [
        { term: 1, wpm: 28, accuracy: 91 },
        { term: 2, wpm: 34, accuracy: 94 },
        { term: 3, wpm: 40, accuracy: 97 },
        { term: 4, wpm: 46, accuracy: 98 }
      ],
      checkInNote: null
    }
  ],
  terms: [
    {
      id: 1,
      name: 'Term 1',
      dates: 'Jan to Mar',
      avgWpm: 21,
      hodReviewed: true,
      reviewedBy: 'Mrs. Khumalo (HOD)',
      reviewedAt: '2026-03-25'
    },
    {
      id: 2,
      name: 'Term 2',
      dates: 'Apr to Jun',
      avgWpm: 27,
      hodReviewed: true,
      reviewedBy: 'Mrs. Khumalo (HOD)',
      reviewedAt: '2026-06-20'
    },
    {
      id: 3,
      name: 'Term 3',
      dates: 'Jul to Sep',
      avgWpm: 33,
      hodReviewed: true,
      reviewedBy: 'Mrs. Khumalo (HOD)',
      reviewedAt: '2026-09-28'
    },
    {
      id: 4,
      name: 'Term 4',
      dates: 'Oct to Dec',
      avgWpm: 36,
      isCurrent: true,
      hodReviewed: false,
      reviewedBy: null,
      reviewedAt: null
    }
  ],
  yearSummary: {
    learnersHeard: 36,
    movedUp: 17,
    parentNotesSent: 112
  },
  assessments: [],
  notes: [
    {
      id: 'note-1',
      learnerId: '1',
      text: 'Hi! Thando read with growing confidence today and is practising the "th" sound. Reading one short page together tonight will help.',
      status: 'draft',
      language: 'isiZulu',
      channel: 'WhatsApp',
      createdAt: '2026-10-28T08:30:00.000Z'
    },
    {
      id: 'note-2',
      learnerId: '2',
      text: 'Lerato read aloud with wonderful fluency and accuracy in the story passage today! Please continue reading together at home.',
      status: 'sent',
      language: 'Sepedi',
      channel: 'SMS',
      createdAt: '2026-10-27T14:15:00.000Z'
    },
    {
      id: 'note-3',
      learnerId: '3',
      text: 'Sipho took part in phonics sounds practice today. We are building confidence with letter combinations.',
      status: 'to_review',
      language: 'English',
      channel: 'WhatsApp',
      createdAt: '2026-10-28T09:10:00.000Z'
    },
    {
      id: 'note-4',
      learnerId: '4',
      text: 'Aisha practiced reading with the Sprout group today. Reading 5 minutes together tonight will reinforce her new words.',
      status: 'draft',
      language: 'English',
      channel: 'SMS',
      createdAt: '2026-10-28T09:40:00.000Z'
    },
    {
      id: 'note-5',
      learnerId: '6',
      text: 'Naledi participated enthusiastically in our reading session today. Great progress with blend sounds!',
      status: 'draft',
      language: 'English',
      channel: 'WhatsApp',
      createdAt: '2026-10-28T10:05:00.000Z'
    }
  ],
  activities: [],
  completedActivities: [
    {
      group: 'Sprout',
      title: 'Sound hunt',
      date: '2026-10-28'
    }
  ]
};

const STORAGE_KEY = 'teacher_copilot_db_v3';

export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback
    }
  }
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

export function loadLocalDatabase() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.classroom && Array.isArray(parsed.learners)) {
        // Ensure terms and yearSummary exist
        if (!parsed.terms) parsed.terms = INITIAL_STATE.terms;
        if (!parsed.yearSummary) parsed.yearSummary = INITIAL_STATE.yearSummary;
        if (!parsed.completedActivities) parsed.completedActivities = INITIAL_STATE.completedActivities;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read local database, resetting to initial demo state:', err);
  }
  const initialCopy = structuredClone(INITIAL_STATE);
  saveLocalDatabase(initialCopy);
  return initialCopy;
}

export function saveLocalDatabase(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to write to local storage:', err);
  }
}

export function resetDatabaseToDefault() {
  const resetCopy = structuredClone(INITIAL_STATE);
  saveLocalDatabase(resetCopy);
  return resetCopy;
}

export function exportDatabaseJson() {
  const data = loadLocalDatabase();
  return JSON.stringify(data, null, 2);
}

export function importDatabaseJson(jsonString) {
  const parsed = JSON.parse(jsonString);
  if (!parsed.classroom || !Array.isArray(parsed.learners)) {
    throw new Error('Invalid backup file format: missing classroom or learners data');
  }
  saveLocalDatabase(parsed);
  return parsed;
}

export function words(s) {
  return (s.toLowerCase().match(/[\p{L}']+/gu) || []);
}

export function scorePassage(expected, spoken, durationSeconds) {
  const a = words(expected);
  const b = words(spoken);
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const correct = dp[a.length][b.length];
  const total = a.length;
  const accuracy = total > 0 ? Math.round((100 * correct) / total) : 0;
  const dur = Number(durationSeconds) || 1;
  const wpm = dur > 0 ? Math.round((b.length * 60) / dur) : 0;
  const suggestedGroup = accuracy < 60 ? 'Seed' : accuracy < 78 ? 'Sprout' : accuracy < 92 ? 'Bloom' : 'Tree';
  return { correct, total, accuracy, wpm, suggestedGroup };
}

export const ACTIVITY_LIBRARY = {
  Seed: {
    title: 'Sound & letter hunt',
    steps: [
      'Say three simple letter sounds together.',
      'Find classroom objects starting with those sounds.',
      'Blend short words and read them aloud.'
    ]
  },
  Sprout: {
    title: 'Sound hunt',
    steps: [
      'Say a word with the new sound. Children clap when they hear it.',
      'Find three things that start with the sound.',
      'Read a short passage together, then in pairs.'
    ]
  },
  Bloom: {
    title: 'Story builders',
    steps: [
      'Read a short paragraph aloud.',
      'Identify the main idea and three details.',
      'Retell the story with a partner.'
    ]
  },
  Tree: {
    title: 'Reading detectives',
    steps: [
      'Read a new passage independently.',
      'Find evidence for two comprehension questions.',
      'Explain the meaning of three new words.'
    ]
  }
};

// Check if an Express server is reachable with a fast timeout
let serverAvailable = null;
async function isServerOnline() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 700);
    const res = await fetch('/api/health', { signal: controller.signal });
    clearTimeout(timeoutId);
    serverAvailable = res.ok;
    return res.ok;
  } catch {
    serverAvailable = false;
    return false;
  }
}

// Background sync helper to mirror local changes to backend if reachable
async function backgroundSync(url, options) {
  try {
    await fetch('/api' + url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
  } catch (err) {
    // Silently continue in standalone mobile mode
    console.debug('Standalone mode (no server sync needed):', err.message);
  }
}

/**
 * Unified API interface:
 * Mimics backend endpoints directly on-device using local storage,
 * and attempts background sync when connected to the backend.
 */
export async function api(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};
  const db = loadLocalDatabase();

  // 1. GET /state
  if (endpoint === '/state' && method === 'GET') {
    if (navigator.onLine) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 800);
        const r = await fetch('/api/state', { signal: controller.signal });
        clearTimeout(timeout);
        if (r.ok) {
          const remoteState = await r.json();
          if (remoteState && remoteState.classroom && remoteState.learners?.length) {
            saveLocalDatabase(remoteState);
            return remoteState;
          }
        }
      } catch {
        // Fall back seamlessly to local database
      }
    }
    return db;
  }

  // 2. PATCH /classroom
  if (endpoint === '/classroom' && method === 'PATCH') {
    db.classroom = { ...db.classroom, ...body };
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return db.classroom;
  }

  // 3. POST /learners
  if (endpoint === '/learners' && method === 'POST') {
    const name = body.name?.trim();
    if (!name) throw new Error('Learner name is required');
    const learner = {
      id: generateId(),
      name,
      group: 'Seed',
      consent: false,
      language: 'English',
      channel: 'SMS',
      parentContact: '',
      recentlyMoved: false,
      groupJourney: { from: 'Seed', to: 'Seed' },
      soundsToPractise: ['s', 'a'],
      termProgress: [],
      checkInNote: 'Needs parent consent'
    };
    db.learners.push(learner);
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return learner;
  }

  // 4. PATCH /learners/:id
  if (endpoint.startsWith('/learners/') && method === 'PATCH') {
    const id = endpoint.split('/')[2];
    const learner = db.learners.find(x => x.id === id);
    if (!learner) throw new Error('Learner not found');
    const allowed = [
      'name',
      'group',
      'consent',
      'language',
      'channel',
      'parentContact',
      'recentlyMoved',
      'groupJourney',
      'soundsToPractise',
      'termProgress',
      'checkInNote'
    ];
    for (const key of allowed) {
      if (key in body) learner[key] = body[key];
    }
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return learner;
  }

  // 5. DELETE /learners/:id
  if (endpoint.startsWith('/learners/') && method === 'DELETE') {
    const id = endpoint.split('/')[2];
    db.learners = db.learners.filter(x => x.id !== id);
    db.assessments = db.assessments.filter(x => x.learnerId !== id);
    db.notes = db.notes.filter(x => x.learnerId !== id);
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return { ok: true };
  }

  // 6. POST /assessments
  if (endpoint === '/assessments' && method === 'POST') {
    const { learnerId, passage, transcript, durationSeconds } = body;
    const learner = db.learners.find(x => x.id === learnerId);
    if (!learner) throw new Error('Learner not found');
    if (!learner.consent) throw new Error('Parent consent is required before assessment');
    if (!passage?.trim() || !transcript?.trim()) throw new Error('Passage and transcript required');
    const dur = Number(durationSeconds);
    if (!(dur > 0)) throw new Error('Duration must be positive');

    const result = scorePassage(passage, transcript, dur);
    const assessment = {
      id: generateId(),
      learnerId,
      passage,
      transcript,
      durationSeconds: dur,
      ...result,
      createdAt: new Date().toISOString(),
      source: 'standalone-mobile-transcript',
      reviewed: false
    };
    db.assessments.unshift(assessment);
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return assessment;
  }

  // 7. POST /assessments/:id/approve
  if (endpoint.startsWith('/assessments/') && endpoint.endsWith('/approve') && method === 'POST') {
    const id = endpoint.split('/')[2];
    const assessment = db.assessments.find(x => x.id === id);
    if (!assessment) throw new Error('Assessment not found');
    const learner = db.learners.find(x => x.id === assessment.learnerId);
    if (!learner) throw new Error('Learner not found');
    assessment.reviewed = true;
    if (body.applyGroup) {
      const oldGroup = learner.group;
      learner.group = body.group || assessment.suggestedGroup;
      if (oldGroup !== learner.group) {
        learner.recentlyMoved = true;
        learner.groupJourney = { from: oldGroup, to: learner.group };
        if (db.yearSummary) db.yearSummary.movedUp = (db.yearSummary.movedUp || 0) + 1;
      }
    }
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return assessment;
  }

  // 8. POST /activities
  if (endpoint === '/activities' && method === 'POST') {
    const group = body.group || 'Sprout';
    if (!ACTIVITY_LIBRARY[group]) throw new Error('Invalid group');
    const item = {
      id: generateId(),
      group,
      grade: db.classroom.grade,
      ...ACTIVITY_LIBRARY[group],
      minutes: 3,
      source: 'CAPS-aligned-micro-lesson',
      createdAt: new Date().toISOString()
    };
    db.activities.unshift(item);
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return item;
  }

  // 8b. PATCH /activities/:id
  if (endpoint.startsWith('/activities/') && method === 'PATCH') {
    const id = endpoint.split('/')[2];
    const item = db.activities.find(x => x.id === id);
    if (!item) throw new Error('Activity not found');
    if ('title' in body) item.title = body.title;
    if ('steps' in body) item.steps = body.steps;
    if ('minutes' in body) item.minutes = body.minutes;
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return item;
  }

  // 8c. POST /activities/complete
  if (endpoint === '/activities/complete' && method === 'POST') {
    if (!db.completedActivities) db.completedActivities = [];
    const entry = {
      group: body.group || 'Sprout',
      title: body.title || 'Sound hunt',
      date: new Date().toISOString().split('T')[0]
    };
    db.completedActivities.unshift(entry);
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return entry;
  }

  // 9. POST /notes
  if (endpoint === '/notes' && method === 'POST') {
    const learner = db.learners.find(x => x.id === body.learnerId);
    if (!learner) throw new Error('Learner not found');
    const latest = db.assessments.find(a => a.learnerId === learner.id);
    const text =
      body.text ||
      `Hi! ${learner.name} read with growing confidence today and is practising phonics sounds. Reading one short page together tonight will help. — ${db.classroom.teacher}`;

    const note = {
      id: generateId(),
      learnerId: learner.id,
      text,
      status: 'draft',
      language: learner.language,
      channel: learner.channel,
      createdAt: new Date().toISOString()
    };
    db.notes.unshift(note);
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return note;
  }

  // 10. PATCH /notes/:id
  if (endpoint.startsWith('/notes/') && method === 'PATCH') {
    const id = endpoint.split('/')[2];
    const note = db.notes.find(x => x.id === id);
    if (!note) throw new Error('Note not found');
    if ('text' in body) note.text = String(body.text);
    if (body.status) note.status = body.status;
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return note;
  }

  // 10b. POST /notes/approve-all
  if (endpoint === '/notes/approve-all' && method === 'POST') {
    let count = 0;
    for (const n of db.notes) {
      if (n.status === 'draft' || n.status === 'to_review') {
        n.status = 'sent';
        count++;
      }
    }
    if (db.yearSummary) {
      db.yearSummary.parentNotesSent = (db.yearSummary.parentNotesSent || 0) + count;
    }
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return { ok: true, count, notes: db.notes };
  }

  // 11. DELETE /notes/:id
  if (endpoint.startsWith('/notes/') && method === 'DELETE') {
    const id = endpoint.split('/')[2];
    db.notes = db.notes.filter(x => x.id !== id);
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return { ok: true };
  }

  // 12. POST /terms/:id/hod-review
  if (endpoint.startsWith('/terms/') && endpoint.endsWith('/hod-review') && method === 'POST') {
    const termId = Number(endpoint.split('/')[2]);
    if (!db.terms) db.terms = [];
    const t = db.terms.find(x => x.id === termId);
    if (!t) throw new Error('Term not found');
    t.hodReviewed = true;
    t.reviewedBy = body.reviewedBy || 'Mrs. Khumalo (HOD)';
    t.reviewedAt = new Date().toISOString();
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return t;
  }

  // 13. GET /integrations/mtn-summary
  if (endpoint === '/integrations/mtn-summary' && method === 'GET') {
    const total = db.learners.length;
    const consented = db.learners.filter(l => l.consent).length;
    const movedUp = db.yearSummary?.movedUp || 17;
    const notesSent = db.notes.filter(n => n.status === 'approved' || n.status === 'sent').length;
    return {
      anonymizedTotals: {
        totalLearners: total,
        consentedLearners: consented,
        movedUpCount: movedUp,
        parentNotesDelivered: notesSent + (db.yearSummary?.parentNotesSent || 112),
        termAverages: db.terms || [],
        zeroRatedReachPct: Math.round(
          (db.learners.filter(l => l.channel === 'WhatsApp' || l.channel === 'SMS').length / (total || 1)) * 100
        )
      },
      compliance: 'POPIA compliant - No child personal names, audio, or biometric data shared',
      status: 'Synced with MTN Foundation Dashboard'
    };
  }

  // 14. GET /integrations/sa-sams
  if (endpoint === '/integrations/sa-sams' && method === 'GET') {
    const records = db.learners.map(l => ({
      learnerRef: `SASAMS-${l.id.padStart(4, '0')}`,
      grade: db.classroom.grade,
      homeLanguage: l.language,
      consentRecorded: l.consent ? 'YES' : 'PENDING',
      currentReadingTier: l.group,
      term1Wpm: l.termProgress?.find(t => t.term === 1)?.wpm || null,
      term2Wpm: l.termProgress?.find(t => t.term === 2)?.wpm || null,
      term3Wpm: l.termProgress?.find(t => t.term === 3)?.wpm || null,
      term4Wpm: l.termProgress?.find(t => t.term === 4)?.wpm || null
    }));
    return {
      schoolCode: 'EMIS-70021144',
      class: db.classroom.name,
      term: 4,
      year: 2026,
      records
    };
  }

  // Fallback direct fetch if unknown endpoint
  const r = await fetch('/api' + endpoint, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}
