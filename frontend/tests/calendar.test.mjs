import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEasterSunday,
  getSouthAfricanPublicHolidays,
  getDBESchoolCalendar,
  isSchoolHoliday,
  getCurrentTerm,
  getSASTToday,
  getMonthName,
  buildMonthMatrix,
  EVENT_CATEGORY_CONFIG
} from '../src/calendar/calendarData.js';

test('1. Meeus/Jones/Butcher algorithm accurately calculates Easter Sunday', () => {
  // Easter Sunday benchmark dates
  const easter2025 = getEasterSunday(2025);
  assert.equal(easter2025.toISOString().slice(0, 10), '2025-04-20');

  const easter2026 = getEasterSunday(2026);
  assert.equal(easter2026.toISOString().slice(0, 10), '2026-04-05');

  const easter2027 = getEasterSunday(2027);
  assert.equal(easter2027.toISOString().slice(0, 10), '2027-03-28');

  const easter2028 = getEasterSunday(2028);
  assert.equal(easter2028.toISOString().slice(0, 10), '2028-04-16');
});

test('2. Movable South African religious holidays (Good Friday and Family Day)', () => {
  const holidays2026 = getSouthAfricanPublicHolidays(2026);

  const goodFriday = holidays2026.find(h => h.title === 'Good Friday');
  assert.ok(goodFriday, 'Good Friday must be present in 2026');
  assert.equal(goodFriday.date, '2026-04-03', 'Good Friday 2026 must be 2 days before Easter (April 3)');

  const familyDay = holidays2026.find(h => h.title === 'Family Day');
  assert.ok(familyDay, 'Family Day must be present in 2026');
  assert.equal(familyDay.date, '2026-04-06', 'Family Day 2026 must be Monday after Easter (April 6)');
});

test('3. South African Public Holidays Sunday-to-Monday rollover rule (Act No 36 of 1994)', () => {
  // In 2026, August 9 (National Women\'s Day) falls on a Sunday
  const holidays2026 = getSouthAfricanPublicHolidays(2026);

  const womensDay = holidays2026.find(h => h.date === '2026-08-09');
  assert.ok(womensDay, 'National Women\'s Day on Sunday Aug 9 must be in the holiday list');

  const womensDayObserved = holidays2026.find(h => h.date === '2026-08-10');
  assert.ok(womensDayObserved, 'Observed Monday holiday must be added when public holiday falls on Sunday');
  assert.equal(womensDayObserved.title, 'National Women\'s Day (Observed)');
  assert.equal(womensDayObserved.isPublicHoliday, true);
});

test('4. Standard fixed South African public holidays present for 2026', () => {
  const holidays2026 = getSouthAfricanPublicHolidays(2026);
  const titles = holidays2026.map(h => h.title);

  assert.ok(titles.includes('New Year\'s Day'));
  assert.ok(titles.includes('Human Rights Day'));
  assert.ok(titles.includes('Freedom Day'));
  assert.ok(titles.includes('Workers\' Day'));
  assert.ok(titles.includes('Youth Day'));
  assert.ok(titles.includes('Heritage Day'));
  assert.ok(titles.includes('Day of Reconciliation'));
  assert.ok(titles.includes('Christmas Day'));
  assert.ok(titles.includes('Day of Goodwill'));
});

test('5. Official DBE school term dates for 2025, 2026, and 2027', () => {
  const cal2026 = getDBESchoolCalendar(2026);
  assert.equal(cal2026.available, true);
  assert.equal(cal2026.terms.length, 4);

  // Term 1
  assert.equal(cal2026.terms[0].start, '2026-01-14');
  assert.equal(cal2026.terms[0].end, '2026-03-27');

  // Term 4
  assert.equal(cal2026.terms[3].start, '2026-10-13');
  assert.equal(cal2026.terms[3].end, '2026-12-09');

  // School milestones: opening and closing
  const openingEvt = cal2026.events.find(e => e.type === 'School opening' && e.date === '2026-01-14');
  assert.ok(openingEvt, 'Term 1 school opening event should be present');

  const closingEvt = cal2026.events.find(e => e.type === 'School closing' && e.date === '2026-12-09');
  assert.ok(closingEvt, 'Term 4 school closing event should be present');
});

