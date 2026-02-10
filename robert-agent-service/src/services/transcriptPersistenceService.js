import CallRecord from '../database/models/CallRecord.js';
import gdprService from './gdprService.js';
import piiDetectionService from './piiDetectionService.js';

/**
 * Append a single transcript entry to CallRecord (append-only, no overwrite).
 * Only persists when consentGiven is true.
 * @param {string} callSid - Call SID
 * @param {Object} entry - { role: 'user'|'agent', text: string, timestamp: Date, confidence?: number }
 * @param {{ consentGiven?: boolean }} options - consentGiven must be true to persist
 * @returns {Promise<void>}
 */
export async function appendTranscriptEntry(callSid, entry, options = {}) {
  if (!callSid || !entry?.role || entry.text == null) return;
  const ignoreConsent = process.env.TRANSCRIPT_PERSIST_IGNORE_CONSENT === 'true';
  if (!ignoreConsent && options.consentGiven !== true) return;

  let textToSave = entry.text;
  if (typeof entry.text === 'string') {
    try {
      const privacyConfig = await gdprService.getPrivacyConfig();
      if (privacyConfig?.transcriptRedaction?.maskPIIAtSave) {
        const redacted = piiDetectionService.redactTranscriptSegments([{ role: entry.role, text: entry.text, timestamp: entry.timestamp, confidence: entry.confidence }]);
        textToSave = redacted?.[0]?.text ?? entry.text;
      }
    } catch (_) {}
  }

  const doc = {
    role: entry.role,
    text: textToSave,
    timestamp: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
    confidence: entry.confidence != null ? entry.confidence : undefined
  };

  await CallRecord.findOneAndUpdate(
    { callSid },
    { $push: { transcript: doc } },
    { upsert: false }
  );
}
