import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAvailabilityDateIntent,
  filterSlotsByDateIntent,
  nextCalendarWeekAfterCurrentLondon,
  midMonthRangeLondon,
  computeAnchorRangeFromSlots
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
