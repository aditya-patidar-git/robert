import { conversations } from '../../../shared/state.js';

const GRACE_BUFFER_STALE_MS = 8000;

/**
 * Merge text that was flushed from pendingTranscriptionsAfterGrace on barge-in into the next user turn.
 * Clears conversation.bargeInFlushedGraceText when consumed (one-shot).
 * Discards the buffer if it is older than GRACE_BUFFER_STALE_MS to avoid corrupting intent
 * with fragments from a much earlier turn (e.g. "Hello" prepended to "I want to book a CBT").
 * @param {string} callSid
 * @param {string} [transcriptText]
 * @returns {string}
 */
export function mergeWithBargeInFlushedGrace(callSid, transcriptText) {
  const conv = conversations[callSid];
  if (!conv?.bargeInFlushedGraceText) {
    return (transcriptText || '').trim();
  }
  const prefix = String(conv.bargeInFlushedGraceText).trim();
  const bufferAge = conv.bargeInFlushedGraceTextTime
    ? Date.now() - conv.bargeInFlushedGraceTextTime
    : Infinity;
  delete conv.bargeInFlushedGraceText;
  delete conv.bargeInFlushedGraceTextTime;

  if (bufferAge > GRACE_BUFFER_STALE_MS) {
    console.log(
      `🗑️ [${callSid}] Discarded stale grace-buffer (${bufferAge}ms old, limit ${GRACE_BUFFER_STALE_MS}ms): "${prefix.slice(0, 80)}"`
    );
    return (transcriptText || '').trim();
  }

  const t = (transcriptText || '').trim();
  const merged = t ? `${prefix} ${t}`.trim() : prefix;
  if (prefix) {
    console.log(`📎 [${callSid}] Merged barge-in flushed grace buffer into user turn (${merged.length} chars, ${bufferAge}ms old)`);
  }
  return merged;
}