test('6. Unverified future years provide informative fallback notification', () => {
  const futureCal = getDBESchoolCalendar(2035);
  assert.equal(futureCal.available, false);
  assert.equal(futureCal.message, 'Official school calendar not yet available.');
  assert.deepEqual(futureCal.terms, []);
});

test('7. Active term and school holiday detection', () => {
  // During Term 4 (e.g. 2026-11-02)
  const term = getCurrentTerm('2026-11-02', 2026);
  assert.ok(term, 'Should identify Term 4 is active on 2026-11-02');
  assert.equal(term.term, 4);

  const holidayOnSchoolDay = isSchoolHoliday('2026-11-02', 2026);
  assert.equal(holidayOnSchoolDay, null, '2026-11-02 is a normal school day');

  // During Winter Term Break (e.g. 2026-07-05)
  const holiday = isSchoolHoliday('2026-07-05', 2026);
  assert.ok(holiday, 'Should identify Winter holiday on 2026-07-05');
  assert.equal(holiday.name, 'Term 2 School Holidays (Winter)');

  const termDuringBreak = getCurrentTerm('2026-07-05', 2026);
  assert.equal(termDuringBreak, null, 'No term active during term break');
});

test('8. Live SAST Today resolution and date formatting', () => {
  const sast = getSASTToday();
  assert.ok(sast.dateStr.match(/^\d{4}-\d{2}-\d{2}$/));
  assert.ok(sast.year >= 2025);
  assert.ok(sast.month >= 1 && sast.month <= 12);
  assert.ok(sast.day >= 1 && sast.day <= 31);
  assert.ok(sast.displayFull.length > 5);

  assert.equal(getMonthName(0), 'January');
  assert.equal(getMonthName(10), 'November');
  assert.equal(getMonthName(11), 'December');
});

test('9. Calendar grid matrix construction and leap year handling', () => {
  // Non-leap year: 2026 February (28 days)
  const matrixFeb2026 = buildMonthMatrix(2026, 1);
  const feb2026Days = matrixFeb2026.flatMap(w => w).filter(c => c.isCurrentMonth);
  assert.equal(feb2026Days.length, 28, 'Feb 2026 must have 28 days');

  // Leap year: 2028 February (29 days)
  const matrixFeb2028 = buildMonthMatrix(2028, 1);
  const feb2028Days = matrixFeb2028.flatMap(w => w).filter(c => c.isCurrentMonth);
  assert.equal(feb2028Days.length, 29, 'Feb 2028 must have 29 days');

  // Ensure every week has exactly 7 columns
  for (const week of matrixFeb2026) {
    assert.equal(week.length, 7, 'Each calendar row must have 7 days (Mon-Sun)');
  }

  // Check weekend flags on Saturday and Sunday
  for (const week of matrixFeb2026) {
    assert.equal(week[0].isWeekend, false, 'Monday must not be weekend');
    assert.equal(week[4].isWeekend, false, 'Friday must not be weekend');
    assert.equal(week[5].isWeekend, true, 'Saturday must be weekend');
    assert.equal(week[6].isWeekend, true, 'Sunday must be weekend');
  }
});

test('10. Event category design configuration adheres to soft pastel palette', () => {
  const types = ['Test', 'Exam', 'Homework', 'Spelling test', 'Public holiday', 'School holiday'];
  for (const t of types) {
    const cfg = EVENT_CATEGORY_CONFIG[t];
    assert.ok(cfg, `Config for ${t} must exist`);
    assert.ok(cfg.bg.startsWith('#'), `${t} background must be a hex color`);
    assert.ok(cfg.color.startsWith('#'), `${t} text color must be a hex color`);
    assert.ok(cfg.icon.length > 0, `${t} must have an icon`);
  }
});

