import { test } from 'node:test';
import assert from 'node:assert';
import { conversations } from '../../../shared/state.js';
import { mergeWithBargeInFlushedGrace } from './graceBufferMerge.js';

test('mergeWithBargeInFlushedGrace prepends stored text and clears', () => {
  const sid = 'test-merge-grace-' + Date.now();
  conversations[sid] = { bargeInFlushedGraceText: 'first bit' };
  const out = mergeWithBargeInFlushedGrace(sid, 'second bit');
  assert.strictEqual(out, 'first bit second bit');
  assert.strictEqual(conversations[sid].bargeInFlushedGraceText, undefined);
  delete conversations[sid];
});

test('mergeWithBargeInFlushedGrace returns transcript when no flush pending', () => {
  const sid = 'test-merge-none-' + Date.now();
  conversations[sid] = {};
  const out = mergeWithBargeInFlushedGrace(sid, 'only this');
  assert.strictEqual(out, 'only this');
  delete conversations[sid];
});

test('mergeWithBargeInFlushedGrace returns prefix when transcript empty', () => {
  const sid = 'test-merge-prefix-' + Date.now();
  conversations[sid] = { bargeInFlushedGraceText: 'saved' };
  const out = mergeWithBargeInFlushedGrace(sid, '');
  assert.strictEqual(out, 'saved');
  delete conversations[sid];
});
