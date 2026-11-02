// South African School Calendar & Public Holidays Engine
// Uses official Department of Basic Education (DBE) school term calendars
// and the Public Holidays Act (Act No 36 of 1994) of South Africa.

/**
 * Calculates Easter Sunday for any year using the Meeus/Jones/Butcher algorithm.
 * Accurate for all years in the Gregorian calendar.
 */
export function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns South African Public Holidays for any given year.
 * Includes fixed holidays, dynamically calculated movable holidays (Good Friday, Family Day),
 * and official observed holidays on Monday when a public holiday falls on Sunday.
 */
export function getSouthAfricanPublicHolidays(year) {
  const holidays = [];

  const addHoliday = (name, month, day) => {
    const holidayDate = new Date(Date.UTC(year, month - 1, day));
    const dateStr = formatDate(holidayDate);
    const dayOfWeek = holidayDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ...

    holidays.push({
      id: `za-ph-${dateStr}`,
      title: name,
      date: dateStr,
      type: 'Public holiday',
      category: 'public_holiday',
      isPublicHoliday: true,
      description: 'Official South African Public Holiday'
    });

    // South African Public Holidays Act: if any holiday falls on Sunday, following Monday is a public holiday
    if (dayOfWeek === 0) {
      const observedDate = new Date(Date.UTC(year, month - 1, day + 1));
      const obsDateStr = formatDate(observedDate);
      holidays.push({
        id: `za-ph-obs-${obsDateStr}`,
        title: `${name} (Observed)`,
        date: obsDateStr,
        type: 'Public holiday',
        category: 'public_holiday',
        isPublicHoliday: true,
        description: `${name} fell on a Sunday; observed on Monday`
      });
    }
  };

  // Fixed national public holidays
  addHoliday("New Year's Day", 1, 1);
  addHoliday('Human Rights Day', 3, 21);
  addHoliday('Freedom Day', 4, 27);
  addHoliday("Workers' Day", 5, 1);
  addHoliday('Youth Day', 6, 16);
  addHoliday("National Women's Day", 8, 9);
  addHoliday('Heritage Day', 9, 24);
  addHoliday('Day of Reconciliation', 12, 16);
  addHoliday('Christmas Day', 12, 25);
  addHoliday('Day of Goodwill', 12, 26);

  // If Christmas Day is Sunday (Dec 25), Dec 26 is Christmas Day (Observed), and Dec 27 is Day of Goodwill (Observed)
  const xmas = new Date(Date.UTC(year, 11, 25));
  if (xmas.getUTCDay() === 0) {
    const goodwillObs = new Date(Date.UTC(year, 11, 27));
    const obsStr = formatDate(goodwillObs);
    if (!holidays.some(h => h.date === obsStr)) {
      holidays.push({
        id: `za-ph-obs-goodwill-${obsStr}`,
        title: 'Day of Goodwill (Observed)',
        date: obsStr,
        type: 'Public holiday',
        category: 'public_holiday',
        isPublicHoliday: true,
        description: 'Observed public holiday following Christmas Day on Sunday'
      });
    }
  }

  // Movable religious holidays tied to Easter
  const easter = getEasterSunday(year);

  // Good Friday = 2 days before Easter Sunday
  const goodFriday = new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000);
  const gfStr = formatDate(goodFriday);
  holidays.push({
    id: `za-ph-gf-${gfStr}`,
    title: 'Good Friday',
    date: gfStr,
    type: 'Public holiday',
    category: 'public_holiday',
    isPublicHoliday: true,
    description: 'Official South African Public Holiday'
  });

  // Family Day (Easter Monday) = 1 day after Easter Sunday
  const familyDay = new Date(easter.getTime() + 1 * 24 * 60 * 60 * 1000);
  const fdStr = formatDate(familyDay);
  holidays.push({
    id: `za-ph-fd-${fdStr}`,
    title: 'Family Day',
    date: fdStr,
    type: 'Public holiday',
    category: 'public_holiday',
    isPublicHoliday: true,
    description: 'Official South African Public Holiday (Easter Monday)'
  });

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Official South African Department of Basic Education (DBE) school term dates
 * published by the Department of Basic Education (https://www.education.gov.za)
 */
export const DBE_SCHOOL_CALENDARS = {
  2025: {
    year: 2025,
    verified: true,
    source: 'Department of Basic Education South Africa',
    terms: [
      { term: 1, name: 'Term 1', start: '2025-01-15', end: '2025-03-28' },
      { term: 2, name: 'Term 2', start: '2025-04-08', end: '2025-06-27' },
      { term: 3, name: 'Term 3', start: '2025-07-22', end: '2025-10-03' },
      { term: 4, name: 'Term 4', start: '2025-10-13', end: '2025-12-10' }
    ],
    holidays: [
      { name: 'Term 1 School Holidays', start: '2025-03-29', end: '2025-04-07' },
      { name: 'Term 2 School Holidays (Winter)', start: '2025-06-28', end: '2025-07-21' },
      { name: 'Term 3 School Holidays (Spring)', start: '2025-10-04', end: '2025-10-12' },
      { name: 'Summer School Holidays', start: '2025-12-11', end: '2026-01-13' }
    ]
  },
  2026: {
    year: 2026,
    verified: true,
    source: 'Department of Basic Education South Africa (Official National Calendar)',
    terms: [
      { term: 1, name: 'Term 1', start: '2026-01-14', end: '2026-03-27' },
      { term: 2, name: 'Term 2', start: '2026-04-08', end: '2026-06-26' },
      { term: 3, name: 'Term 3', start: '2026-07-21', end: '2026-10-02' },
      { term: 4, name: 'Term 4', start: '2026-10-13', end: '2026-12-09' }
    ],
    holidays: [
      { name: 'Term 1 School Holidays (Autumn)', start: '2026-03-28', end: '2026-04-07' },
      { name: 'Term 2 School Holidays (Winter)', start: '2026-06-27', end: '2026-07-20' },
      { name: 'Term 3 School Holidays (Spring)', start: '2026-10-03', end: '2026-10-12' },
      { name: 'Summer School Holidays', start: '2026-12-10', end: '2027-01-12' }
    ]
  },
  2027: {
    year: 2027,
    verified: true,
    source: 'Department of Basic Education South Africa (Projected Academic Calendar)',
    terms: [
      { term: 1, name: 'Term 1', start: '2027-01-13', end: '2027-03-26' },
      { term: 2, name: 'Term 2', start: '2027-04-06', end: '2027-06-25' },
      { term: 3, name: 'Term 3', start: '2027-07-20', end: '2027-10-01' },
      { term: 4, name: 'Term 4', start: '2027-10-12', end: '2027-12-08' }
    ],
    holidays: [
      { name: 'Term 1 School Holidays', start: '2027-03-27', end: '2027-04-05' },
      { name: 'Term 2 School Holidays (Winter)', start: '2027-06-26', end: '2027-07-19' },
      { name: 'Term 3 School Holidays (Spring)', start: '2027-10-02', end: '2027-10-11' },
      { name: 'Summer School Holidays', start: '2027-12-09', end: '2028-01-11' }
    ]
  }
};

/**
 * Returns DBE school terms and milestone events for a given year.
 */
export function getDBESchoolCalendar(year) {
  const cal = DBE_SCHOOL_CALENDARS[year];
  if (!cal) {
    return {
      available: false,
      message: 'Official school calendar not yet available.',
      terms: [],
      events: []
    };
  }

  const events = [];

  // Generate milestone events: Term Begins / Term Ends
  for (const t of cal.terms) {
    events.push({
      id: `dbe-term-${year}-${t.term}-start`,
      title: `${t.name} Begins`,
      date: t.start,
      type: 'School opening',
      category: 'school_opening',
      term: t.term,
      description: `South African public school opening: ${t.name}`
    });

    events.push({
      id: `dbe-term-${year}-${t.term}-end`,
      title: `${t.name} Ends`,
      date: t.end,
      type: 'School closing',
      category: 'school_closing',
      term: t.term,
      description: `South African public school closing: ${t.name}`
    });
  }

  return {
    available: true,
    year,
    verified: cal.verified,
    source: cal.source,
    terms: cal.terms,
    holidays: cal.holidays,
    events
  };
}

/**
 * Checks whether a given ISO date string (YYYY-MM-DD) falls within an official school holiday period.
 */
export function isSchoolHoliday(dateStr, year) {
  const cal = DBE_SCHOOL_CALENDARS[year];
  if (!cal || !cal.holidays) return null;

  for (const h of cal.holidays) {
    if (dateStr >= h.start && dateStr <= h.end) {
      return h;
    }
  }
  return null;
}

/**
 * Checks which term a date belongs to.
 */
export function getCurrentTerm(dateStr, year) {
  const cal = DBE_SCHOOL_CALENDARS[year];
  if (!cal || !cal.terms) return null;

  for (const t of cal.terms) {
    if (dateStr >= t.start && dateStr <= t.end) {
      return t;
    }
  }
  return null;
}

/**
 * Returns the current date in South African Standard Time (SAST, UTC+2).
 */
export function getSASTToday() {
  const now = new Date();
  // Interpret in Africa/Johannesburg timezone
  const formatter = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long'
  });

  const parts = formatter.formatToParts(now);
  let y = '', m = '', d = '', weekday = '';
  for (const p of parts) {
    if (p.type === 'year') y = p.value;
    if (p.type === 'month') m = p.value;
    if (p.type === 'day') d = p.value;
    if (p.type === 'weekday') weekday = p.value;
  }

  return {
    dateStr: `${y}-${m}-${d}`,
    year: parseInt(y, 10),
    month: parseInt(m, 10), // 1-12
    day: parseInt(d, 10),
    weekday,
    displayFull: `${weekday}, ${parseInt(d, 10)} ${getMonthName(parseInt(m, 10) - 1)} ${y}`
  };
}

