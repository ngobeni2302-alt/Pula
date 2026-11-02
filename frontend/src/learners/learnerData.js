// Learner Academic Profile Data Management & Calculations
// South African Foundation Phase & CAPS Curriculum Aligned

import { getParentForLearner } from '../dashboardData.js';
import { getDBESchoolCalendar } from '../calendar/calendarData.js';

/**
 * Returns the full name for a learner (deterministic South African naming).
 */
export function getLearnerFullName(learner, grade = '2') {
  if (!learner) return 'Learner';
  const parent = getParentForLearner(learner, grade);
  return parent.learnerName || learner.name;
}

/**
 * Foundation Phase CAPS Rating Scale (Codes 1 - 7):
 * 7: Outstanding achievement (80% - 100%)
 * 6: Meritorious achievement (70% - 79%)
 * 5: Substantial achievement (60% - 69%)
 * 4: Adequate achievement (50% - 59%)
 * 3: Moderate achievement (40% - 49%)
 * 2: Elementary achievement (30% - 39%)
 * 1: Not achieved (0% - 29%)
 */
export const CAPS_RATING_SCALE = {
  7: { code: 7, label: 'Outstanding Achievement', min: 80, max: 100, color: '#1f593b', bg: '#dce9df' },
  6: { code: 6, label: 'Meritorious Achievement', min: 70, max: 79, color: '#2a5b84', bg: '#dce7f2' },
  5: { code: 5, label: 'Substantial Achievement', min: 60, max: 69, color: '#493774', bg: '#e5dff0' },
  4: { code: 4, label: 'Adequate Achievement', min: 50, max: 59, color: '#715814', bg: '#fbf3dc' },
  3: { code: 3, label: 'Moderate Achievement', min: 40, max: 49, color: '#8e4b10', bg: '#fce8d5' },
  2: { code: 2, label: 'Elementary Achievement', min: 30, max: 39, color: '#84311e', bg: '#fce4de' },
  1: { code: 1, label: 'Not Achieved', min: 0, max: 29, color: '#8a2312', bg: '#fcdcd5' }
};

export function getCapsRating(percentage) {
  if (percentage >= 80) return CAPS_RATING_SCALE[7];
  if (percentage >= 70) return CAPS_RATING_SCALE[6];
  if (percentage >= 60) return CAPS_RATING_SCALE[5];
  if (percentage >= 50) return CAPS_RATING_SCALE[4];
  if (percentage >= 40) return CAPS_RATING_SCALE[3];
  if (percentage >= 30) return CAPS_RATING_SCALE[2];
  return CAPS_RATING_SCALE[1];
}

/**
 * Calculates the arithmetic average of numerical marks for a term.
 * Excludes assessments without valid numerical marks.
 */
export function calculateTermAverage(assessments = [], term = 1) {
  const termAssessments = assessments.filter(
    a => a.term === term && typeof a.percentage === 'number' && !isNaN(a.percentage)
  );

  if (termAssessments.length === 0) return null;

  const sum = termAssessments.reduce((acc, curr) => acc + curr.percentage, 0);
  return Math.round((sum / termAssessments.length) * 10) / 10;
}

/**
 * Calculates Year-to-Date overall academic average across completed terms.
 */
