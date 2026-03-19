/**
 * Consent Instruction Builder Service
 * 
 * Builds consent flow instructions based on conversation state.
 * Single responsibility: Generate instructions for the consent flow sequence.
 * 
 * Flow sequence:
 * 1. Language preference question (greeting) - FIRST
 * 2. Consent question - AFTER language is selected
 * 3. "What would you like to do today?" (main follow-up) - AFTER consent is given OR declined
 */

class ConsentInstructionBuilder {
  /**
   * Build consent flow instructions based on current state
   * @param {Object} params - Instruction parameters
   * @param {string} params.consentNotice - Consent notice text
   * @param {string} params.consentQuestion - Consent question text
   * @param {boolean} params.languageSelected - Whether language has been selected
   * @param {boolean} params.consentGiven - Whether consent has been given
   * @param {boolean} params.consentResponded - Whether caller has answered the consent question (yes or no); if true, flow proceeds either way
   * @param {boolean} params.requireExplicitConsent - Whether explicit consent is required
   * @param {string} params.baseInstructions - Base instructions to append
   * @returns {string|null} Complete instruction string or null if not needed
   */
  buildConsentFlowInstructions({
    consentNotice,
    consentQuestion,
    mainFollowUpQuestion = 'What would you like to do today?',
    languageSelected = false,
    consentGiven = false,
    consentResponded = false,
    requireExplicitConsent = true,
    baseInstructions = ''
  }) {
    if (!requireExplicitConsent || consentResponded) {
      // Consent not required or caller has already responded (given or declined) - return null to use default flow
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
- DO NOT ask the consent question or the main follow-up question until language preference is confirmed
- If you cannot clearly understand the caller's response (due to noise, barge-in, or unclear speech), you MUST repeat the question
- Do not assume or guess the answer - always wait for a clear response
- The language preference question is MANDATORY - it cannot be skipped

${baseInstructions}`;
    } else {
      // Phase 2: Consent question - AFTER language is selected, waiting for caller to respond (yes or no)
      return `IMPORTANT: You must now ask the consent question. Follow this exact sequence:

1. First, say: "${consentNotice}"
2. For the consent question, say exactly and only: "${consentQuestion}" - do not add a greeting (e.g. no "Hi") and do not repeat the question in the same turn.
3. WAIT for the caller's response (yes, no, or silence) - DO NOT continue until they respond
4. If the caller's response is unclear, ambiguous, or you detect background noise/barge-in, repeat the question once only, saying exactly: "${consentQuestion}"

CRITICAL RULES:
- You MUST ask the consent question NOW before proceeding with any other conversation
- Say exactly and only "${consentQuestion}" - no greeting, no repetition in the same turn
- When you hear a CLEAR yes or no from the caller (in any language, e.g. yes, no, ओके यस, हाँ, नहीं, oui, non), you MUST call the recording_consent_response tool with given: true for yes or given: false for no, then you may say the main follow-up. Do NOT say "${mainFollowUpQuestion}" until you have called recording_consent_response with the caller's clear answer.
- If the response is unclear (e.g. "what?", "repeat", "I'll answer later"), do NOT call the tool—repeat only: "${consentQuestion}"
- Do not assume or guess the answer - always wait for a clear response before calling recording_consent_response

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
    mainFollowUpQuestion = 'What would you like to do today?',
    baseInstructions = ''
  }) {
    return `IMPORTANT: You must start every call with the following exact sequence:

1. FIRST: Ask the language preference question. Say exactly: "Hello, you're through to Universal Motorcycle Training. This is Robert. What language would you like to use today?"
2. WAIT for the caller's language preference response - DO NOT proceed until you get a clear answer
3. If the language preference is unclear or you detect noise/barge-in, repeat: "What language would you like to use today?" until you get a clear answer

4. CRITICAL: Only AFTER language preference is confirmed, you MUST ask the consent question:
   - First, say: "${consentNotice}"
   - For the consent question, say exactly and only: "${consentQuestion}" - do not add a greeting or repeat the question in the same turn
   - WAIT for the caller's response (yes, no, or silence). When you hear a CLEAR yes or no (in any language), you MUST call the recording_consent_response tool with given: true or given: false, then you may proceed to "${mainFollowUpQuestion}". If the response is unclear, repeat the question only; do NOT call the tool.

5. AFTER you have called recording_consent_response with the caller's clear answer, you may say: "${mainFollowUpQuestion}". If they declined, acknowledge briefly (e.g. that the call will not be recorded) and then continue with "${mainFollowUpQuestion}"

CRITICAL RULES:
- You MUST ask the language preference question FIRST before any other conversation
- You MUST ask the consent question IMMEDIATELY after language preference is confirmed
- You MUST call recording_consent_response (given: true or given: false) when you hear a clear yes or no from the caller, in any language. Do NOT say "${mainFollowUpQuestion}" until you have called this tool. If the response is unclear, repeat the consent question; do not call the tool
- If you cannot clearly understand the caller's response (due to noise, barge-in, or unclear speech), you MUST repeat the question
- Do not assume or guess the answer - always wait for a clear response
- Both the language preference question and consent question are MANDATORY - they cannot be skipped

${baseInstructions}`;
  }
}

export default new ConsentInstructionBuilder();
