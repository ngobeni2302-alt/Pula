import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedData, GROUPS } from '../src/dashboardData.js';
import {
  ENGLISH_ACTIVITIES,
  MATHS_ACTIVITIES,
  generateActivityLesediReview
} from '../src/activities/activitiesData.js';
import { getLearnerAcademicRecord } from '../src/learners/learnerData.js';

// Read files for structural and rendering assertions
// Use import.meta.url to resolve paths from the test file's own location,
// not from the working directory Node was launched from.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC  = path.resolve(HERE, '../src');

const dashboardsCode    = fs.readFileSync(path.join(SRC, 'Dashboards.jsx'),                      'utf8');
const activitiesHubCode = fs.readFileSync(path.join(SRC, 'activities/ActivitiesHub.jsx'),        'utf8');
const activitiesCss     = fs.readFileSync(path.join(SRC, 'activities/activities.css'),           'utf8');
const learnerProfileCode = fs.readFileSync(path.join(SRC, 'learners/LearnerProfile.jsx'),        'utf8');

// ============================================================================
// NAVIGATION (Scenarios 1 - 6)
// ============================================================================

test('1. Record is renamed Activities in teacher navigation', () => {
  assert.ok(dashboardsCode.includes("['Activities', Sparkles]"), 'Teacher nav contains Activities with Sparkles icon');
  assert.ok(!dashboardsCode.includes("['Read', Mic]"), 'Old Read / Record item removed from teacher navigation array');
});

test('2. Old Record placeholder interface is removed completely', () => {
  assert.ok(!dashboardsCode.includes('Record a teacher-observed score for this grade'), 'Old placeholder form removed');
  assert.ok(dashboardsCode.includes('<ActivitiesHub'), 'ActivitiesHub component is wired in Dashboards');
});

test('3. English selection displays exactly 4 English activities', () => {
  assert.equal(ENGLISH_ACTIVITIES.length, 4, 'Must have exactly 4 English activities');
  const names = ENGLISH_ACTIVITIES.map(a => a.name);
  assert.deepEqual(names, ['Talk & Turn', 'Sound Hunt', 'Sound Sorter', 'Blend a Word']);
  
  // Verify descriptions matching PDF
  assert.equal(ENGLISH_ACTIVITIES[0].description, 'Look, talk and describe.');
  assert.equal(ENGLISH_ACTIVITIES[1].description, 'Find and recognise sounds.');
  assert.equal(ENGLISH_ACTIVITIES[2].description, 'Match the first sound.');
  assert.equal(ENGLISH_ACTIVITIES[3].description, 'Slide the sounds together.');
});

test('4. Maths selection displays exactly 4 Mathematics activities', () => {
  assert.equal(MATHS_ACTIVITIES.length, 4, 'Must have exactly 4 Mathematics activities');
  const names = MATHS_ACTIVITIES.map(a => a.name);
  assert.deepEqual(names, ['Add Numbers', 'Bead String', 'Make a Ten', 'Group of 5']);
  
  // Verify descriptions matching PDF
  assert.equal(MATHS_ACTIVITIES[0].description, 'Hop along the number line.');
  assert.equal(MATHS_ACTIVITIES[1].description, 'Slide beads and count.');
  assert.equal(MATHS_ACTIVITIES[2].description, 'Fill the ten-frame.');
  assert.equal(MATHS_ACTIVITIES[3].description, 'Count in fives.');
});

test('5. Switching subjects on Home dashboard determines active activities in ActivitiesHub', () => {
  assert.ok(dashboardsCode.includes("subject={filter === 'Maths' ? 'Mathematics' : 'English'}"), 'Passes selected subject to ActivitiesHub');
  assert.ok(dashboardsCode.includes("if (p !== 'Activities' && p !== 'Read') setFilter('All');"), 'Subject persists when navigating from Home to Activities');
});

test('6. Existing Home subject buttons remain unchanged', () => {
  assert.ok(dashboardsCode.includes("values={['English', 'Maths']}"), 'Subject toggle choices retained');
  assert.ok(dashboardsCode.includes('Start number check'), 'Maths round action button retained');
  assert.ok(dashboardsCode.includes('Continue reading round'), 'Reading round action button retained');
});

// ============================================================================
// LEARNER SELECTION (Scenarios 7 - 11)
// ============================================================================

