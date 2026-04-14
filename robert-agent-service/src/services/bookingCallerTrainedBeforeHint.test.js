import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectTrainedBeforeHint } from './bookingCallerTrainedBeforeHint.js';

describe('detectTrainedBeforeHint', () => {
  const existing = [
    'Yes',
    'yes',
    'Yeah',
    'Yep',
    'Sure',
    'Sure.',
    'Of course',
    'Absolutely',
    'Definitely',
    'I have',
    'I did',
    "I've done training before",
    "I've been there",
    'Correct',
    "That's right",
    'Indeed',
    'For sure',
    'Mm hmm',
    'Uh huh',
    'Totally',
    'Positive',
    'Certainly',
  ];

  for (const phrase of existing) {
    it(`"${phrase}" → existing`, () => {
      const result = detectTrainedBeforeHint(phrase);
      assert.equal(result.hint, 'existing', `Expected "existing" for "${phrase}", got "${result.hint}"`);
      assert.equal(result.confidence, 'high');
    });
  }

  const newClient = [
    'No',
    'Nope',
    'Nah',
    'Not sure',
    "I haven't",
    'I have not',
    "I didn't",
    'I did not',
    "I don't think so",
    'Never',
    'Unsure',
    "Don't know",
    'Not before',
    'First time',
    'New to this',
    'Not really',
    'Not yet',
  ];

  for (const phrase of newClient) {
    it(`"${phrase}" → new`, () => {
      const result = detectTrainedBeforeHint(phrase);
      assert.equal(result.hint, 'new', `Expected "new" for "${phrase}", got "${result.hint}"`);
      assert.equal(result.confidence, 'high');
    });
  }

  const ambiguous = [
    '',
    null,
    undefined,
    'What was the question again?',
    'Can you repeat that?',
    'Hmm',
  ];

  for (const phrase of ambiguous) {
    it(`"${phrase}" → null (ambiguous)`, () => {
      const result = detectTrainedBeforeHint(phrase);
      assert.equal(result.hint, null, `Expected null for "${phrase}", got "${result.hint}"`);
    });
  }
});
