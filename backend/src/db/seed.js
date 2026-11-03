/**
 * seed.js
 * Seeds PostgreSQL from backend/data.json.
 *
 * Mapping (per design.md):
 *   classroom           → schools + classrooms
 *   learners            → learners + guardian_consents + tier_history
 *   learners.termProgress → reading_progress
 *   learners.checkInNote  → learner_observations
 *   notes[]             → parent_notes
 *   terms[]             → terms
 *   completedActivities → activity_sessions (score/step_data null)
 *   8 activities        → activities + activity_skill_map
 *
 * Skipped (computed, never stored):
 *   avgWpm, yearSummary.learnersHeard, yearSummary.movedUp,
 *   yearSummary.parentNotesSent
 *
 * Usage:
 *   node src/db/seed.js
 *   npm run db:seed
 */

import pg   from 'pg';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const here    = path.dirname(fileURLToPath(import.meta.url));
const DATA    = JSON.parse(
  fs.readFileSync(path.resolve(here, '../../data.json'), 'utf8')
);

// Known seed UUIDs (match migration 006)
const SCHOOL_ID  = '00000000-0000-0000-0000-000000000010';
const TEACHER_ID = '00000000-0000-0000-0000-000000000001';
const HOD_ID     = '00000000-0000-0000-0000-000000000002';

// ── Activity library (8 activities from the PR) ──────────────────────────
const ACTIVITIES = [
  { id: 'talk-and-turn',  subject: 'English',     name: 'Talk & Turn',  description: 'Look, talk and describe.',          caps_ref: 'CAPS HL Gr R p.20',  tier: 'Seed',   grade_range: 'R-1' },
  { id: 'sound-hunt',     subject: 'English',     name: 'Sound Hunt',   description: 'Find and recognise sounds.',         caps_ref: 'CAPS HL Gr R p.34',  tier: 'Seed',   grade_range: 'R-1' },
  { id: 'sound-sorter',   subject: 'English',     name: 'Sound Sorter', description: 'Match the first sound.',             caps_ref: 'CAPS HL Gr 1 p.56',  tier: 'Sprout', grade_range: '1-2' },
  { id: 'blend-a-word',   subject: 'English',     name: 'Blend a Word', description: 'Slide the sounds together.',         caps_ref: 'CAPS HL Gr 1 p.56',  tier: 'Sprout', grade_range: '1-2' },
  { id: 'add-numbers',    subject: 'Mathematics', name: 'Add Numbers',  description: 'Hop along the number line.',         caps_ref: 'CAPS Maths Gr 1 p.22', tier: 'Sprout', grade_range: '1-2' },
  { id: 'bead-string',    subject: 'Mathematics', name: 'Bead String',  description: 'Slide beads and count.',             caps_ref: 'CAPS Maths Gr R p.10', tier: 'Seed',   grade_range: 'R-1' },
  { id: 'make-a-ten',     subject: 'Mathematics', name: 'Make a Ten',   description: 'Fill the ten-frame.',                caps_ref: 'CAPS Maths Gr 1 p.22', tier: 'Sprout', grade_range: '1-2' },
  { id: 'group-of-5',     subject: 'Mathematics', name: 'Group of 5',   description: 'Count in fives.',                    caps_ref: 'CAPS Maths Gr 2 p.16', tier: 'Bloom',  grade_range: '2-3' },
];