export function calculateYearAverage(termAverages = {}) {
  const values = Object.values(termAverages).filter(v => typeof v === 'number' && !isNaN(v));
  if (values.length === 0) return null;
  const sum = values.reduce((acc, curr) => acc + curr, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

/**
 * Calculates academic improvement in percentage points between the earliest
 * and latest available finalized term results.
 */
export function calculateImprovement(termAverages = {}) {
  const validTerms = [1, 2, 3, 4].filter(
    t => typeof termAverages[t] === 'number' && !isNaN(termAverages[t])
  );

  if (validTerms.length < 2) return null;

  const earliest = termAverages[validTerms[0]];
  const latest = termAverages[validTerms[validTerms.length - 1]];
  const diff = Math.round((latest - earliest) * 10) / 10;
  return diff;
}

/**
 * Generates or enriches complete deterministic academic records for a learner.
 */
export function getLearnerAcademicRecord(learner, grade = '2', teacherName = 'Teacher') {
  if (!learner) return null;

  const isGradeR = grade === 'R';
  const fullName = getLearnerFullName(learner, grade);
  const code = learner.code || 4;
  const history = learner.history || [20, 24, 28, 32];

  // Reading tier progression throughout the year
  const group = learner.group || 'Seed';
  const tierHistory = {
    1: group === 'Tree' ? 'Sprout' : group === 'Bloom' ? 'Seed' : 'Seed',
    2: group === 'Tree' ? 'Bloom' : group === 'Bloom' ? 'Sprout' : group === 'Sprout' ? 'Seed' : 'Seed',
    3: group === 'Tree' ? 'Bloom' : group === 'Bloom' ? 'Bloom' : group === 'Sprout' ? 'Sprout' : 'Seed',
    4: group
  };

  // Base percentages for Terms 1 to 4 tailored to the learner's CAPS code
  // Code 1: ~35%, Code 4: ~58%, Code 7: ~86%
  const baseScore = Math.min(92, Math.max(32, 28 + code * 9));
  const term1Score = Math.max(30, Math.round(baseScore - 8));
  const term2Score = Math.max(35, Math.round(baseScore - 4));
  const term3Score = Math.max(40, Math.round(baseScore));
  const term4Score = Math.min(98, Math.round(baseScore + 3));

  // Default assessments if none stored yet
  const defaultAssessments = [
    // --- Term 1 ---
    {
      id: `${learner.id}-t1-1`,
      term: 1,
      subject: isGradeR ? 'Listening & Speaking' : 'English Home Language',
      type: 'Reading assessment',
      name: isGradeR ? 'Sound & Rhyme Recognition' : 'Phonics & Oral Reading',
      date: '2026-02-16',
      maxMark: isGradeR ? null : 20,
      achievedMark: isGradeR ? null : Math.round(20 * (term1Score / 100)),
      percentage: term1Score,
      competencyLevel: isGradeR ? (code >= 5 ? 'Achieved' : 'Developing') : null,
      feedback: isGradeR
        ? 'Engages well in story listening and recognizes initial rhymes.'
        : 'Good effort in letter-sound blending. Continue daily word practice.'
    },
    {
      id: `${learner.id}-t1-2`,
      term: 1,
      subject: 'Mathematics',
      type: 'Test',
      name: isGradeR ? 'Number Sense & Counting' : 'Number Concepts to 20',
      date: '2026-03-04',
      maxMark: 25,
      achievedMark: Math.round(25 * ((term1Score + 4) / 100)),
      percentage: Math.min(100, term1Score + 4),
      feedback: 'Understands basic counting and number pattern relationships.'
    },
    {
      id: `${learner.id}-t1-3`,
      term: 1,
      subject: 'Life Skills',
      type: 'Project',
      name: isGradeR ? 'My Family & Classroom' : 'Personal Care & Community',
      date: '2026-03-18',
      maxMark: 20,
      achievedMark: Math.round(20 * ((term1Score + 8) / 100)),
      percentage: Math.min(100, term1Score + 8),
      feedback: 'Enthusiastic participation in class discussion and drawings.'
    },

    // --- Term 2 ---
    {
      id: `${learner.id}-t2-1`,
      term: 2,
      subject: isGradeR ? 'Emergent Literacy' : 'English Home Language',
      type: 'Reading assessment',
      name: isGradeR ? 'Letter-Sound Matching' : 'Shared Big Book Reading',
      date: '2026-05-11',
      maxMark: isGradeR ? null : 30,
      achievedMark: isGradeR ? null : Math.round(30 * (term2Score / 100)),
      percentage: term2Score,
      competencyLevel: isGradeR ? (code >= 4 ? 'Achieved' : 'Needs Support') : null,
      feedback: 'Noticeable confidence boost during small-group reading exercises.'
    },
    {
      id: `${learner.id}-t2-2`,
      term: 2,
      subject: 'Mathematics',
      type: 'Test',
      name: isGradeR ? 'Shapes & Spatial Relations' : 'Addition & Subtraction to 50',
      date: '2026-06-03',
      maxMark: 30,
      achievedMark: Math.round(30 * ((term2Score + 2) / 100)),
      percentage: Math.min(100, term2Score + 2),
      feedback: 'Solves practical calculations systematically with number line.'
    },
    {
      id: `${learner.id}-t2-3`,
      term: 2,
      subject: isGradeR ? 'Life Skills' : 'English Home Language',
      type: 'Spelling test',
      name: isGradeR ? 'Mark-Making & Fine Motor' : 'Mid-Year Spelling Words',
      date: '2026-06-17',
      maxMark: 20,
      achievedMark: Math.round(20 * (term2Score / 100)),
      percentage: term2Score,
      feedback: 'Consistent spelling practice observed at home and in class.'
    },

    // --- Term 3 ---
    {
      id: `${learner.id}-t3-1`,
      term: 3,
      subject: isGradeR ? 'Listening & Speaking' : 'English Home Language',
      type: 'Reading assessment',
      name: isGradeR ? 'Story Retelling' : 'Reading Fluency & Comprehension',
      date: '2026-08-24',
      maxMark: isGradeR ? null : 35,
      achievedMark: isGradeR ? null : Math.round(35 * (term3Score / 100)),
      percentage: term3Score,
      competencyLevel: isGradeR ? 'Achieved' : null,
      feedback: 'Answers open-ended comprehension questions accurately and clearly.'
    },
    {
      id: `${learner.id}-t3-2`,
      term: 3,
      subject: 'Mathematics',
      type: 'Exam',
      name: 'Term 3 Formal Assessment',
      date: '2026-09-14',
      maxMark: 40,
      achievedMark: Math.round(40 * ((term3Score + 3) / 100)),
      percentage: Math.min(100, term3Score + 3),
      feedback: 'Excellent work on word sums and measurement activities.'
    },
    {
      id: `${learner.id}-t3-3`,
      term: 3,
      subject: 'Life Skills',
      type: 'Project',
      name: 'Creative Arts & Movement',
      date: '2026-09-28',
      maxMark: 25,
      achievedMark: Math.round(25 * ((term3Score + 7) / 100)),
      percentage: Math.min(100, term3Score + 7),
      feedback: 'Creative, imaginative presentation with great teamwork.'
    },

    // --- Term 4 (In Progress) ---
    {
      id: `${learner.id}-t4-1`,
      term: 4,
      subject: isGradeR ? 'Emergent Literacy' : 'English Home Language',
      type: 'Homework',
      name: 'Story Chat & Home Reading',
      date: '2026-10-21',
      maxMark: 10,
      achievedMark: Math.round(10 * ((term4Score - 2) / 100)),
      percentage: term4Score - 2,
      feedback: 'Completed on time with signed parent feedback.'
    },
    {
      id: `${learner.id}-t4-2`,
      term: 4,
      subject: 'Mathematics',
      type: 'Test',
      name: 'End-of-Year Readiness Test',
      date: '2026-11-04',
      maxMark: 30,
      achievedMark: Math.round(30 * (term4Score / 100)),
      percentage: term4Score,
      feedback: 'Solid mastery of foundational concepts heading into next grade.'
    }
  ];

  // Attendance summary & records
  const defaultAttendanceRecords = [
    { date: '2026-02-12', status: 'Absent', term: 1, reason: 'Illness (flu)' },
    { date: '2026-03-05', status: 'Late', term: 1, reason: 'Transport delay' },
    { date: '2026-05-14', status: 'Absent', term: 2, reason: 'Medical appointment' },
    { date: '2026-06-08', status: 'Excused', term: 2, reason: 'Family event' },
    { date: '2026-08-18', status: 'Absent', term: 3, reason: 'Fever' },
    { date: '2026-10-27', status: 'Late', term: 4, reason: 'Heavy traffic' }
  ];

  const termAttendance = {
    1: { schoolDays: 50, present: 48, absent: 1, late: 1, excused: 0, percentage: 96 },
    2: { schoolDays: 52, present: 49, absent: 1, late: 0, excused: 1, percentage: 96.1 },
    3: { schoolDays: 53, present: 51, absent: 1, late: 0, excused: 1, percentage: 96.2 },
    4: { schoolDays: 20, present: 19, absent: 0, late: 1, excused: 0, percentage: 95 }
  };

  // Observations
  const defaultObservations = [
    {
      id: `obs-${learner.id}-1`,
      term: 1,
      date: '2026-03-24',
      author: teacherName,
      text: `${fullName} has settled very well into Grade ${grade}. Shows eager curiosity during shared reading rounds and socializes warmly with classmates.`
    },
    {
      id: `obs-${learner.id}-2`,
      term: 2,
      date: '2026-06-22',
      author: teacherName,
      text: `Demonstrates significant confidence growth. Transitioned from ${tierHistory[1]} to ${tierHistory[2]} reading tier following steady practice.`
    },
    {
      id: `obs-${learner.id}-3`,
      term: 3,
      date: '2026-09-30',
      author: teacherName,
      text: `Consistently participates in classroom discussions. Well prepared for daily tasks; shows excellent focus during guided reading.`
    }
  ];

  // Merge stored learner records if available
  const assessments = learner.assessments || defaultAssessments;
  const observations = learner.observations || defaultObservations;
  const attendanceRecords = learner.attendanceRecords || defaultAttendanceRecords;

  // Compute Term Averages
  const termAverages = {
    1: calculateTermAverage(assessments, 1),
    2: calculateTermAverage(assessments, 2),
    3: calculateTermAverage(assessments, 3),
    4: calculateTermAverage(assessments, 4)
  };

  const yearAverage = calculateYearAverage(termAverages);
  const improvement = calculateImprovement(termAverages);

  // Overall attendance calculation
  const totalDays = Object.values(termAttendance).reduce((acc, curr) => acc + curr.schoolDays, 0);
  const totalPresent = Object.values(termAttendance).reduce((acc, curr) => acc + curr.present, 0);
  const overallAttendanceRate = Math.round((totalPresent / totalDays) * 1000) / 10;

  // Grade R literacy readiness indicators
  const gradeRLiteracy = isGradeR ? [
    { area: 'Listening & Speaking', status: code >= 4 ? 'Proficient' : 'Developing', score: code * 12 },
    { area: 'Phonological Awareness', status: code >= 5 ? 'Proficient' : 'Emerging', score: (code - 1) * 14 },
    { area: 'Letter Recognition', status: code >= 4 ? 'Proficient' : 'Developing', score: code * 11 },
    { area: 'Sound-Symbol Association', status: code >= 5 ? 'Proficient' : 'Developing', score: (code - 1) * 12 },
    { area: 'Fine Motor & Mark Making', status: 'Proficient', score: 85 }
  ] : null;

  return {
    learnerId: learner.id,
    fullName,
    grade,
    currentTier: learner.group,
    tierHistory,
    code,
    history,
    assessments,
    termAverages,
    yearAverage,
    improvement,
    attendanceSummary: {
      overallPercentage: overallAttendanceRate,
      terms: termAttendance
    },
    attendanceRecords,
    observations,
    gradeRLiteracy,
    strategy: learner.strategy || 'Guided reading and sight words practice',
    reviewDate: learner.review || '2026-11-13'
  };
}

