/**
 * Consent Instruction Builder Service
 * 
 * Builds consent flow instructions based on conversation state.
 * Single responsibility: Generate instructions for the consent flow sequence.
 * 
 * Flow sequence:
 * 1. Language preference question (greeting) - FIRST
 * 2. Consent question - AFTER language is selected
 * 3. "What would you like to do today?" (main follow-up) - AFTER consent is given
 */

class ConsentInstructionBuilder {
  /**
   * Build consent flow instructions based on current state
   * @param {Object} params - Instruction parameters
   * @param {string} params.consentNotice - Consent notice text
   * @param {string} params.consentQuestion - Consent question text
   * @param {boolean} params.languageSelected - Whether language has been selected
   * @param {boolean} params.consentGiven - Whether consent has been given
   * @param {boolean} params.requireExplicitConsent - Whether explicit consent is required
   * @param {string} params.baseInstructions - Base instructions to append
   * @returns {string|null} Complete instruction string or null if not needed
   */
  buildConsentFlowInstructions({
    consentNotice,
    consentQuestion,
    languageSelected = false,
    consentGiven = false,
    requireExplicitConsent = true,
    baseInstructions = ''
  }) {
    if (!requireExplicitConsent || consentGiven) {
      // Consent not required or already given - return null to use default flow
      return null;
    }

    // Build instructions based on current state
    if (!languageSelected) {
      // Phase 1: Language preference question (greeting) - FIRST
      return `IMPORTANT: You must start every call with the following exact sequence:

1. FIRST: Ask the language preference question. Say exactly: "Hello, you're through to Universal Motorcycle Training. This is Robert. What language would you like to use today?"
2. WAIT for the caller's language preference response - DO NOT proceed until you get a clear answer
3. If the language preference is unclear or you detect noise/barge-in, repeat: "What language would you like to use today?" until you get a clear answer

CRITICAL RULES:
- You MUST ask the language preference question FIRST before any other conversation
- DO NOT ask the consent question or "What would you like to do today?" until language preference is confirmed
- If you cannot clearly understand the caller's response (due to noise, barge-in, or unclear speech), you MUST repeat the question
- Do not assume or guess the answer - always wait for a clear response
- The language preference question is MANDATORY - it cannot be skipped

${baseInstructions}`;
    } else if (!consentGiven) {
      // Phase 2: Consent question - AFTER language is selected
      return `IMPORTANT: You must now ask the consent question. Follow this exact sequence:

1. First, say: "${consentNotice}"
2. Then immediately ask: "${consentQuestion}"
3. WAIT for the caller's response (yes, no, or silence) - DO NOT continue until they respond
4. If the caller's response is unclear, ambiguous, or you detect background noise/barge-in that prevents you from understanding their answer, IMMEDIATELY repeat the question: "${consentQuestion}" - DO NOT proceed until you receive a clear yes or no answer

CRITICAL RULES:
- You MUST ask the consent question NOW before proceeding with any other conversation
- You MUST NOT ask "What would you like to do today?" until consent is given
- If you cannot clearly understand the caller's response (due to noise, barge-in, or unclear speech), you MUST repeat the question
- Do not assume or guess the answer - always wait for a clear response

${baseInstructions}`;
    }

    // Phase 3: After consent is given, proceed to main follow-up
    // Return null to let default instructions handle it
    return null;
  }

  /**
   * Build full session-level instructions for setupOpenAI
   * This includes the complete flow sequence
   * @param {Object} params - Instruction parameters
   * @param {string} params.consentNotice - Consent notice text
   * @param {string} params.consentQuestion - Consent question text
   * @param {string} params.baseInstructions - Base instructions to append
   * @returns {string} Complete instruction string for session setup
   */
  buildSessionInstructions({
    consentNotice,
    consentQuestion,
    baseInstructions = ''
  }) {
    return `IMPORTANT: You must start every call with the following exact sequence:

1. FIRST: Ask the language preference question. Say exactly: "Hello, you're through to Universal Motorcycle Training. This is Robert. What language would you like to use today?"
2. WAIT for the caller's language preference response - DO NOT proceed until you get a clear answer
3. If the language preference is unclear or you detect noise/barge-in, repeat: "What language would you like to use today?" until you get a clear answer

4. CRITICAL: Only AFTER language preference is confirmed, you MUST ask the consent question:
   - First, say: "${consentNotice}"
   - Then immediately ask: "${consentQuestion}"
   - WAIT for the caller's response (yes, no, or silence) - DO NOT continue until they respond
   - If the caller's response is unclear, ambiguous, or you detect background noise/barge-in that prevents you from understanding their answer, IMMEDIATELY repeat the question: "${consentQuestion}" - DO NOT proceed until you receive a clear yes or no answer

5. ONLY AFTER consent is given, you may proceed to: "What would you like to do today?"

CRITICAL RULES:
- You MUST ask the language preference question FIRST before any other conversation
- You MUST ask the consent question IMMEDIATELY after language preference is confirmed
- You MUST NOT ask "What would you like to do today?" until both language preference AND consent are confirmed
- If you cannot clearly understand the caller's response (due to noise, barge-in, or unclear speech), you MUST repeat the question
- Do not assume or guess the answer - always wait for a clear response
- Both the language preference question and consent question are MANDATORY - they cannot be skipped

${baseInstructions}`;
  }
}

export default new ConsentInstructionBuilder();
