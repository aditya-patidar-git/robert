/**
 * Maps raw transcript text to intent string for workflow phase selection.
 * Single responsibility: transcript text -> intent string (matches getPhaseForIntent keys).
 */

const CANCELLATION_PHRASES = [
  'cancel my booking',
  'cancel booking',
  'cancel the booking',
  'want to cancel',
  'would like to cancel',
  'need to cancel',
  'cancel my course',
  'cancel course',
  'cancel my cbt',
  'cancel cbt',
  'cancellation',
  'cancel'
];

/**
 * Detect intent from user transcript text.
 * @param {string} transcriptText - Raw transcript (one segment or concatenated).
 * @returns {string|null} Intent key for getPhaseForIntent (e.g. 'cancel', 'cancel_booking', 'cancellation') or null for no match.
 */
export function getIntentFromTranscript(transcriptText) {
  if (!transcriptText || typeof transcriptText !== 'string') {
    return null;
  }
  const normalized = transcriptText.trim().toLowerCase();
  if (!normalized) return null;

  for (const phrase of CANCELLATION_PHRASES) {
    if (normalized.includes(phrase)) {
      if (phrase === 'cancel my booking' || phrase === 'cancel booking' || phrase === 'cancel the booking') {
        return 'cancel_booking';
      }
      if (phrase === 'cancellation') return 'cancellation';
      return 'cancel';
    }
  }
  return null;
}
