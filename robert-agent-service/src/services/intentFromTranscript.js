/**
 * Maps raw transcript text to intent string for workflow phase selection.
 * Single responsibility: transcript text -> intent string (matches getPhaseForIntent keys).
 * Returns { intent, isStrongStartIntent } so mid-workflow we only switch on strong intents.
 */

/** Strong = explicit start-of-workflow; weak = substring that can be part of an answer (e.g. "book" in "booked"). */
const BOOKING_PHRASES = [
  { phrase: 'want to book', intent: 'book', strong: true },
  { phrase: 'would like to book', intent: 'book', strong: true },
  { phrase: 'make a booking', intent: 'book', strong: true },
  { phrase: 'make booking', intent: 'book', strong: true },
  { phrase: 'book a', intent: 'book', strong: true },
  { phrase: 'book an', intent: 'book', strong: true },
  { phrase: 'book my', intent: 'book', strong: true },
  { phrase: 'check availability', intent: 'check_availability', strong: true },
  { phrase: 'check available', intent: 'check_availability', strong: true },
  { phrase: 'availability', intent: 'availability', strong: true },
  { phrase: 'book', intent: 'book', strong: false }
];

/** Long phrases first; single word "cancel" is weak (could be part of answer). */
const CANCELLATION_PHRASES = [
  { phrase: 'cancel my booking', strong: true },
  { phrase: 'cancel booking', strong: true },
  { phrase: 'cancel the booking', strong: true },
  { phrase: 'want to cancel', strong: true },
  { phrase: 'would like to cancel', strong: true },
  { phrase: 'need to cancel', strong: true },
  { phrase: 'cancel my course', strong: true },
  { phrase: 'cancel course', strong: true },
  { phrase: 'cancel my cbt', strong: true },
  { phrase: 'cancel cbt', strong: true },
  { phrase: 'cancellation', strong: true },
  { phrase: 'cancel', strong: false }
];

const TRANSFER_TO_HUMAN_PHRASES = [
  'talk to a human',
  'talk to human',
  'speak to a human',
  'speak to human',
  'human agent',
  'transfer to human',
  'transfer to a human',
  'transfer me to',
  'speak with an agent',
  'talk to an agent',
  'real person',
  'real agent',
  'live agent',
  'live person'
];

export function isTransferToHumanRequest(transcriptText) {
  if (!transcriptText || typeof transcriptText !== 'string') return false;
  const normalized = transcriptText.trim().toLowerCase();
  if (!normalized) return false;
  return TRANSFER_TO_HUMAN_PHRASES.some(phrase => normalized.includes(phrase));
}

/**
 * @returns {{ intent: string|null, isStrongStartIntent: boolean }}
 */
export function getIntentFromTranscript(transcriptText) {
  const empty = { intent: null, isStrongStartIntent: false };
  if (!transcriptText || typeof transcriptText !== 'string') return empty;
  const normalized = transcriptText.trim().toLowerCase();
  if (!normalized) return empty;

  if (isTransferToHumanRequest(transcriptText)) return { intent: 'transfer_to_human', isStrongStartIntent: true };

  for (const { phrase, strong } of CANCELLATION_PHRASES) {
    if (normalized.includes(phrase)) {
      const intent = phrase === 'cancel my booking' || phrase === 'cancel booking' || phrase === 'cancel the booking' ? 'cancel_booking'
        : phrase === 'cancellation' ? 'cancellation'
        : 'cancel';
      return { intent, isStrongStartIntent: strong };
    }
  }
  for (const { phrase, intent, strong } of BOOKING_PHRASES) {
    const matches = phrase === 'book'
      ? /\bbook\b/.test(normalized)
      : normalized.includes(phrase);
    if (matches) return { intent, isStrongStartIntent: strong };
  }
  return empty;
}
