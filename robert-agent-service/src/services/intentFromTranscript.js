/**
 * Maps raw transcript text to intent string for workflow phase selection.
 * Single responsibility: transcript text -> intent string (matches getPhaseForIntent keys).
 */

const BOOKING_PHRASES = [
  { phrase: 'want to book', intent: 'book' },
  { phrase: 'would like to book', intent: 'book' },
  { phrase: 'make a booking', intent: 'book' },
  { phrase: 'make booking', intent: 'book' },
  { phrase: 'book a', intent: 'book' },
  { phrase: 'book an', intent: 'book' },
  { phrase: 'book my', intent: 'book' },
  { phrase: 'check availability', intent: 'check_availability' },
  { phrase: 'check available', intent: 'check_availability' },
  { phrase: 'availability', intent: 'availability' },
  { phrase: 'book', intent: 'book' }
];

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

export function getIntentFromTranscript(transcriptText) {
  if (!transcriptText || typeof transcriptText !== 'string') return null;
  const normalized = transcriptText.trim().toLowerCase();
  if (!normalized) return null;

  for (const phrase of CANCELLATION_PHRASES) {
    if (normalized.includes(phrase)) {
      if (phrase === 'cancel my booking' || phrase === 'cancel booking' || phrase === 'cancel the booking') return 'cancel_booking';
      if (phrase === 'cancellation') return 'cancellation';
      return 'cancel';
    }
  }
  for (const { phrase, intent } of BOOKING_PHRASES) {
    if (normalized.includes(phrase)) return intent;
  }
  return null;
}
