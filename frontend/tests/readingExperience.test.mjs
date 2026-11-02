import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { seedData, PLANS } from '../src/dashboardData.js';
import { READING_TASKS } from '../src/reading/readingTasks.js';

const jsxPath = path.resolve('frontend/src/reading/TeacherReadingExperience.jsx');
const cssPath = path.resolve('frontend/src/reading/readingExperience.css');
const dashboardsJsxPath = path.resolve('frontend/src/Dashboards.jsx');

test('1. Reading tasks contain Foundation Phase short passages and phonics sets', () => {
  assert.ok(READING_TASKS.length >= 4, 'Should provide multiple reading tasks');

  const phonicsSet2 = READING_TASKS.find(t => t.id === 'phonics-set-2');
  assert.ok(phonicsSet2, 'Phonics set 2 task must exist');
  assert.equal(phonicsSet2.title, 'Short passage · Phonics set 2');
  assert.deepEqual(phonicsSet2.passageLines, [
    'The sun is up.',
    'The cat sat',
    'on a mat.'
  ]);
  assert.equal(phonicsSet2.passageText, 'The sun is up. The cat sat on a mat.');
});

test('2. Screen 1 (Who’s reading?): Header, Periwinkle Task Card and Change action exist', () => {
  const jsx = fs.readFileSync(jsxPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Header check
  assert.ok(jsx.includes("Who's reading?"), 'Screen 1 must have "Who\'s reading?" heading');
  assert.ok(jsx.includes('re-back-btn'), 'Back button must be present in header');

  // Task Card check
  assert.ok(jsx.includes('re-task-card'), 'Reading task card must be present');
  assert.ok(jsx.includes('Reading task'), 'Reading task label must be present');
  assert.ok(jsx.includes('re-task-change-btn'), 'Change button must be present');

  // CSS colors check
  assert.match(css, /\.re-task-card\s*\{[^}]*background:\s*#DCE1FF/i, 'Task card must use Periwinkle tone');
  assert.match(css, /\.re-task-icon\s*\{[^}]*background:\s*#8E9BFF/i, 'Task icon must use primary Periwinkle #8E9BFF');
});

test('3. Learner Selection Grid: Responsive 3-column grid with avatars, names and consent gating', () => {
  const jsx = fs.readFileSync(jsxPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  const db = seedData();
  const c = db.classes[2];

  // Grid CSS check
  assert.match(css, /\.re-learner-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3/i, 'Grid must be 3-column layout');

  // Learner names check: Grade 2 includes reference learners
  const names = c.learners.map(l => l.name);
  assert.ok(names.includes('Thando'), 'Thando must be in Grade 2 learners');
  assert.ok(names.includes('Lerato'), 'Lerato must be in Grade 2 learners');
  assert.ok(names.includes('Sipho'), 'Sipho must be in Grade 2 learners');
  assert.ok(names.includes('Palesa'), 'Palesa must be in Grade 2 learners');

  // Consent gating for Palesa
  const palesa = c.learners.find(l => l.name === 'Palesa');
  assert.ok(palesa, 'Palesa should exist');
  assert.equal(palesa.consent, false, 'Palesa must have consent = false');

  // In JSX, locked card shows lock icon and "Needs consent"
  assert.ok(jsx.includes('needsConsent ? <Lock'), 'Locked learners must display lock icon');
  assert.ok(jsx.includes('Needs consent'), 'Locked learners must display "Needs consent" text');
  assert.ok(jsx.includes('disabled={!selectedLearner || !hasConsent}'), 'Start button must be disabled for learners without consent');
});

test('4. Start Action Button: Fixed at bottom with dynamic learner name', () => {
  const jsx = fs.readFileSync(jsxPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Sticky footer CSS
  assert.match(css, /\.re-sticky-footer\s*\{[^}]*position:\s*fixed/i, 'Footer must be fixed/sticky');
  assert.match(css, /\.re-primary-btn\s*\{[^}]*background:\s*#101438/i, 'Action button must be dark navy #101438');

  // Dynamic label in JSX
  assert.ok(jsx.includes('Hand the phone to {selectedLearner?.name'), 'Button must dynamically display learner name');
});

test('5. Screen 2 (Interactive Reading Session): Night theme, cream passage card, listening orbit and actions', () => {
  const jsx = fs.readFileSync(jsxPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Session screen styling
  assert.match(css, /\.re-session-screen\s*\{[^}]*background:\s*#101438/i, 'Session screen must use Dark Navy #101438 background');
  assert.match(css, /\.re-passage-card\s*\{[^}]*background:\s*#FFF9EE/i, 'Passage card must use cream background');

  // Dynamic header and close button
  assert.ok(jsx.includes("{selectedLearner?.name || 'Learner'}'s turn"), 'Header must display learner’s turn');
  assert.ok(jsx.includes('re-close-btn'), 'Close button must exist');

  // Listening orbit & Speech bubble
  assert.ok(jsx.includes('re-orbit'), 'Listening orbit must exist');
  assert.ok(jsx.includes("Take your time. I'm listening."), 'Speech bubble prompt must be present');
  assert.match(css, /@keyframes\s+orbitPulse/i, 'Listening pulse animation must be defined');

  // Action buttons
  assert.ok(jsx.includes('Start again'), 'Start again button must exist');
  assert.ok(jsx.includes("I'm done"), 'I\'m done button must exist');
  assert.match(css, /\.re-btn-done\s*\{[^}]*background:\s*#FF6B4A/i, 'I\'m done button must use Coral #FF6B4A');

  // Confirmation modal on close
  assert.ok(jsx.includes('Leave this reading session?'), 'Confirmation dialog must exist when leaving active session');
});

test('6. Screen 3 (Reading Celebration): Coral theme, stars visual, celebration copy, Next friend & Back to class', () => {
  const jsx = fs.readFileSync(jsxPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Coral background
  assert.match(css, /\.re-celebration-screen\s*\{[^}]*background:\s*#FF6B4A/i, 'Celebration screen must have Coral #FF6B4A background');
  assert.match(css, /\.re-celebrate-circle\s*\{[^}]*background:\s*#FFF9EE/i, 'Center visual circle must use cream background');

  // Celebration typography
  assert.ok(jsx.includes('You read it,'), 'Heading must include "You read it,"');
  assert.ok(jsx.includes('Lesedi loved listening to you.'), 'Subtitle must include "Lesedi loved listening to you."');

  // Actions
  assert.ok(jsx.includes('Next friend'), 'Next friend button must exist');
  assert.ok(jsx.includes('Back to class'), 'Back to class button must exist');
  assert.match(css, /\.re-btn-next-friend\s*\{[^}]*background:\s*#101438/i, 'Next friend button must be dark navy');
  assert.match(css, /\.re-btn-back-class\s*\{[^}]*border:\s*2px solid #101438/i, 'Back to class button must have dark navy border');
});

test('7. Dashboards integration: Reading experience replaces old form and updates class progress', () => {
  const jsx = fs.readFileSync(dashboardsJsxPath, 'utf8');

  assert.ok(jsx.includes('<TeacherReadingExperience'), 'Dashboards must render TeacherReadingExperience when page is Read');
  assert.ok(!jsx.includes('Record a teacher-observed score for this grade'), 'Old placeholder form must be removed');
  assert.ok(jsx.includes('updateClass(c.grade'), 'onSaveSession must update class state in Dashboards');
  assert.ok(jsx.includes('page !== \'Read\' && header'), 'Top header is omitted in reading mode for full immersive view');
});
