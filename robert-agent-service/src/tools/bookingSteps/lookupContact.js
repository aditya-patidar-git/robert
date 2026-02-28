/**
 * Booking Step: Lookup Contact
 * Step 8 (Existing workflow only): Lookup existing client in booking form (mobile or email).
 * Includes retry escalation: mobile → email → name (same as Step 4).
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';
import sessionStateManager from '../../services/browser/sessionStateManager.js';

export class LookupContactStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.LOOKUP_CONTACT;
  }

  getRequiredPreferences() {
    return [];
  }

  getTimeout() {
    return 60000; // 60 seconds - lookup can take longer due to search and selection
  }

  /**
   * Override execute to wrap with lookup retry escalation.
   * On success: reset lookup retry state. On failure: increment attempt and return escalation.
   */
  async execute(parameters, callContext = {}, progressCallback = null) {
    const callSid = callContext.callSid || 'unknown';

    sessionStateManager.initializeLookupRetryState(callSid);

    const result = await super.execute(parameters, callContext, progressCallback);

    if (result.success && result.contactLookedUp !== false) {
      sessionStateManager.resetLookupRetryState(callSid);
      return result;
    }

    // Missing param (lookup was not run): do NOT increment attempt — instruct to use caller's/session value
    const err = result.error ? String(result.error) : '';
    if (result.success === false && (err.includes('requires mobile') || err.includes('None was available'))) {
      return {
        ...result,
        instruction: `CRITICAL: You must call booking_step_lookup_contact with the search key: use customerMobile if the caller gave a phone number (or from session), customerEmail if they gave an email, or customerName for a name fragment. Do NOT ask them to repeat if they already provided it. Call the tool now with that parameter from their last message or from the conversation.`
      };
    }

    const escalation = sessionStateManager.incrementLookupAttempt(callSid);

    const paramKey = escalation.nextStrategy === 'mobile' ? 'customerMobile' : escalation.nextStrategy === 'email' ? 'customerEmail' : 'customerName';

    return {
      ...result,
      lookupRetryEscalation: {
        attempt: escalation.attempt,
        nextLookupStrategy: escalation.nextStrategy,
        maxReached: escalation.maxReached,
        message: escalation.message
      },
      instruction: escalation.maxReached
        ? `CRITICAL: Maximum lookup attempts reached. ${escalation.message}`
        : `CRITICAL: Contact lookup failed. You MUST follow the retry escalation. Attempt ${escalation.attempt}: ${escalation.message} Then call booking_step_lookup_contact again with the ${paramKey} parameter.`
    };
  }
}

export default new LookupContactStep();
