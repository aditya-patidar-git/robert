import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAvailabilityDateIntent,
  filterSlotsByDateIntent,
  nextCalendarWeekAfterCurrentLondon,
  midMonthRangeLondon,
  computeAnchorRangeFromSlots,
  rollingYearFromTodayLondon,
  thisCalendarWeekLondon,
  nextSevenDaysLondon,
  thisMonthRangeLondon,
  nextMonthRangeLondon,
  normalizeSpelledOutDate
} from './availabilityDateIntent.js';

test('ISO date is single-day range', () => {
  const r = resolveAvailabilityDateIntent({
    preferredDate: '2026-04-01',
    now: new Date(),
    lastCheck: null
  });
  assert.equal(r.type, 'range');
  assert.equal(r.startISO, '2026-04-01');
  assert.equal(r.endISO, '2026-04-01');
});

test('next week matches nextCalendarWeekAfterCurrentLondon', () => {
  const now = new Date('2026-03-25T12:00:00.000Z');
  const r = resolveAvailabilityDateIntent({
    preferredDate: 'next week',
    now,
    lastCheck: null
  });
  const w = nextCalendarWeekAfterCurrentLondon(now);
  assert.equal(r.type, 'range');
  assert.equal(r.startISO, w.startISO);
  assert.equal(r.endISO, w.endISO);
});

test('mid-month range uses midMonthRangeLondon', () => {
  const now = new Date('2026-03-25T12:00:00.000Z');
  const r = resolveAvailabilityDateIntent({
    preferredDate: 'mid of this month',
    now,
    lastCheck: null
  });
  const m = midMonthRangeLondon(now);
  assert.equal(r.type, 'range');
  assert.equal(r.startISO, m.startISO);
  assert.equal(r.endISO, m.endISO);
});

test('weekday-only without lastCheck is next occurrence as single-day range', () => {
  const now = new Date('2026-03-25T12:00:00.000Z');
  const r = resolveAvailabilityDateIntent({
    preferredDate: 'Friday',
    now,
    lastCheck: null
  });
  assert.equal(r.type, 'range');
  assert.equal(r.startISO, '2026-03-27');
  assert.equal(r.endISO, '2026-03-27');
});

test('weekday with anchor range uses weekday intent when that weekday occurs in range', () => {
  const now = new Date('2026-03-25T12:00:00.000Z');
  const r = resolveAvailabilityDateIntent({
    preferredDate: 'Friday',
    now,
    lastCheck: {
      anchorDateMin: '2026-03-23',
      anchorDateMax: '2026-03-29'
    }
  });
  assert.equal(r.type, 'weekday');
  assert.equal(r.weekday, 5);
  assert.equal(r.anchorStartISO, '2026-03-23');
  assert.equal(r.anchorEndISO, '2026-03-29');
});

test('DST late March: Friday resolution stable', () => {
  const now = new Date('2026-03-29T08:00:00.000Z');
  const r = resolveAvailabilityDateIntent({
    preferredDate: 'Tuesday',
    now,
    lastCheck: null
  });
  assert.equal(r.type, 'range');
  assert.ok(r.startISO && r.startISO === r.endISO);
});

test('filterSlotsByDateIntent range and weekday', () => {
  const slots = [
    { startDate: '2026-03-26T10:00:00.000Z' },
    { startDate: '2026-04-01T10:00:00.000Z' },
    { startDate: '2026-03-27T10:00:00.000Z' }
  ];
  const range = filterSlotsByDateIntent(slots, {
    type: 'range',
    startISO: '2026-03-26',
    endISO: '2026-03-31'
  });
  assert.equal(range.filtered.length, 2);
  assert.equal(range.noMatch, false);

  const wd = filterSlotsByDateIntent(slots, {
    type: 'weekday',
    weekday: 5,
    anchorStartISO: '2026-03-23',
    anchorEndISO: '2026-03-31'
  });
  assert.equal(wd.filtered.length, 1);
  assert.ok(wd.filtered[0].startDate.includes('03-27'));
});

test('computeAnchorRangeFromSlots', () => {
  const a = computeAnchorRangeFromSlots({
    slotsToAnnounce: [{ startDate: '2026-04-02T12:00:00Z' }],
    selectedSlot: { startDate: '2026-04-05T12:00:00Z' },
    allSlots: []
  });
  assert.equal(a.anchorDateMin, '2026-04-02');
  assert.equal(a.anchorDateMax, '2026-04-05');
});

const ANCHOR = new Date('2026-04-07T12:00:00.000Z');

test('next 1 year resolves to rolling year range (not single day)', () => {
  const y = rollingYearFromTodayLondon(ANCHOR);
  for (const phrase of ['next 1 year', 'next one year', 'next year', 'within a year', 'next 12 months']) {
    const r = resolveAvailabilityDateIntent({
      preferredDate: phrase,
      now: ANCHOR,
      lastCheck: null
    });
    assert.equal(r.type, 'range');
    assert.equal(r.startISO, y.startISO);
    assert.equal(r.endISO, y.endISO);
  }
});