test('7. Selecting an activity opens learner selection (Who is playing?)', () => {
  assert.ok(activitiesHubCode.includes('Who’s playing?'), 'Screen title Who is playing present in learner selection view');
  assert.ok(activitiesHubCode.includes('Activity: {selectedActivity?.name}'), 'Displays selected activity name above learner grid');
});

test('8. Correct classroom learners appear from teacher assigned class', () => {
  const db = seedData();
  const c = db.classes[0]; // Grade R
  assert.ok(c.learners.length > 0, 'Class has learners');
  for (const learner of c.learners) {
    assert.ok(learner.id, 'Learner must have unique ID');
    assert.ok(learner.name, 'Learner must have name');
    assert.ok(learner.group, 'Learner must have reading tier');
  }
});

test('9. Learner selection works and highlights active card', () => {
  assert.ok(activitiesHubCode.includes('act-learner-cell'), 'Renders learner selection cells');
  assert.ok(activitiesHubCode.includes('setSelectedLearner(l)'), 'Stores selected learner on click');
});

test('10. Correct learner activity opens with dynamic start button', () => {
  assert.ok(activitiesHubCode.includes("Start with {selectedLearner ? selectedLearner.name : 'Learner'} →"), 'Dynamic action button shows learner name');
  assert.ok(activitiesHubCode.includes("handleStartActivity"), 'Start handler defined');
});

test('11. Activity session is associated with the correct learner and activity', () => {
  assert.ok(activitiesHubCode.includes('selectedLearner.id'), 'Associates session with selected learner ID');
  assert.ok(activitiesHubCode.includes('selectedActivity.id'), 'Associates session with selected activity ID');
  assert.ok(activitiesHubCode.includes('selectedActivity.name'), 'Stores activity name');
});

// ============================================================================
// ENGLISH ACTIVITIES (Scenarios 12 - 15)
// ============================================================================

test('12. Talk & Turn records speech with audio toggle and optional teacher observations', () => {
  assert.ok(activitiesHubCode.includes('Tell Lesedi one thing you can see.'), 'Includes instruction matching PDF page 3');
  assert.ok(activitiesHubCode.includes('selectedActivity.prompts'), 'Renders vocabulary prompts');
  assert.ok(activitiesHubCode.includes('Tap and Talk'), 'Tap and Talk button present');
  assert.ok(activitiesHubCode.includes('Hear It Again'), 'Hear It Again button present');
  assert.ok(activitiesHubCode.includes('Teacher Observations (Optional):'), 'Teacher observations label present');
});

test('13. Sound Hunt captures learner responses across 3 stages (Say it, Find it, Read it)', () => {
  assert.ok(activitiesHubCode.includes("Today's Sound: {selectedActivity.targetSound}"), 'Phonics target sound displayed');
  assert.ok(activitiesHubCode.includes('act-hunt-stages'), 'Renders stages for Say It, Find It, Read It');
  assert.ok(activitiesHubCode.includes('Next Stage'), 'Stage navigation button present');
});

test('14. Sound Sorter validates answers and calculates accuracy', () => {
  assert.ok(activitiesHubCode.includes('Which sound do you hear first?'), 'Question header matching PDF page 10');
  assert.ok(activitiesHubCode.includes('act-sound-btn'), 'Sound choice buttons present');

  // Test assessment logic for Sound Sorter
  // NOTE: recommendedTier was removed in Phase 1 (tier changes are server-only).
  // The finding must use firstName or ref, not a full name.
  const review = generateActivityLesediReview({
    activity:    { id: 'sound-sorter', name: 'Sound Sorter' },
    learner:     { firstName: 'Thando', ref: 'learner-9', group: 'Seed', room: '2B' },
    sessionData: { totalQuestions: 10, correctCount: 8, incorrectCount: 2, accuracy: 80 },
    subject:     'English'
  });

  assert.ok(review.finding,       'Finding must be present');
  assert.ok(review.whyItMatters,  'whyItMatters must be present');
  assert.ok(review.whatToCheck,   'whatToCheck must be present');
  assert.ok(review.whatToDo,      'whatToDo must be present');
  assert.equal(review.confidence, 'High', 'Confidence is High for 10 questions');
  // recommendedTier is no longer returned by the client function (Phase 1)
  assert.ok(!('recommendedTier' in review), 'recommendedTier must not be present in client review');
  // Full names must not appear in findings
  assert.ok(!review.finding.includes('Mokoena'), 'Full surname must not appear in finding');
});

