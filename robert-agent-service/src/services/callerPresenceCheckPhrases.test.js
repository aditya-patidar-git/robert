import test from 'node:test';
import assert from 'node:assert/strict';
import { isCallerPresenceCheckPhrase } from './callerPresenceCheckPhrases.js';

test('detects common presence checks', () => {
  assert.equal(isCallerPresenceCheckPhrase('hey are you there'), true);
  assert.equal(isCallerPresenceCheckPhrase('Are you still there?'), true);
  assert.equal(isCallerPresenceCheckPhrase('can you hear me'), true);
  assert.equal(isCallerPresenceCheckPhrase('hello'), true);
  assert.equal(isCallerPresenceCheckPhrase('still there?'), true);
});

test('rejects long or unrelated phrases', () => {
  assert.equal(isCallerPresenceCheckPhrase('hey'), false);
  assert.equal(
    isCallerPresenceCheckPhrase('hey are you there I wanted to book a lesson for next Tuesday please'),
    false
  );
  assert.equal(isCallerPresenceCheckPhrase('book me there'), false);
});