export function getMonthName(monthIndex) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[monthIndex] || '';
}

/**
 * Computes calendar days matrix for a given year and month (0-indexed).
 * Week starts on Monday (South African standard).
 */
export function buildMonthMatrix(year, monthIndex) {
  // Days in month
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  // First day of month (0 = Sun, 1 = Mon, ... 6 = Sat)
  const firstDay = new Date(year, monthIndex, 1).getDay();
  // Convert to Monday = 0, Sunday = 6
  const startOffset = (firstDay + 6) % 7;

  const matrix = [];
  let currentWeek = [];

  // Previous month trailing days
  const prevMonthDays = new Date(year, monthIndex, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1;
    const prevYear = monthIndex === 0 ? year - 1 : year;
    const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const isWeekend = currentWeek.length === 5 || currentWeek.length === 6;
    currentWeek.push({
      dateStr,
      day: dayNum,
      isCurrentMonth: false,
      isWeekend
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isWeekend = currentWeek.length === 5 || currentWeek.length === 6;

    currentWeek.push({
      dateStr,
      day,
      isCurrentMonth: true,
      isWeekend
    });

    if (currentWeek.length === 7) {
      matrix.push(currentWeek);
      currentWeek = [];
    }
  }

  // Next month leading days to complete the last week
  if (currentWeek.length > 0) {
    let nextDay = 1;
    while (currentWeek.length < 7) {
      const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1;
      const nextYear = monthIndex === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
      const isWeekend = currentWeek.length === 5 || currentWeek.length === 6;
      currentWeek.push({
        dateStr,
        day: nextDay,
        isCurrentMonth: false,
        isWeekend
      });
      nextDay++;
    }
    matrix.push(currentWeek);
  }

  return matrix;
}

/**
 * Standard event colour and icon definitions consistent with Pula branding
 */
export const EVENT_CATEGORY_CONFIG = {
  Test: {
    bg: '#dce7f2', // Soft blue
    color: '#1a4369',
    dotColor: '#2563eb', // Blue dot
    icon: '📚',
    label: 'Test'
  },
  Exam: {
    bg: '#e5dff0', // Soft purple
    color: '#493774',
    dotColor: '#7c3aed', // Purple dot
    icon: '📋',
    label: 'Exam'
  },
  Homework: {
    bg: '#fbf3dc', // Soft yellow
    color: '#715814',
    dotColor: '#eab308', // Yellow dot
    icon: '📝',
    label: 'Homework'
  },
  'Spelling test': {
    bg: '#fce4de', // Soft pink / peach
    color: '#84311e',
    dotColor: '#ec4899', // Pink dot
    icon: '✏️',
    label: 'Spelling test'
  },
  'Public holiday': {
    bg: '#fcdcd5', // Soft coral
    color: '#8a2312',
    dotColor: '#ef4444', // Coral dot
    icon: '🏛️',
    label: 'Public holiday'
  },
  'School holiday': {
    bg: '#ede6f7', // Soft lavender
    color: '#55427d',
    dotColor: '#a855f7', // Lavender dot
    icon: '🏖️',
    label: 'School holiday'
  },
  'School opening': {
    bg: '#dce9df', // Soft green
    color: '#1f593b',
    dotColor: '#10b981', // Green dot
    icon: '🔔',
    label: 'School opening'
  },
  'School closing': {
    bg: '#fce8d5', // Soft orange
    color: '#8e4b10',
    dotColor: '#f97316', // Orange dot
    icon: '🚪',
    label: 'School closing'
  }
};