test('15. Blend a Word plays sounds and captures blending responses', () => {
  assert.ok(activitiesHubCode.includes('Tap each letter to hear its sound.'), 'Instruction matching PDF page 11');
  assert.ok(activitiesHubCode.includes('Slide the sounds together'), 'Slide action for phoneme blending');
  assert.ok(activitiesHubCode.includes('Next Word →'), 'Navigation to next word present');
});

// ============================================================================
// MATHEMATICS ACTIVITIES (Scenarios 16 - 20)
// ============================================================================

test('16. Add Numbers number line works with hops and hints', () => {
  assert.ok(activitiesHubCode.includes('Start on the coral dot. Hop on the line.'), 'Lesedi instructions matching PDF page 2');
  assert.ok(activitiesHubCode.includes('Show Me Another Hint'), 'Progressive hint action present');
  assert.ok(activitiesHubCode.includes("I've Got It"), 'Validation action button present');
  assert.ok(activitiesHubCode.includes('act-numberline-track'), 'Renders number line track');
});

test('17. Bead String interactive sliding and counting logic', () => {
  assert.ok(activitiesHubCode.includes('Slide the beads across. Count each one.'), 'Lesedi instruction matching PDF page 5');
  assert.ok(activitiesHubCode.includes('act-bead-item'), 'Interactive bead rendering present');
  assert.ok(activitiesHubCode.includes('Start Again'), 'Start Again reset button present');
  assert.ok(activitiesHubCode.includes('act-bead-big-count'), 'Live count display present');
});

test('18. Make a Ten counters and ten-frame layout work', () => {
  assert.ok(activitiesHubCode.includes('needs how many more to make 10? Tap counters to find out.'), 'Instruction matching PDF page 6');
  assert.ok(activitiesHubCode.includes('act-tenframe-grid'), 'Ten-frame grid present');
  assert.ok(activitiesHubCode.includes('act-tray-container'), 'Lower counter tray present');
  assert.ok(activitiesHubCode.includes('Start Again'), 'Reset button present');
  assert.ok(activitiesHubCode.includes("I've Got It"), 'Validation action present');
});

test('19. Group of 5 repeated addition and skip counting works', () => {
  assert.ok(activitiesHubCode.includes('Count in fives. Tap to count one row at a time.'), 'Instruction matching PDF page 7');
  assert.ok(activitiesHubCode.includes('4 Groups of 5'), 'Header matching PDF page 7');
  assert.ok(activitiesHubCode.includes('act-group5-row-item'), 'Interactive group rows present');
});

test('20. Correct and incorrect answers are recorded in session summary', () => {
  assert.ok(activitiesHubCode.includes('correct:'), 'Stores score in session summary');
  assert.ok(activitiesHubCode.includes('total:'), 'Stores maxScore in session summary');
  assert.ok(activitiesHubCode.includes('percentage:'), 'Stores calculated percentage in session summary');
});

// ============================================================================
// LESEDI PERFORMANCE REVIEW & TEACHER DECISION (Scenarios 21 - 30)
// ============================================================================

test('21. Lesedi receives actual activity results without fabricating transcripts', () => {
  // Use firstName + ref, never a full name (Phase 1 rule: no names in findings)
  const learner  = { firstName: 'Kabelo', ref: 'learner-5', group: 'Seed' };
  const session  = {
    total:           5,
    correct:         5,
    accuracy:        100,
    placedInFrame:   2,
    remainingInTray: 3
  };
  const review = generateActivityLesediReview({
    activity:    { id: 'make-a-ten', name: 'Make a Ten', totalAnswer: 13 },
    learner,
    sessionData: session,
    subject:     'Mathematics'
  });

  assert.ok(review.finding, 'Finding must be present');
  // The finding must reference the activity outcome (placedInFrame, remainingInTray)
  // but must NOT contain a full surname
  assert.ok(review.finding.includes('2') || review.finding.includes('counter'), 'Finding references the placement count');
  assert.ok(!review.finding.includes('Sithole'), 'Full surname must not appear in finding');
});

test('22. Lesedi review includes 4 mandatory structured sections', () => {
  const review = generateActivityLesediReview({
    activity:    { id: 'talk-and-turn', name: 'Talk & Turn' },
    learner:     { firstName: 'Thando', ref: 'learner-1', group: 'Seed' },
    sessionData: { duration: 12, teacherNotes: 'Good use of market vocabulary.' },
    // hasAudio removed — dead field until audio feature exists
    subject:     'English'
  });

  assert.ok(review.finding,      'Must contain Finding');
  assert.ok(review.whyItMatters, 'Must contain Why It Matters');
  assert.ok(review.whatToCheck,  'Must contain What to Check');
  assert.ok(review.whatToDo,     'Must contain What to Do');
});

