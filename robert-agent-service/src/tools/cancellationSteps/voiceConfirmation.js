/**
 * Cancellation Step: Voice Confirmation
 * Step 14: Voice-only step to confirm cancellation completion
 */

import { CancellationBaseStepTool } from './cancellationBaseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';
import sessionStateManager from '../../services/browser/sessionStateManager.js';
import { getStepNumber } from '../../services/browser/stepConfiguration.js';
import { GOODBYE_CANCELLATION } from '../../config/cancellationPhrases.js';

export class VoiceConfirmationStep extends CancellationBaseStepTool {
  getStepName() {
    return STEP_NAMES.VOICE_CONFIRMATION;
  }

  getRequiredPreferences() {
    return []; // No preferences required - this is a voice conversation step
  }

  getTimeout() {
    return 60000; // 60 seconds
  }

  /**
   * Override execute to handle voice-only step
   */
  async execute(parameters, callContext = {}, progressCallback = null) {
    const callSid = callContext.callSid || 'unknown';
    const { courseType } = parameters;

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

      // Update session state - cancellation complete
      sessionStateManager.setCancellationCurrentStep(callSid, stepNumber, { cancellationComplete: true });
      
      return {
        success: true,
        cancellationComplete: true,
        message: 'Your booking has now been cancelled, and I have now sent you an email confirmation. Is there anything else that I can help you with?',
        goodbyeMessage: GOODBYE_CANCELLATION,
        prompt: `Say to the caller: "Your booking has now been cancelled, and I have now sent you an email confirmation. Is there anything else that I can help you with?" If they say "No", say exactly: "${GOODBYE_CANCELLATION}" If they say "Yes", assist with additional queries.`
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

export default new VoiceConfirmationStep();
