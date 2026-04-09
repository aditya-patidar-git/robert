import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectBestMatchingSlot,
  computeInstructorAvailabilityMeta,
  buildInstructorPriorityShortlist
} from './checkAvailability.js';

test('selectBestMatchingSlot restricts scoring to preferred centre when matches exist', () => {
  const slots = [
    {
      date: 'Mon 1st',
      startDate: '2026-04-01T09:00:00Z',
      time: '09:00',
      location: 'CR0 1AA (Croydon)',
      instructor: 'Sean Smith',
      price: '£99'
    },
    {
      date: 'Mon 1st',
      startDate: '2026-04-01T10:00:00Z',
      time: '10:00',
      location: 'HA8 9XX (Edgware)',
      instructor: 'Guilherme',
      price: '£99'
    }
  ];
  const picked = selectBestMatchingSlot(slots, {
    location: 'Edgware',
    instructor: 'Sean'
  });
  const loc = picked.location || '';
  assert.match(loc, /Edgware|HA8/i);
  assert.equal(/Croydon|CR0/i.test(loc), false);
});

test('selectBestMatchingSlot instructor-only still scores and picks matching instructor', () => {
  const slots = [
    {
      date: 'Wed 8th',
      startDate: '2026-04-08T09:00:00Z',
      time: '09:00',
      location: 'EN11 (Hoddesdon)',
      instructor: 'Jorge',
      price: '£205'
    },
    {
      date: 'Thu 9th',
      startDate: '2026-04-09T07:30:00Z',
      time: '07:30',
      location: 'RM9 (Dagenham)',
      instructor: 'Sean Smith',
      price: '£550'
    }
  ];
  const picked = selectBestMatchingSlot(slots, { instructor: 'Sean' });
  assert.equal(String(picked.instructor || '').toLowerCase().includes('sean'), true);
});

test('selectBestMatchingSlot picks instructor match within preferred centre', () => {
  const slots = [
    {
      date: 'Mon 1st',
      startDate: '2026-04-01T09:00:00Z',
      time: '09:00',
      location: 'HA8 9XX (Edgware)',
      instructor: 'Guilherme',
      price: '£99'
    },
    {
      date: 'Mon 1st',
      startDate: '2026-04-01T11:00:00Z',
      time: '11:00',
      location: 'HA8 9XX (Edgware)',
      instructor: 'Sean Jones',
      price: '£99'
    }
  ];
  const picked = selectBestMatchingSlot(slots, {
    location: 'Edgware',
    instructor: 'Sean'
  });
  assert.equal(String(picked.instructor || '').toLowerCase().includes('sean'), true);
});

test('computeInstructorAvailabilityMeta detects instructor away from preferred centre', () => {
  const slots = [
    {
      date: 'Mon 1st',
      startDate: '2026-04-01T09:00:00Z',
      time: '09:00',
      location: 'HA8 9XX (Edgware)',
      instructor: 'Guilherme',
      price: '£99'
    },
    {
      date: 'Mon 1st',
      startDate: '2026-04-01T10:00:00Z',
      time: '10:00',
      location: 'CR0 1AA (Croydon)',
      instructor: 'Sean Smith',
      price: '£99'
    }
  ];
  const meta = computeInstructorAvailabilityMeta(slots, {
    location: 'Edgware',
    instructor: 'Sean'
  });
  assert.equal(meta.instructorAwayFromPreferredCentre, true);
  assert.equal(meta.instructorMatchAtPreferredLocation, false);
  assert.equal(meta.instructorSlotsOtherCentres.length >= 1, true);
});

test('computeInstructorAvailabilityMeta instructorRequestedButNoSlotMatch when absent', () => {
  const slots = [
    {
      date: 'Mon 1st',
      startDate: '2026-04-01T09:00:00Z',
      time: '09:00',
      location: 'HA8 9XX (Edgware)',
      instructor: 'Guilherme',
      price: '£99'
    }
  ];
  const meta = computeInstructorAvailabilityMeta(slots, {
    location: 'Edgware',
    instructor: 'Sean'
  });
  assert.equal(meta.instructorRequestedButNoSlotMatch, true);
  assert.equal(meta.anyInstructorMatch, false);
  assert.equal(meta.suggestInstructorSpellingConfirmation, true);
});

test('computeInstructorAvailabilityMeta suggestInstructorSpellingConfirmation false when no slots to compare', () => {
  const meta = computeInstructorAvailabilityMeta([], { instructor: 'Sean' });
  assert.equal(meta.instructorRequestedButNoSlotMatch, true);
  assert.equal(meta.suggestInstructorSpellingConfirmation, false);
});

test('buildInstructorPriorityShortlist prefers matching instructor up to cap', () => {
  const ref = new Date('2026-04-08T12:00:00.000Z').getTime();
  const slots = [
    {
      date: 'Tue 8th',
      startDate: '2026-04-08T09:00:00Z',
      time: '09:00',
      location: 'EN11 (Hoddesdon)',
      instructor: 'Sean Smith',
      price: '£1'
    },
    {
      date: 'Wed 9th',
      startDate: '2026-04-09T10:00:00Z',
      time: '10:00',
      location: 'RM9 (Dagenham)',
      instructor: 'Sean Jones',
      price: '£2'
    },
    {
      date: 'Thu 10th',
      startDate: '2026-04-10T11:00:00Z',
      time: '11:00',
      location: 'CR0 (Croydon)',
      instructor: 'Sean Brown',
      price: '£3'
    }
  ];
  const { slots: out, includesOtherInstructors } = buildInstructorPriorityShortlist(slots, 'Sean', ref, 3);
  assert.equal(out.length, 3);
  assert.equal(includesOtherInstructors, false);
  for (const s of out) {
    assert.match(String(s.instructor || '').toLowerCase(), /sean/);
  }
});

test('buildInstructorPriorityShortlist fills with other instructors when fewer than cap matches', () => {
  const ref = new Date('2026-04-08T12:00:00.000Z').getTime();
  const slots = [
    {
      date: 'Tue 8th',
      startDate: '2026-04-08T09:00:00Z',
      time: '09:00',
      location: 'EN11 (Hoddesdon)',
      instructor: 'Sean Smith',
      price: '£1'
    },
    {
      date: 'Wed 9th',
      startDate: '2026-04-09T10:00:00Z',
      time: '10:00',
      location: 'RM9 (Dagenham)',
      instructor: 'Jorge',
      price: '£2'
    },
    {
      date: 'Thu 10th',
      startDate: '2026-04-10T11:00:00Z',
      time: '11:00',
      location: 'CR0 (Croydon)',
      instructor: 'Amy',
      price: '£3'
    }
  ];
  const { slots: out, includesOtherInstructors } = buildInstructorPriorityShortlist(slots, 'Sean', ref, 3);
  assert.equal(out.length, 3);
  assert.equal(includesOtherInstructors, true);
  assert.match(String(out[0].instructor || '').toLowerCase(), /sean/);
});

test('Step 1 preference store gate: explicit null counts as present (matches baseStepTool)', () => {
  const STEP1_PREF_KEYS = ['preferredDate', 'preferredTime', 'location', 'instructor'];
  const withNull = { courseType: 'CBT', location: null, instructor: null };
  assert.equal(STEP1_PREF_KEYS.some((k) => Object.hasOwn(withNull, k)), true);
  const omitted = { courseType: 'CBT' };
  assert.equal(STEP1_PREF_KEYS.some((k) => Object.hasOwn(omitted, k)), false);
});