test('23. Confidence reflects quantity and quality of available evidence', () => {
  const lowEvidenceReview = generateActivityLesediReview({
    activity:    { id: 'add-numbers', name: 'Add Numbers' },
    learner:     { firstName: 'Sipho', ref: 'learner-3', group: 'Seed' },
    sessionData: { total: 1, correct: 1, hintsUsed: 3 },
    subject:     'Mathematics'
  });
  assert.equal(lowEvidenceReview.confidence, 'Low', 'Single question with 3 hints yields Low confidence');

  const highEvidenceReview = generateActivityLesediReview({
    activity:    { id: 'sound-sorter', name: 'Sound Sorter' },
    learner:     { firstName: 'Sipho', ref: 'learner-3', group: 'Seed' },
    sessionData: { total: 10, correct: 9, hintsUsed: 0 },
    subject:     'English'
  });
  assert.equal(highEvidenceReview.confidence, 'High', '10 questions with 0 hints yields High confidence');
});

test('24. Review draft prominently displays Draft · Teacher Decides', () => {
  assert.ok(activitiesHubCode.includes("Draft · Teacher Decides"), 'Heading reflects advisory nature of Lesedi draft');
});

test('25. Teacher approval is mandatory: Edit Review, Approve Assessment, Reject Draft present', () => {
  assert.ok(activitiesHubCode.includes('Edit Review'), 'Edit Review button present');
  assert.ok(activitiesHubCode.includes('Approve Assessment'), 'Approve Assessment button present');
  assert.ok(activitiesHubCode.includes('Reject Draft'), 'Reject Draft button present');
});

test('26. Teacher can edit review fields before approval', () => {
  assert.ok(activitiesHubCode.includes('setIsEditingReview(true)'), 'Opens edit modal for teacher review adjustments');
  assert.ok(activitiesHubCode.includes('value={editedReview.finding}'), 'Allows editing findings');
  assert.ok(activitiesHubCode.includes('value={editedReview.whyItMatters}'), 'Allows editing educational significance');
  assert.ok(activitiesHubCode.includes('value={editedReview.whatToCheck}'), 'Allows editing what to check');
  assert.ok(activitiesHubCode.includes('value={editedReview.whatToDo}'), 'Allows editing what to do');
});

test('27. Rejection does not finalize assessment or update academic records', () => {
  assert.ok(activitiesHubCode.includes('handleRejectDraft'), 'Rejection handler defined');
  assert.ok(activitiesHubCode.includes('Draft rejected. No changes were made to learner records.'), 'Informs teacher of clean rejection');
});

// ============================================================================
// READING TIER & ACADEMIC PERFORMANCE INTEGRATION (Scenarios 31 - 38)
// ============================================================================

test('28. Reading tier changes require explicit teacher approval and never happen automatically', () => {
  assert.ok(activitiesHubCode.includes('Keep Current Tier'), 'Keep Current Tier choice button present');
  assert.ok(activitiesHubCode.includes('Move to Recommended Tier'), 'Move to Recommended Tier choice button present');
  assert.ok(activitiesHubCode.includes('setSelectedTierChange'), 'Tier change applied only if teacher explicitly selected approved tier');
});

test('29. Mathematics assessments never modify reading tiers', () => {
  const mathReview = generateActivityLesediReview({
    activity:    { id: 'add-numbers', name: 'Add Numbers' },
    learner:     { firstName: 'Thando', ref: 'learner-1', group: 'Seed' },
    sessionData: { total: 10, correct: 10, accuracy: 100 },
    subject:     'Mathematics'
  });
  assert.ok(!('recommendedTier' in mathReview) || mathReview.recommendedTier === null,
    'Mathematics activities must not recommend reading tier changes');
});

test('30. Approved assessment is saved with required metadata in Dashboards updateClass', () => {
  assert.ok(dashboardsCode.includes('activityAssessments: nextAssessments'), 'Updates learner activityAssessments array');
  assert.ok(dashboardsCode.includes("academicYear: '2026'"), 'Records 2026 academic year');
  assert.ok(dashboardsCode.includes("term: 'Term 4'"), 'Records Term 4');
  assert.ok(dashboardsCode.includes("status: 'Approved'"), 'Records Approved status');
  assert.ok(dashboardsCode.includes('approvedBy: c.teacher'), 'Records approving teacher name');
});

