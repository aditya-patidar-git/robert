/**
 * Detects whether the caller's response to "Have you done training with us before?"
 * indicates YES (existing) or NO/UNSURE (new), producing a hint that guards against
 * the LLM choosing the wrong workflowType.
 *
 * Per the documentation (ITM V3, Full Licence V3, Cancellation):
 *   "Yes"       → workflowType = "existing"
 *   "No"        → workflowType = "new"
 *   "Unsure"    → workflowType = "new"
 */

const AFFIRMATIVE_PATTERNS = [
  /\byes\b/i,
  /\byeah\b/i,
  /\byep\b/i,
  /\byup\b/i,
  /\bsure\b/i,
  /\bof\s*course\b/i,
  /\babsolutely\b/i,
  /\bdefinitely\b/i,
  /\bcertainly\b/i,
  /\bcorrect\b/i,
  /\bthat'?s?\s*right\b/i,
  /\bi\s+have\b/i,
  /\bi\s+did\b/i,
  /\bi'?ve\s+(done|trained|been)\b/i,
  /\baffirmative\b/i,
  /\bindeed\b/i,
  /\bfor\s+sure\b/i,
  /\btotally\b/i,
  /\bexactly\b/i,
  /\bpositive\b/i,
  /\bthat\s+is\s+correct\b/i,
  /\bmm\s*hmm\b/i,
  /\buh\s*huh\b/i,
];

const NEGATIVE_PATTERNS = [
  /\bno\b/i,
  /\bnope\b/i,
  /\bnah\b/i,
  /\bnot\s+(sure|really|yet)\b/i,
  /\bi\s+haven'?t\b/i,
  /\bi\s+have\s+not\b/i,
  /\bi\s+didn'?t\b/i,
  /\bi\s+did\s+not\b/i,
  /\bi\s+don'?t\s+(think|know|believe)\b/i,
  /\bnever\b/i,
  /\bunsure\b/i,
  /\bdon'?t\s+know\b/i,
  /\bnot\s+before\b/i,
  /\bfirst\s+time\b/i,
  /\bnew\s+to\s+this\b/i,
  /\bnot\s+that\s+i\s+(know|remember|recall)\b/i,
];

/**
 * Analyse caller transcript and return a workflow hint.
 * @param {string} transcript - Raw caller utterance
 * @returns {{ hint: 'existing'|'new'|null, confidence: 'high'|'low' }}
 */
export function detectTrainedBeforeHint(transcript) {
  if (!transcript || typeof transcript !== 'string') {
    return { hint: null, confidence: 'low' };
  }

  const text = transcript.trim();
  if (text.length === 0) return { hint: null, confidence: 'low' };

  const matchesNegative = NEGATIVE_PATTERNS.some(p => p.test(text));
  const matchesAffirmative = AFFIRMATIVE_PATTERNS.some(p => p.test(text));

  // Negative patterns take priority when both match because negation
  // phrases like "I have not" / "Not sure" / "I did not" contain
  // affirmative sub-words but the overall intent is negative.
  if (matchesNegative) {
    return { hint: 'new', confidence: 'high' };
  }
  if (matchesAffirmative) {
    return { hint: 'existing', confidence: 'high' };
  }

  return { hint: null, confidence: 'low' };
}
