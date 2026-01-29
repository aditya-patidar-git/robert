/**
 * Cancellation Step: Verify Booking Intent
 * Step 1: Voice-only step to verify caller has a booking and explain cancellation policy
 */

import { CancellationBaseStepTool } from './cancellationBaseStepTool.js';
import { STEP_NAMES, getStepNumber } from '../../services/browser/stepConfiguration.js';
import sessionStateManager from '../../services/browser/sessionStateManager.js';
import { PROCEED_DECLINED_MESSAGE, TERMS_DISCLAIMER } from '../../config/cancellationPhrases.js';

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

      // Validate required parameters
      if (!courseType) {
        return {
          success: false,
          error: 'courseType is required'
        };
      }

      // Initialize session
      const session = sessionStateManager.initializeSession(callSid, courseType);
      
      // Get step number from configuration
      const stepName = this.getStepName();
      const stepNumber = getStepNumber(courseType, 'existing', stepName);
      
      if (stepNumber === null) {
        return {
          success: false,
          error: `Step "${stepName}" is not valid for course type "${courseType}"`
        };
      }

      // If verified is provided, caller has confirmed they have a booking
      if (verified === true && proceedToStep2 === true) {
        // Update session state
        sessionStateManager.setCurrentStep(callSid, stepNumber, { verified: true });
        
        return {
          success: true,
          verified: true,
          proceedToStep2: true,
          nextStep: 'cancellation_step_authenticate',
          nextStepNumber: 2,
          message: 'I\'ll now login to the system to find your profile. Please bear with me a moment.'
        };
      }

      // Caller has a booking but declined to proceed
      if (verified === true && proceedToStep2 === false) {
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
