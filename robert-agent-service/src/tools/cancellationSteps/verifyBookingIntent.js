/**
 * Cancellation Step: Verify Booking Intent
 * Step 1: Voice-only step to verify caller has a booking and explain cancellation policy
 */

import { CancellationBaseStepTool } from './cancellationBaseStepTool.js';
import { STEP_NAMES, getStepNumber } from '../../services/browser/stepConfiguration.js';
import sessionStateManager from '../../services/browser/sessionStateManager.js';
import { PROCEED_DECLINED_MESSAGE, TERMS_DISCLAIMER, AFTER_LOGIN_MESSAGE } from '../../config/cancellationPhrases.js';

export class VerifyBookingIntentStep extends CancellationBaseStepTool {
  getStepName() {
    return STEP_NAMES.VERIFY_BOOKING_INTENT;
  }

  getRequiredPreferences() {
    return []; // No preferences required - this is a voice conversation step
  }

  getTimeout() {
    return 60000; // 60 seconds
  }

  /**
   * Override execute to handle voice-only step
   * This step doesn't use Playwright - it's handled conversationally
   */
  async execute(parameters, callContext = {}, progressCallback = null) {
    const callSid = callContext.callSid || 'unknown';
    const { courseType, verified, proceedToStep2 } = parameters;

    try {
      console.log(`🔧 [${this.getStepName()}] Executing voice step for ${callSid}`);

      // courseType is optional initially - will be determined from booking in Step 6 (locateBooking)
      // Initialize session with courseType if provided, otherwise use a placeholder
      // The actual courseType will be set when booking is located
      const sessionCourseType = courseType || 'TBD'; // TBD = To Be Determined
      const session = sessionStateManager.initializeSession(callSid, sessionCourseType);
      
      // Get step number from configuration
      // For cancellation, step numbers are the same for all course types, so use a default
      const stepName = this.getStepName();
      // Use 'CBT' as default for step number lookup (all cancellation steps have same numbers)
      const lookupCourseType = courseType || 'CBT';
      const stepNumber = getStepNumber(lookupCourseType, 'existing', stepName);
      
      if (stepNumber === null) {
        return {
          success: false,
          error: `Step "${stepName}" is not valid`
        };
      }

      if (verified === true && proceedToStep2 === true) {
        sessionStateManager.setCancellationCurrentStep(callSid, stepNumber, { verified: true });
        return {
          success: true,
          verified: true,
          proceedToStep2: true,
          nextStep: 'cancellation_step_authenticate',
          nextStepNumber: 2,
          message: AFTER_LOGIN_MESSAGE
        };
      }

      if (verified === true && proceedToStep2 === false) {
        sessionStateManager.setCancellationCurrentStep(callSid, stepNumber, { verified: true });
        return {
          success: false,
          verified: true,
          proceedToStep2: false,
          message: PROCEED_DECLINED_MESSAGE
        };
      }

      // If verified is false, caller doesn't have a booking
      if (verified === false) {
        return {
          success: false,
          verified: false,
          proceedToStep2: false,
          message: 'I understand you don\'t have a current booking. How can I help you today?'
        };
      }

      // No response yet - need to ask the caller
      return {
        success: false,
        requiresUserInput: true,
        message: 'Do you have a current booking with us?',
        prompt: `Please ask the caller: "Do you have a current booking with us?" If they say yes, explain the cancellation policy and say: "${TERMS_DISCLAIMER}" Then ask: "Would you like to proceed?" If they say yes, set verified: true, proceedToStep2: true. If they say no to proceed, set verified: true, proceedToStep2: false. If they say no to having a booking, set verified: false.`
      };

    } catch (error) {
      console.error(`❌ [${this.getStepName()}] Error:`, error);
      return {
        success: false,
        error: error.message,
        stepName: this.getStepName()
      };
    }
  }
}

export default new VerifyBookingIntentStep();
