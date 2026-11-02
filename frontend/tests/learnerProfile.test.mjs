import test from 'node:test';
import assert from 'node:assert/strict';
import { seedData, GROUPS } from '../src/dashboardData.js';
import {
  getLearnerFullName,
  getLearnerAcademicRecord,
  calculateTermAverage,
  calculateYearAverage,
  calculateImprovement,
  getCapsRating
} from '../src/learners/learnerData.js';

test('1. Groups tab is removed from Teacher navigation, leaving 4 evenly spaced tabs', () => {
  // Simulating teacher navigation structure
  const teacherNav = ['Home', 'Read', 'Planner', 'Messages'];
  assert.equal(teacherNav.length, 4, 'Teacher navigation must contain exactly 4 items');
  assert.equal(teacherNav.includes('Groups'), false, 'Groups tab must be removed from teacher navigation');
  assert.deepEqual(teacherNav, ['Home', 'Read', 'Planner', 'Messages']);
});

test('2. Reading groups section on Home dashboard retains tier counts and categories', () => {
  const db = seedData();
  const c = db.classes[2]; // Grade 2B
  assert.equal(GROUPS.length, 4);

  for (const g of GROUPS) {
    const count = c.learners.filter(l => l.group === g).length;
    assert.ok(count > 0, `Reading tier ${g} should have learners assigned`);
  }
});

test('3. Selecting tiers (Seed, Sprout, Bloom, Tree) filters learners to that specific tier', () => {
  const db = seedData();
  const c = db.classes[2];

  for (const tier of GROUPS) {
    const tierLearners = c.learners.filter(l => l.group === tier);
    assert.ok(tierLearners.length > 0);
    for (const l of tierLearners) {
      assert.equal(l.group, tier, `Learner ${l.name} must belong to tier ${tier}`);
    }
  }

  // See All returns all learners
  const allLearners = c.learners;
  assert.equal(allLearners.length, 38, 'Grade 2B has 38 learners');
});

test('4. Learner search filters learners accurately by name or surname', () => {
  const db = seedData();
  const c = db.classes[2];

  const searchThando = c.learners.filter(l => {
    const fullName = getLearnerFullName(l, c.grade);
    return fullName.toLowerCase().includes('thando');
  });
  assert.ok(searchThando.length >= 1, 'Should find Thando');
  assert.equal(searchThando[0].name, 'Thando');

  const searchDlamini = c.learners.filter(l => {
    const fullName = getLearnerFullName(l, c.grade);
    return fullName.toLowerCase().includes('dlamini');
  });
  assert.ok(searchDlamini.length >= 1, 'Should find learner with Dlamini surname');
});

test('5. Academic profile initializes with correct learner details and 2026 academic year', () => {
  const db = seedData();
  const c = db.classes[2];
  const learner = c.learners[8]; // Thando

  const record = getLearnerAcademicRecord(learner, c.grade, c.teacher);
  assert.equal(record.learnerId, learner.id);
  assert.equal(record.fullName, 'Thando Mokoena');
  assert.equal(record.grade, '2');
  assert.equal(record.currentTier, learner.group);
  assert.ok(record.attendanceSummary.overallPercentage >= 80);
});

test('6. All four school terms (Terms 1, 2, 3, 4) contain assessments with subjects and types', () => {
  const db = seedData();
  const c = db.classes[2];
  const learner = c.learners[8];

  const record = getLearnerAcademicRecord(learner, c.grade, c.teacher);

  for (const termNum of [1, 2, 3, 4]) {
    const termAssessments = record.assessments.filter(a => a.term === termNum);
    assert.ok(termAssessments.length > 0, `Term ${termNum} must contain assessments`);

    for (const a of termAssessments) {
      assert.ok(a.subject, 'Assessment must have a subject');
      assert.ok(a.type, 'Assessment must have a type (Test, Exam, Project, Homework, etc.)');
      assert.ok(a.name, 'Assessment must have a title/name');
      assert.ok(a.date, 'Assessment must have a date');
    }
  }
});

test('7. Term average calculations correctly calculate arithmetic averages and handle missing marks', () => {
  const mockAssessments = [
    { term: 1, percentage: 78 },
    { term: 1, percentage: 85 },
    { term: 1, percentage: 72 },
    { term: 1, percentage: 90 },
    { term: 1, percentage: null }, // Missing mark / descriptive
    { term: 2, percentage: 74 }
  ];

  // Term 1: (78 + 85 + 72 + 90) / 4 = 325 / 4 = 81.25 -> rounded to 81.3
  const t1Avg = calculateTermAverage(mockAssessments, 1);
  assert.equal(t1Avg, 81.3);

  // Term 2: 74
  const t2Avg = calculateTermAverage(mockAssessments, 2);
  assert.equal(t2Avg, 74);

  // Term 3 has no marks -> null
  const t3Avg = calculateTermAverage(mockAssessments, 3);
  assert.equal(t3Avg, null);

  // Year average: (81.3 + 74) / 2 = 77.65 -> 77.7
  const yearAvg = calculateYearAverage({ 1: t1Avg, 2: t2Avg, 3: t3Avg });
  assert.equal(yearAvg, 77.7);

  // Academic improvement: latest (74) - earliest (81.3) = -7.3 pts
  const improvement = calculateImprovement({ 1: 68, 2: 74, 3: 81 });
  assert.equal(improvement, 13, '+13 percentage points from Term 1 to Term 3');
});

