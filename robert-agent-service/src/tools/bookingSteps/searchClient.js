/**
 * Booking Step: Search Client
 * Step 5 (Existing workflow only): Search and verify existing client
 * Includes server-side retry escalation: mobile → email → name fragment
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';
import sessionStateManager from '../../services/browser/sessionStateManager.js';

export class SearchClientStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.SEARCH_CLIENT;
  }

  getRequiredPreferences() {
    return []; // Client search uses customerMobile/customerEmail from args
  }

  /**
   * Get timeout for client search - browser automation needs more time
   * Client search involves: search execution, waiting for results, clicking row,
   * navigating to iframe, extracting client details
   * @returns {number} Timeout in milliseconds (120 seconds)
   */
  getTimeout() {
    return 120000; // 120 seconds for browser automation (search, wait, click, navigate, extract)
  }

  /**
   * Override execute to wrap parent with retry escalation tracking.
   * On search failure: increment attempt, return deterministic nextSearchStrategy.
   * On success: reset retry state.
   */
  async execute(parameters, callContext = {}, progressCallback = null) {
    const callSid = callContext.callSid || 'unknown';

    // Initialize retry state for this call
    sessionStateManager.initializeSearchRetryState(callSid);

    // Execute the parent (BaseStepTool) search
    const result = await super.execute(parameters, callContext, progressCallback);

    // If search succeeded and client was found, reset retry state
    if (result.success && result.found !== false) {
      sessionStateManager.resetSearchRetryState(callSid);
      return result;
    }

    // Search failed or client not found — escalate
    const escalation = sessionStateManager.incrementSearchAttempt(callSid);

    // Enhance the failed result with escalation guidance
    return {
      ...result,
      searchRetryEscalation: {
        attempt: escalation.attempt,
        nextSearchStrategy: escalation.nextStrategy,
        maxReached: escalation.maxReached,
        message: escalation.message
      },
      instruction: escalation.maxReached
        ? `CRITICAL: Maximum search attempts reached. ${escalation.message}`
        : `CRITICAL: Client not found. You MUST follow the retry escalation. Attempt ${escalation.attempt}: ${escalation.message} Then call booking_step_search_client again with the ${escalation.nextStrategy === 'mobile' ? 'customerMobile' : escalation.nextStrategy === 'email' ? 'customerEmail' : 'customerName'} parameter.`
    };
  }
}

export default new SearchClientStep();