// ── Activity → skill map ─────────────────────────────────────────────────
const SKILL_MAP = [
  { activity_id: 'talk-and-turn',  subject: 'English',     skill: 'oral language',           caps_ref: 'CAPS HL Gr R p.20', item: 'describes picture using key vocabulary',          strategy: 'other' },
  { activity_id: 'sound-hunt',     subject: 'English',     skill: 'phonological awareness',   caps_ref: 'CAPS HL Gr R p.34', item: 'recognises target sound across three stages',     strategy: 'other' },
  { activity_id: 'sound-sorter',   subject: 'English',     skill: 'phoneme-grapheme mapping', caps_ref: 'CAPS HL Gr 1 p.56', item: 'identifies initial sound correctly',              strategy: 'other' },
  { activity_id: 'blend-a-word',   subject: 'English',     skill: 'phoneme blending',         caps_ref: 'CAPS HL Gr 1 p.56', item: 'blends CVC phoneme sounds into whole word',       strategy: 'other' },
  { activity_id: 'add-numbers',    subject: 'Mathematics', skill: 'addition',                 caps_ref: 'CAPS Maths Gr 1 p.22', item: 'uses number line to solve addition',           strategy: 'number_line' },
  { activity_id: 'bead-string',    subject: 'Mathematics', skill: 'one-to-one correspondence',caps_ref: 'CAPS Maths Gr R p.10', item: 'counts beads with one-to-one correspondence', strategy: 'counters' },
  { activity_id: 'make-a-ten',     subject: 'Mathematics', skill: 'number bonds',             caps_ref: 'CAPS Maths Gr 1 p.22', item: 'completes ten-frame to bridge through 10',     strategy: 'building_up' },
  { activity_id: 'group-of-5',     subject: 'Mathematics', skill: 'skip counting',            caps_ref: 'CAPS Maths Gr 2 p.16', item: 'counts in groups of 5 to reach total',        strategy: 'pictures' },
];