test('earliest / ASAP / next available resolve to no date filter (full table scan intent)', () => {
  for (const phrase of [
    'earliest',
    'ASAP',
    'as soon as possible',
    'next available',
    'first available',
    'soonest'
  ]) {
    const r = resolveAvailabilityDateIntent({
      preferredDate: phrase,
      now: ANCHOR,
      lastCheck: null
    });
    assert.equal(r.type, 'none', phrase);
  }
});

test('this month and next month spans London current month through end of following month', () => {
  const tm = thisMonthRangeLondon(ANCHOR);
  const nm = nextMonthRangeLondon(ANCHOR);
  const r = resolveAvailabilityDateIntent({
    preferredDate: 'this month and next month',
    now: ANCHOR,
    lastCheck: null
  });
  assert.equal(r.type, 'range');
  assert.equal(r.startISO, tm.startISO);
  assert.equal(r.endISO, nm.endISO);
});

test('this week / next 7 days / this month / next month match helpers', () => {
  const w = thisCalendarWeekLondon(ANCHOR);
  const r1 = resolveAvailabilityDateIntent({
    preferredDate: 'this week',
    now: ANCHOR,
    lastCheck: null
  });
  assert.equal(r1.startISO, w.startISO);
  assert.equal(r1.endISO, w.endISO);

  const d7 = nextSevenDaysLondon(ANCHOR);
  const r2 = resolveAvailabilityDateIntent({
    preferredDate: 'next 7 days',
    now: ANCHOR,
    lastCheck: null
  });
  assert.equal(r2.startISO, d7.startISO);
  assert.equal(r2.endISO, d7.endISO);

  const tm = thisMonthRangeLondon(ANCHOR);
  const r3 = resolveAvailabilityDateIntent({
    preferredDate: 'this month',
    now: ANCHOR,
    lastCheck: null
  });
  assert.equal(r3.startISO, tm.startISO);
  assert.equal(r3.endISO, tm.endISO);

  const nm = nextMonthRangeLondon(ANCHOR);
  const r4 = resolveAvailabilityDateIntent({
    preferredDate: 'next month',
    now: ANCHOR,
    lastCheck: null
  });
  assert.equal(r4.startISO, nm.startISO);
  assert.equal(r4.endISO, nm.endISO);
});

// ── normalizeSpelledOutDate tests ────────────────────────────────────

test('normalizeSpelledOutDate: "twenty fourth of April" → "24 april"', () => {
  const result = normalizeSpelledOutDate('twenty fourth of April');
  assert.ok(result.includes('24'), `Expected 24 in "${result}"`);
  assert.ok(result.toLowerCase().includes('april'), `Expected april in "${result}"`);
});

test('normalizeSpelledOutDate: "the fifteenth of June" → "15 june"', () => {
  const result = normalizeSpelledOutDate('the fifteenth of June');
  assert.ok(result.includes('15'), `Expected 15 in "${result}"`);
  assert.ok(result.toLowerCase().includes('june'), `Expected june in "${result}"`);
});

test('normalizeSpelledOutDate: "thirty first" → "31"', () => {
  const result = normalizeSpelledOutDate('thirty first of December');
  assert.ok(result.includes('31'), `Expected 31 in "${result}"`);
});

test('normalizeSpelledOutDate: "third of May" → contains "3"', () => {
  const result = normalizeSpelledOutDate('third of May');
  assert.ok(result.includes('3'), `Expected 3 in "${result}"`);
});

test('normalizeSpelledOutDate: null/empty returns null', () => {
  assert.equal(normalizeSpelledOutDate(null), null);
  assert.equal(normalizeSpelledOutDate(''), null);
});

// ── spelled-out date integration with resolveAvailabilityDateIntent ──

test('spelled-out date "the twenty fourth of April" resolves to 2026-04-24', () => {
  const now = new Date('2026-04-07T12:00:00.000Z');
  const r = resolveAvailabilityDateIntent({
    preferredDate: 'the twenty fourth of April',
    now,
    lastCheck: null
  });
  assert.equal(r.type, 'range', `Expected range but got ${r.type}`);
  assert.equal(r.startISO, '2026-04-24');
  assert.equal(r.endISO, '2026-04-24');
});

test('spelled-out date "fifteenth of June" resolves to a June 15 range', () => {
  const now = new Date('2026-04-07T12:00:00.000Z');
  const r = resolveAvailabilityDateIntent({
    preferredDate: 'fifteenth of June',
    now,
    lastCheck: null
  });
  assert.equal(r.type, 'range');
  assert.ok(r.startISO.endsWith('-06-15'), `Expected June 15 but got ${r.startISO}`);
});
