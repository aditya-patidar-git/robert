import { conversations } from '../../../shared/state.js';

/**
 * Merge text that was flushed from pendingTranscriptionsAfterGrace on barge-in into the next user turn.
 * Clears conversation.bargeInFlushedGraceText when consumed (one-shot).
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
  delete conv.bargeInFlushedGraceText;
  const t = (transcriptText || '').trim();
  const merged = t ? `${prefix} ${t}`.trim() : prefix;
  if (prefix) {
    console.log(`📎 [${callSid}] Merged barge-in flushed grace buffer into user turn (${merged.length} chars)`);
  }
  return merged;
}