// ─────────────────────────────────────────────────────────────────────────
async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const pool   = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('sslmode=disable')
      ? false
      : { rejectUnauthorized: false },
  });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 1. Classroom → school + classroom ──────────────────────────────
    const cl = DATA.classroom;
    const CLASSROOM_ID = '00000000-0000-0000-0000-000000000020';

    await client.query(`
      INSERT INTO schools (id, name, emis_number)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO NOTHING
    `, [SCHOOL_ID, cl.name ?? 'Demo School', 'EMIS-70021144']);

    await client.query(`
      INSERT INTO classrooms (id, school_id, name, grade, teacher_id, code)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING
    `, [CLASSROOM_ID, SCHOOL_ID, cl.name, String(cl.grade), TEACHER_ID, cl.code]);

    console.log('  ✓ school + classroom');

    // ── 2. Activities library ───────────────────────────────────────────
    for (const act of ACTIVITIES) {
      await client.query(`
        INSERT INTO activities (id, subject, name, description, caps_ref, tier, grade_range)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO NOTHING
      `, [act.id, act.subject, act.name, act.description, act.caps_ref, act.tier, act.grade_range]);
    }
    for (const sm of SKILL_MAP) {
      await client.query(`
        INSERT INTO activity_skill_map (activity_id, subject, skill, caps_ref, item, strategy)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [sm.activity_id, sm.subject, sm.skill, sm.caps_ref, sm.item, sm.strategy]);
    }
    console.log('  ✓ activities + skill map');

    // ── 3. Terms ────────────────────────────────────────────────────────
    for (const t of (DATA.terms ?? [])) {
      await client.query(`
        INSERT INTO terms (school_id, year, term, name, dates, hod_reviewed, reviewed_by, reviewed_at)
        VALUES ($1, 2026, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [
        SCHOOL_ID,
        t.id,
        t.name,
        t.dates ?? null,
        t.hodReviewed ?? false,
        t.hodReviewed ? HOD_ID : null,
        t.reviewedAt  ?? null,
      ]);
    }
    console.log('  ✓ terms');

    // ── 4. Learners ─────────────────────────────────────────────────────
    const learnerIdMap = new Map(); // data.json id → DB UUID

    for (const l of DATA.learners) {
      const [firstName, ...rest] = (l.name ?? 'Learner').split(' ');
      const lastName = rest.join(' ') || null;
      const tier     = l.group ?? 'Seed';

      const { rows } = await client.query(`
        INSERT INTO learners
          (classroom_id, first_name, last_name, literacy_tier, maths_tier,
           language, channel, sounds_to_practise)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id
      `, [
        CLASSROOM_ID,
        firstName,
        lastName,
        tier,
        tier,  // maths_tier initialised to same value
        l.language ?? 'English',
        l.channel  ?? 'SMS',
        l.soundsToPractise ?? [],
      ]);

      const dbId = rows[0].id;
      learnerIdMap.set(String(l.id), dbId);

      // Guardian consent
      await client.query(`
        INSERT INTO guardian_consents (learner_id, scope, granted_at, granted_by)
        VALUES ($1, 'analysis', $2, 'Guardian')
      `, [dbId, l.consent ? new Date().toISOString() : null]);

      // Tier history (from groupJourney)
      if (l.groupJourney?.from && l.groupJourney.from !== l.groupJourney.to) {
        await client.query(`
          INSERT INTO tier_history (learner_id, subject, tier, reason)
          VALUES ($1, 'English', $2, 'Seeded from groupJourney')
        `, [dbId, l.groupJourney.from]);
      }
      // Current tier
      await client.query(`
        INSERT INTO tier_history (learner_id, subject, tier, reason)
        VALUES ($1, 'English', $2, 'Initial seed')
      `, [dbId, tier]);

      // Reading progress (termProgress)
      for (const tp of (l.termProgress ?? [])) {
        await client.query(`
          INSERT INTO reading_progress (learner_id, year, term, wpm, accuracy)
          VALUES ($1, 2026, $2, $3, $4)
        `, [dbId, tp.term, tp.wpm ?? null, tp.accuracy ?? null]);
      }

      // Free-text observation (checkInNote)
      if (l.checkInNote) {
        await client.query(`
          INSERT INTO learner_observations (learner_id, text, created_by)
          VALUES ($1, $2, $3)
        `, [dbId, l.checkInNote, TEACHER_ID]);
      }
    }
    console.log(`  ✓ ${DATA.learners.length} learners`);

    // ── 5. Notes → parent_notes ─────────────────────────────────────────
    for (const n of (DATA.notes ?? [])) {
      const dbLearnerId = learnerIdMap.get(String(n.learnerId));
      if (!dbLearnerId) continue;

      await client.query(`
        INSERT INTO parent_notes
          (learner_id, text, status, language, channel, created_by, approved_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        dbLearnerId,
        n.text,
        n.status ?? 'draft',
        null,  // language not on data.json notes
        null,
        TEACHER_ID,
        n.status === 'sent' ? TEACHER_ID : null,
      ]);
    }
    console.log(`  ✓ ${(DATA.notes ?? []).length} parent notes`);

    // ── 6. completedActivities → activity_sessions ──────────────────────
    for (const ca of (DATA.completedActivities ?? [])) {
      // Map group label to first matching activity for that subject
      const actId = ca.group === 'Tree' || ca.group === 'Bloom'
        ? 'blend-a-word'
        : ca.group === 'Sprout'
          ? 'sound-sorter'
          : 'sound-hunt';

      // Pick any consented learner in that group as a placeholder
      const matchingLearner = DATA.learners.find(
        l => l.group === ca.group && l.consent
      );
      if (!matchingLearner) continue;
      const dbLearnerId = learnerIdMap.get(String(matchingLearner.id));
      if (!dbLearnerId) continue;

      await client.query(`
        INSERT INTO activity_sessions
          (id, learner_id, activity_id, subject, term, academic_year, completed_at)
        VALUES (gen_random_uuid(), $1, $2, 'English', 4, 2026, $3)
        ON CONFLICT (id) DO NOTHING
      `, [dbLearnerId, actId, ca.date ? new Date(ca.date) : null]);
    }
    console.log(`  ✓ ${(DATA.completedActivities ?? []).length} completed activities`);

    await client.query('COMMIT');
    console.log('Seed complete.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