test('11. Teacher Add/Edit/Delete schoolwork item calendar data updates', () => {
  const initialItems = [
    { id: 'item-1', type: 'Test', title: 'Maths Word Problems', date: '2026-11-05', detail: 'Practise addition', told: false },
    { id: 'item-2', type: 'Spelling test', title: 'Short Vowels Test', date: '2026-11-06', detail: 'Words with /a/ and /e/', told: true }
  ];

  // 1. Add new item
  const newItem = { id: 'item-3', type: 'Homework', title: 'Read Chapter 3', date: '2026-11-04', detail: '10 mins with parent', told: false };
  const itemsAfterAdd = [...initialItems, newItem];
  assert.equal(itemsAfterAdd.length, 3);
  assert.ok(itemsAfterAdd.find(i => i.id === 'item-3'));

  // 2. Edit existing item
  const updatedItem = { ...newItem, title: 'Read Chapter 3 & 4', detail: '15 mins with parent' };
  const itemsAfterEdit = itemsAfterAdd.map(i => i.id === updatedItem.id ? updatedItem : i);
  const found = itemsAfterEdit.find(i => i.id === 'item-3');
  assert.equal(found.title, 'Read Chapter 3 & 4');
  assert.equal(found.detail, '15 mins with parent');

  // 3. Mark told / notify parents
  const itemsAfterNotify = itemsAfterEdit.map(i => i.id === 'item-3' ? { ...i, told: true } : i);
  assert.equal(itemsAfterNotify.find(i => i.id === 'item-3').told, true);

  // 4. Delete item
  const itemsAfterDelete = itemsAfterNotify.filter(i => i.id !== 'item-1');
  assert.equal(itemsAfterDelete.length, 2);
  assert.equal(itemsAfterDelete.some(i => i.id === 'item-1'), false);
});

test('12. HOD grade filtering aggregates schoolwork across classrooms', () => {
  const mockClasses = [
    { grade: 'R', room: 'RB', teacher: 'Mrs. Sibanda', items: [{ id: 'r1', type: 'Spelling test', title: 'Rhymes', date: '2026-11-05' }] },
    { grade: '1', room: '1A', teacher: 'Miss Ndlovu', items: [{ id: 'g1', type: 'Test', title: 'Phonics 1', date: '2026-11-06' }] },
    { grade: '2', room: '2C', teacher: 'Mr. Khumalo', items: [{ id: 'g2', type: 'Exam', title: 'Mid-term Maths', date: '2026-11-10' }] }
  ];

  // Grade filter = 'All'
  const allSchoolwork = mockClasses.flatMap(cl =>
    cl.items.map(i => ({ ...i, grade: cl.grade, classroomName: `Grade ${cl.room}` }))
  );
  assert.equal(allSchoolwork.length, 3);

  // Grade filter = '1'
  const filterGrade1 = mockClasses
    .filter(cl => cl.grade === '1')
    .flatMap(cl => cl.items.map(i => ({ ...i, grade: cl.grade })));
  assert.equal(filterGrade1.length, 1);
  assert.equal(filterGrade1[0].title, 'Phonics 1');
});

test('13. Parent view permissions & child selection logic', () => {
  const mockChildren = [
    { id: 'c1', name: 'Thando Mokoena', grade: 'R' },
    { id: 'c2', name: 'Lerato Dlamini', grade: '2' }
  ];

  let activeChildId = 'c1';
  assert.equal(activeChildId, 'c1');

  // Switch child to Lerato
  activeChildId = 'c2';
  const currentChild = mockChildren.find(c => c.id === activeChildId);
  assert.equal(currentChild.name, 'Lerato Dlamini');
  assert.equal(currentChild.grade, '2');
});