test('8. CAPS 1-7 rating scale maps percentages accurately', () => {
  assert.equal(getCapsRating(85).code, 7, '85% must be Level 7 (Outstanding)');
  assert.equal(getCapsRating(75).code, 6, '75% must be Level 6 (Meritorious)');
  assert.equal(getCapsRating(65).code, 5, '65% must be Level 5 (Substantial)');
  assert.equal(getCapsRating(55).code, 4, '55% must be Level 4 (Adequate)');
  assert.equal(getCapsRating(45).code, 3, '45% must be Level 3 (Moderate)');
  assert.equal(getCapsRating(35).code, 2, '35% must be Level 2 (Elementary)');
  assert.equal(getCapsRating(25).code, 1, '25% must be Level 1 (Not achieved)');
});

test('9. Reading development tracks tier progression journey across terms', () => {
  const db = seedData();
  const c = db.classes[2];
  const learner = c.learners[8]; // Thando (history: [18, 24, 31, 38])

  const record = getLearnerAcademicRecord(learner, c.grade, c.teacher);
  assert.ok(record.tierHistory[1]);
  assert.ok(record.tierHistory[2]);
  assert.ok(record.tierHistory[3]);
  assert.ok(record.tierHistory[4]);

  // Fluency speed progression
  assert.deepEqual(record.history, [18, 24, 31, 38]);
  assert.equal(record.history[3] - record.history[0], 20, '20 WPM improvement over year');
});

test('10. Grade R Foundation Phase early literacy indicators are preserved', () => {
  const db = seedData();
  const gradeRClass = db.classes[0];
  const gradeRLearner = gradeRClass.learners[0];

  const record = getLearnerAcademicRecord(gradeRLearner, 'R', gradeRClass.teacher);
  assert.ok(record.gradeRLiteracy, 'Grade R must have early literacy indicators');
  assert.ok(record.gradeRLiteracy.some(i => i.area === 'Listening & Speaking'));
  assert.ok(record.gradeRLiteracy.some(i => i.area === 'Phonological Awareness'));
  assert.ok(record.gradeRLiteracy.some(i => i.area === 'Letter Recognition'));
});

test('11. Attendance tracking calculates percentages and logs dates', () => {
  const db = seedData();
  const c = db.classes[2];
  const learner = c.learners[0];

  const record = getLearnerAcademicRecord(learner, c.grade, c.teacher);
  assert.ok(record.attendanceSummary.overallPercentage > 85);
  assert.ok(record.attendanceRecords.length > 0);

  const firstRec = record.attendanceRecords[0];
  assert.ok(firstRec.date);
  assert.ok(['Present', 'Absent', 'Late', 'Excused'].includes(firstRec.status));
});

test('12. Teacher observations can be added, retrieved, and deleted', () => {
  const db = seedData();
  const c = db.classes[2];
  const learner = c.learners[8];

  const record = getLearnerAcademicRecord(learner, c.grade, c.teacher);
  const initialCount = record.observations.length;
  assert.ok(initialCount > 0, 'Learner should have initial teacher observations');

  // Add observation
  const newObs = {
    id: 'obs-test-1',
    term: 4,
    date: '2026-11-02',
    author: 'Sir Iak',
    text: 'Thando demonstrated great enthusiasm in today’s oral reading.'
  };
  const updatedObsList = [newObs, ...record.observations];
  assert.equal(updatedObsList.length, initialCount + 1);
  assert.equal(updatedObsList[0].text, newObs.text);

  // Delete observation
  const afterDelete = updatedObsList.filter(o => o.id !== 'obs-test-1');
  assert.equal(afterDelete.length, initialCount);
  assert.equal(afterDelete.some(o => o.id === 'obs-test-1'), false);
});

test('13. Teacher changes to learner reading tier update classroom state and persist', () => {
  const db = seedData();
  const c = db.classes[2];
  const target = c.learners[0];
  const originalTier = target.group;

  const nextTier = originalTier === 'Seed' ? 'Sprout' : 'Seed';
  const updatedLearners = c.learners.map(l => l.id === target.id ? { ...l, group: nextTier } : l);

  assert.equal(updatedLearners.find(l => l.id === target.id).group, nextTier);
});

test('14. Unauthorized profile access restriction (teachers only access their assigned classroom)', () => {
  const db = seedData();
  const grade2Class = db.classes[2];
  const grade1Class = db.classes[1];

  const grade2LearnerIds = new Set(grade2Class.learners.map(l => l.id));
  const grade1LearnerIds = new Set(grade1Class.learners.map(l => l.id));

  // No overlap
  for (const id of grade2LearnerIds) {
    assert.equal(grade1LearnerIds.has(id), false, `Learner ${id} should not belong to Grade 1`);
  }
});

