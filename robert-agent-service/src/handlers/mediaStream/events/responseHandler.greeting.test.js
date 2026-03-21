import { test } from 'node:test';
import assert from 'node:assert';
import { shouldAdvanceInitialGreetingAfterCancelledNonActive } from './responseHandler.js';

test('shouldAdvanceInitialGreetingAfterCancelledNonActive is true for cancelled initial greeting', () => {
  const state = {
    cancelledResponseIds: new Set(['resp_a']),
    hasInitialGreetingBeenSent: true,
    hasInitialGreetingCompleted: false
  };
  assert.strictEqual(shouldAdvanceInitialGreetingAfterCancelledNonActive(state, 'resp_a', 'cancelled'), true);
  assert.strictEqual(shouldAdvanceInitialGreetingAfterCancelledNonActive(state, 'resp_a', 'canceled'), true);
});

test('shouldAdvanceInitialGreetingAfterCancelledNonActive is false when response not in cancelled set', () => {
  const state = {
    cancelledResponseIds: new Set(['resp_other']),
    hasInitialGreetingBeenSent: true,
    hasInitialGreetingCompleted: false
  };
  assert.strictEqual(shouldAdvanceInitialGreetingAfterCancelledNonActive(state, 'resp_a', 'cancelled'), false);
});

test('shouldAdvanceInitialGreetingAfterCancelledNonActive is false when greeting already completed', () => {
  const state = {
    cancelledResponseIds: new Set(['resp_a']),
    hasInitialGreetingBeenSent: true,
    hasInitialGreetingCompleted: true
  };
  assert.strictEqual(shouldAdvanceInitialGreetingAfterCancelledNonActive(state, 'resp_a', 'cancelled'), false);
});

test('shouldAdvanceInitialGreetingAfterCancelledNonActive is false for completed status', () => {
  const state = {
    cancelledResponseIds: new Set(['resp_a']),
    hasInitialGreetingBeenSent: true,
    hasInitialGreetingCompleted: false
  };
  assert.strictEqual(shouldAdvanceInitialGreetingAfterCancelledNonActive(state, 'resp_a', 'completed'), false);
});
