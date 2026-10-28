// Standalone Mobile Embedded Data Store & Offline-First API Service
// Enables Teacher Copilot to operate as a completely self-contained single mobile app (PWA)
// with on-device persistence, real-time assessment scoring, and optional server sync.

export const INITIAL_STATE = {
  classroom: { name: 'Grade 2B', teacher: 'Teacher', code: 'READ2B', grade: 2 },
  learners: [
    ['1', 'Thando', 'Sprout', true, 'isiZulu', 'WhatsApp'],
    ['2', 'Lerato', 'Bloom', true, 'Sepedi', 'SMS'],
    ['3', 'Sipho', 'Seed', true, 'English', 'WhatsApp'],
    ['4', 'Aisha', 'Sprout', true, 'English', 'SMS'],
    ['5', 'Kabelo', 'Tree', true, 'English', 'SMS'],
    ['6', 'Naledi', 'Sprout', true, 'English', 'WhatsApp'],
    ['7', 'Zanele', 'Seed', true, 'isiZulu', 'SMS'],
    ['8', 'Ruan', 'Seed', true, 'English', 'SMS'],
    ['9', 'Palesa', 'Seed', false, 'English', 'WhatsApp'],
    ['10', 'Neo', 'Bloom', true, 'English', 'SMS'],
    ['11', 'Amahle', 'Bloom', true, 'isiZulu', 'WhatsApp'],
    ['12', 'Tumi', 'Tree', true, 'English', 'WhatsApp']
  ].map(([id, name, group, consent, language, channel]) => ({
    id,
    name,
    group,
    consent,
    language,
    channel,
    parentContact: ''
  })),
  assessments: [],
  notes: [],
  activities: []
};

const STORAGE_KEY = 'teacher_copilot_db_v2';

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
    // If backend is active, try to fetch fresh state, otherwise use on-device DB
    if (navigator.onLine) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 800);
        const r = await fetch('/api/state', { signal: controller.signal });
        clearTimeout(timeout);
        if (r.ok) {
          const remoteState = await r.json();
          // Merge or adopt remote state if it has learners
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
      parentContact: ''
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
    const allowed = ['name', 'group', 'consent', 'language', 'channel', 'parentContact'];
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
      learner.group = body.group || assessment.suggestedGroup;
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
      minutes: 10,
      source: 'editable-template-not-AI',
      createdAt: new Date().toISOString()
    };
    db.activities.unshift(item);
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return item;
  }

  // 9. POST /notes
  if (endpoint === '/notes' && method === 'POST') {
    const learner = db.learners.find(x => x.id === body.learnerId);
    if (!learner) throw new Error('Learner not found');
    const latest = db.assessments.find(a => a.learnerId === learner.id);
    const text =
      body.text ||
      `Hello! ${learner.name} took part in reading practice today. ${
        latest
          ? `Their latest practice showed ${latest.accuracy}% word-match accuracy in the selected passage.`
          : 'We are encouraging steady reading practice.'
      } Please read a short page together at home. — ${db.classroom.teacher}`;

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
    if (body.status === 'approved') note.status = 'approved';
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return note;
  }

  // 11. DELETE /notes/:id
  if (endpoint.startsWith('/notes/') && method === 'DELETE') {
    const id = endpoint.split('/')[2];
    db.notes = db.notes.filter(x => x.id !== id);
    saveLocalDatabase(db);
    backgroundSync(endpoint, options);
    return { ok: true };
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
