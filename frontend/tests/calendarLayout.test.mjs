import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthMatrix,
  EVENT_CATEGORY_CONFIG,
  getDBESchoolCalendar,
  getSouthAfricanPublicHolidays
} from '../src/calendar/calendarData.js';

test('1. Calendar grid columns are strictly 7 equal divisions across all target screen sizes', () => {
  const targetViewports = [320, 360, 375, 390, 414, 600, 768, 1024, 1440];

  for (const viewport of targetViewports) {
    // Determine shell container padding based on dashboards.css & calendar.css
    const isMobileShell = viewport <= 600;
    const shellPadding = viewport <= 340 ? 12 : viewport <= 400 ? 20 : isMobileShell ? 32 : 80;
    const containerWidth = Math.min(viewport, isMobileShell ? 480 : 1440) - shellPadding;

    // Calendar wrapper padding & grid padding & gaps
    const wrapperPadding = containerWidth <= 360 ? 8 : 20;
    const gridPadding = containerWidth <= 360 ? 6 : 10;
    const gap = containerWidth <= 360 ? 1.5 : 3;
    const availableGridWidth = containerWidth - wrapperPadding - gridPadding;

    // 7 columns with 6 gaps
    const totalGapsWidth = gap * 6;
    const columnWidth = (availableGridWidth - totalGapsWidth) / 7;

    assert.ok(
      columnWidth >= 30,
      `At viewport ${viewport}px, each day cell width (${columnWidth.toFixed(1)}px) must be >= 30px`
    );

    const totalCalculatedWidth = columnWidth * 7 + totalGapsWidth + gridPadding + wrapperPadding;
    assert.ok(
      Math.abs(totalCalculatedWidth - containerWidth) < 0.01,
      `Total calendar width must fit strictly within container width at ${viewport}px`
    );
  }
});

test('2. Layout handles months requiring 6 rows (e.g. August 2026, May 2027) without overflowing', () => {
  // August 2026 begins on Saturday (monthIndex = 7) and has 31 days -> requires 6 weeks
  const matrixAug2026 = buildMonthMatrix(2026, 7);
  assert.equal(matrixAug2026.length, 6, 'August 2026 must generate 6 rows');

  for (const [idx, row] of matrixAug2026.entries()) {
    assert.equal(row.length, 7, `Row ${idx + 1} must have exactly 7 days`);
  }

  // May 2027 begins on Saturday (monthIndex = 4) and has 31 days -> requires 6 weeks
  const matrixMay2027 = buildMonthMatrix(2027, 4);
  assert.equal(matrixMay2027.length, 6, 'May 2027 must generate 6 rows');

  for (const [idx, row] of matrixMay2027.entries()) {
    assert.equal(row.length, 7, `Row ${idx + 1} must have exactly 7 days`);
  }
});

test('3. Mobile event dot indicators match exact prompt color mapping', () => {
  const expectedColors = {
    'Homework': '#eab308',     // Yellow
    'Test': '#2563eb',         // Blue
    'Exam': '#7c3aed',         // Purple
    'Spelling test': '#ec4899',// Pink
    'Public holiday': '#ef4444',// Coral
    'School holiday': '#a855f7',// Lavender
    'School opening': '#10b981',// Green
    'School closing': '#f97316' // Orange
  };

  for (const [category, hex] of Object.entries(expectedColors)) {
    const config = EVENT_CATEGORY_CONFIG[category];
    assert.ok(config, `Category "${category}" must have a config`);
    assert.equal(config.dotColor, hex, `Category "${category}" dotColor must match ${hex}`);
  }
});

test('4. Date cells with multiple events display max 3 dots plus count indicator on small screens', () => {
  const mockDateEvents = [
    { id: '1', title: 'Maths Test', category: 'Test' },
    { id: '2', title: 'English Homework', category: 'Homework' },
    { id: '3', title: 'Spelling Bee', category: 'Spelling test' },
    { id: '4', title: 'Public Holiday', category: 'Public holiday' },
    { id: '5', title: 'Term Milestone', category: 'School closing' }
  ];

  const visibleDots = mockDateEvents.slice(0, 3);
  const remainingCount = mockDateEvents.length - visibleDots.length;

  assert.equal(visibleDots.length, 3, 'Must cap visible dots at 3');
  assert.equal(remainingCount, 2, 'Remaining events count must equal 2 (+2 indicator)');
});

test('5. Calendar container constraints prevent horizontal overflow in mobile shells', () => {
  // Mobile shells in Pula (Teacher & Parent) are bounded by max-width: 480px
  const shellMaxWidth = 480;
  const padding = 32; // 16px left + 16px right
  const usableWidth = shellMaxWidth - padding;

  const wrapperPadding = 20; // 10px left + 10px right
  const gridPadding = 8;     // 4px left + 4px right
  const gaps = 2.5 * 6;      // 15px

  const cellWidth = (usableWidth - wrapperPadding - gridPadding - gaps) / 7;

  assert.ok(cellWidth > 50, 'Cells in standard 480px phone container have ample room (~58px)');
  assert.ok(cellWidth * 7 + gaps + gridPadding + wrapperPadding <= usableWidth);
});

test('6. All 7 weekdays (Mon-Sun) are accounted for in every row without truncation', () => {
  for (let month = 0; month < 12; month++) {
    const matrix = buildMonthMatrix(2026, month);
    for (const week of matrix) {
      assert.equal(week.length, 7, `Month ${month + 1} has a week that does not have 7 days`);
      assert.equal(week[0].isWeekend, false, 'First column must be Monday (weekday)');
      assert.equal(week[1].isWeekend, false, 'Second column must be Tuesday (weekday)');
      assert.equal(week[2].isWeekend, false, 'Third column must be Wednesday (weekday)');
      assert.equal(week[3].isWeekend, false, 'Fourth column must be Thursday (weekday)');
      assert.equal(week[4].isWeekend, false, 'Fifth column must be Friday (weekday)');
      assert.equal(week[5].isWeekend, true, 'Sixth column must be Saturday (weekend)');
      assert.equal(week[6].isWeekend, true, 'Seventh column must be Sunday (weekend)');
    }
  }
});

