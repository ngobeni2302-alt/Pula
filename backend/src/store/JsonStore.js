/**
 * JsonStore.js
 * Wraps the existing data.json read/write logic.
 * Implements the same interface as PgStore so server.js works with both.
 *
 * Activity sessions are stored in db.activitySessions[] in data.json.
 * Reading consent from learner.consent (boolean) until guardian_consents
 * is back-filled.
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here    = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATA_FILE
  || path.resolve(here, '../../data.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { classroom: {}, learners: [], assessments: [], notes: [],
             activities: [], completedActivities: [], activitySessions: [] };
  }
}

function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export class JsonStore {

  // ── Classrooms ──────────────────────────────────────────────────────────

  getClassroom() {
    return load().classroom;
  }

  patchClassroom(fields) {
    const db = load();
    db.classroom = { ...db.classroom, ...fields };
    save(db);
    return db.classroom;
  }

  // ── Learners ────────────────────────────────────────────────────────────

  getLearners() {
    return load().learners;
  }

  getLearner(id) {
    return load().learners.find(l => l.id === String(id)) ?? null;
  }

  patchLearner(id, fields) {
    const db = load();
    const l  = db.learners.find(x => x.id === String(id));
    if (!l) throw new Error('Learner not found');
    Object.assign(l, fields);
    save(db);
    return l;
  }

  deleteLearner(id) {
    const db = load();
    db.learners        = db.learners.filter(x => x.id !== String(id));
    db.assessments     = db.assessments.filter(x => x.learnerId !== String(id));
    db.notes           = db.notes.filter(x => x.learnerId !== String(id));
    db.activitySessions = (db.activitySessions ?? [])
      .filter(x => x.learnerId !== String(id));
    save(db);
    return { ok: true };
  }

  // ── Consent ─────────────────────────────────────────────────────────────

  getConsent(learnerId, _scope = 'analysis') {
    const l = this.getLearner(learnerId);
    return { granted: l?.consent === true };
  }

  // ── Activity sessions ───────────────────────────────────────────────────

  upsertActivitySession(session) {
    const db = load();
    if (!db.activitySessions) db.activitySessions = [];

    const existing = db.activitySessions.find(s => s.id === session.id);
    if (existing) return { session: existing, duplicate: true };

    const row = {
      ...session,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.activitySessions.push(row);
    save(db);
    return { session: row, duplicate: false };
  }

  getActivitySessions(learnerId) {
    return (load().activitySessions ?? [])
      .filter(s => s.learnerId === String(learnerId));
  }

  // ── Observation items (no-op in JSON store — count always 0) ────────────

  createObservationItems(_items) {
    // JSON store does not implement structured observations.
    // Confidence will always be Low in JSON mode.
    return [];
  }

  countObservationItems(_learnerId, _skill) {
    return 0;
  }

  // ── Reading progress ────────────────────────────────────────────────────

  getReadingProgress(learnerId) {
    const l = this.getLearner(learnerId);
    return l?.termProgress ?? [];
  }

  upsertReadingProgress(row) {
    const db = load();
    const l  = db.learners.find(x => x.id === String(row.learnerId));
    if (!l) throw new Error('Learner not found');
    if (!l.termProgress) l.termProgress = [];
    const idx = l.termProgress.findIndex(t => t.term === row.term);
    if (idx >= 0) {
      l.termProgress[idx] = { ...l.termProgress[idx], ...row };
    } else {
      l.termProgress.push(row);
    }
    save(db);
    return row;
  }

  // ── Notes ────────────────────────────────────────────────────────────────

  getNotes() {
    return load().notes ?? [];
  }

  createNote(note) {
    const db = load();
    db.notes.unshift(note);
    save(db);
    return note;
  }

  patchNote(id, fields) {
    const db = load();
    const n  = db.notes.find(x => x.id === String(id));
    if (!n) throw new Error('Note not found');
    Object.assign(n, fields);
    save(db);
    return n;
  }

  deleteNote(id) {
    const db = load();
    db.notes = db.notes.filter(x => x.id !== String(id));
    save(db);
    return { ok: true };
  }

  // ── Terms ────────────────────────────────────────────────────────────────

  getTerms() {
    return load().terms ?? [];
  }

  patchTerm(id, fields) {
    const db = load();
    if (!db.terms) db.terms = [];
    const t = db.terms.find(x => x.id === Number(id));
    if (!t) throw new Error('Term not found');
    Object.assign(t, fields);
    save(db);
    return t;
  }

  // ── Tier history (no-op in JSON store) ──────────────────────────────────

  addTierHistory(_row) { return null; }

  getCurrentTier(learnerId, _subject) {
    const l = this.getLearner(learnerId);
    return l?.group ?? null;
  }

  // ── Lesedi outputs ────────────────────────────────────────────────────────

  createLesediOutput(output) {
    const db = load();
    if (!db.lesediOutputs) db.lesediOutputs = [];
    const row = { ...output, created_at: new Date().toISOString() };
    db.lesediOutputs.push(row);
    save(db);
    return row;
  }

  patchLesediOutput(id, fields) {
    const db = load();
    if (!db.lesediOutputs) db.lesediOutputs = [];
    const o = db.lesediOutputs.find(x => x.id === String(id));
    if (!o) throw new Error('Lesedi output not found');
    Object.assign(o, fields);
    save(db);
    return o;
  }

  // ── Intervention log ──────────────────────────────────────────────────────

  createIntervention(row) {
    const db = load();
    if (!db.interventionLog) db.interventionLog = [];
    const entry = { ...row, logged_at: new Date().toISOString() };
    db.interventionLog.push(entry);
    save(db);
    return entry;
  }

  // ── Assessments (legacy reading round) ──────────────────────────────────

  createAssessment(row) {
    const db = load();
    db.assessments.unshift(row);
    save(db);
    return row;
  }

  getAssessments() {
    return load().assessments ?? [];
  }

  patchAssessment(id, fields) {
    const db = load();
    const a  = db.assessments.find(x => x.id === String(id));
    if (!a) throw new Error('Assessment not found');
    Object.assign(a, fields);
    save(db);
    return a;
  }

  // ── Full state (legacy /api/state) ──────────────────────────────────────

  getFullState() {
    return load();
  }
}