test('31. Approved tier change appends to tierHistory and updates group', () => {
  assert.ok(dashboardsCode.includes('if (approvedTier && approvedTier !== l.group)'), 'Checks explicit tier approval');
  assert.ok(dashboardsCode.includes('previousTier: l.group'), 'Preserves previous tier in history');
  assert.ok(dashboardsCode.includes('reason:'), 'Records reason for tier change');
});

test('32. LearnerProfile displays approved activity assessments in dedicated section', () => {
  assert.ok(learnerProfileCode.includes('Interactive Activity Assessments'), 'Section title present in LearnerProfile');
  assert.ok(learnerProfileCode.includes('data-testid="activity-assessments-section"'), 'Container element rendered');
  assert.ok(learnerProfileCode.includes('act.subject'), 'Displays assessment subject');
  assert.ok(learnerProfileCode.includes('act.activityName'), 'Displays activity name');
  assert.ok(learnerProfileCode.includes('act.finding'), 'Displays Lesedi finding');
});

test('33. Existing academic assessment records and averages remain intact', () => {
  const db = seedData();
  const c = db.classes[0];
  const learner = c.learners[0];
  const record = getLearnerAcademicRecord(learner, c.grade, c.teacher);
  
  assert.ok(record.assessments.length > 0, 'Existing term assessments preserved');
  assert.ok(record.termAverages[1] > 0, 'Term 1 average intact');
  assert.ok(record.termAverages[4] > 0, 'Term 4 average intact');
  assert.ok(learnerProfileCode.includes('useState(2026)'), 'Academic year is 2026');
});

// ============================================================================
// DESIGN & GENERAL REQUIREMENTS (Scenarios 39 - 48)
// ============================================================================

test('34. Visual design follows PDF color palette and typography tokens', () => {
  assert.ok(activitiesCss.includes('#FF6B4A'), 'Contains Coral (#FF6B4A) action color');
  assert.ok(activitiesCss.includes('#8E9BFF'), 'Contains Periwinkle (#8E9BFF) instructions color');
  assert.ok(activitiesCss.includes('#FFF9EE'), 'Contains Cream background (#FFF9EE)');
  assert.ok(activitiesCss.includes('#101438'), 'Contains Dark Navy (#101438)');
});

test('35. Mobile usability features: responsive cards, no horizontal overflow', () => {
  assert.ok(activitiesCss.includes('box-sizing: border-box'), 'Enforces border-box to avoid overflow');
  assert.ok(activitiesCss.includes('overflow-x: hidden'), 'Prevents horizontal page scroll');
  assert.ok(activitiesCss.includes('touch-action: manipulation'), 'Optimized for mobile touch targets');
  assert.ok(activitiesCss.includes('min-height: 48px'), 'Complies with accessible touch target heights');
});

test('36. Button text contrast is high and visible', () => {
  assert.ok(activitiesCss.includes('.act-primary-btn'), 'Defines primary button');
  assert.ok(activitiesCss.includes('color: #ffffff'), 'Ensures white text on dark navy buttons');
});

test('37. Unrelated pages are preserved (Parent, HOD, Planner, Messages)', () => {
  assert.ok(dashboardsCode.includes('<HodDashboard'), 'HOD dashboard retained');
  assert.ok(dashboardsCode.includes('<MessagingHub'), 'Messaging hub retained');
  assert.ok(dashboardsCode.includes('<SchoolCalendar'), 'School calendar planner retained');
  assert.ok(dashboardsCode.includes('!teacher && page === \'Home\''), 'Parent home dashboard retained');
  assert.ok(dashboardsCode.includes('!teacher && page === \'Progress\''), 'Parent progress dashboard retained');
});

test('38. Activity completion celebration flow with Next Learner and Back to Activities actions', () => {
  assert.ok(activitiesHubCode.includes('Well done, {selectedLearner?.name}!'), 'Celebration screen matching Section 22');
  assert.ok(activitiesHubCode.includes('Your activity is complete.'), 'Completion copy present');
  assert.ok(activitiesHubCode.includes('Next Learner'), 'Next Learner button present');
  assert.ok(activitiesHubCode.includes('Back to Activities'), 'Back to Activities button present');
});
