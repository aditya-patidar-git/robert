/**
 * Cancellation Step: Confirm Cancellation
 * Step 8: Voice-only step to confirm cancellation and explain fees
 */

import { BaseStepTool } from '../bookingSteps/baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';
import sessionStateManager from '../../services/browser/sessionStateManager.js';
import { getStepNumber } from '../../services/browser/stepConfiguration.js';
import { TERMS_DISCLAIMER } from '../../config/cancellationPhrases.js';

export class ConfirmCancellationStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.CONFIRM_CANCELLATION;
  }

  getRequiredPreferences() {
    return []; // Booking details and fees come from previous step
  }

  /**
   * Override execute to handle voice-only step
   */
  async execute(parameters, callContext = {}, progressCallback = null) {
    const callSid = callContext.callSid || 'unknown';
    const { courseType, bookingDetails, cancellationFee, refundAmount, confirmed } = parameters;

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

      // If confirmed is provided, caller has confirmed cancellation
      if (confirmed === true) {
        // Update session state
        sessionStateManager.setCurrentStep(callSid, stepNumber, { confirmed: true });
        
        return {
          success: true,
          confirmed: true,
          proceedToStep9: true,
          nextStep: 'cancellation_step_initiate_cancellation',
          nextStepNumber: 9,
          message: 'I\'ll now cancel your booking. Please bear with me a moment.'
        };
      }

      // If confirmed is false, caller declined cancellation
      if (confirmed === false) {
        return {
          success: false,
          confirmed: false,
          proceedToStep9: false,
          message: 'I understand you don\'t want to proceed with the cancellation. Is there anything else I can help you with?'
        };
      }

      // Need booking details and fees to explain cancellation policy
      if (!bookingDetails || cancellationFee === undefined) {
        return {
          success: false,
          error: 'Booking details and cancellation fee are required from previous step',
          requiresPreviousStep: 'cancellation_step_locate_booking'
        };
      }

      // No response yet - need to explain fees and ask for confirmation
      const feeMessage = cancellationFee > 0 
        ? `The cancellation fee is £${cancellationFee.toFixed(2)}. ${refundAmount > 0 ? `You will receive a refund of £${refundAmount.toFixed(2)}.` : 'No refund will be issued.'}`
        : 'No cancellation fee applies.';

      return {
        success: false,
        requiresUserInput: true,
        message: `If you wish to cancel your booking, you MUST provide a minimum of 3 full working days' notice before the start of your course. Be aware that there is a charge of 30% for administration fee. Cancellations made within less than 3 full working days will result in the entire paid fees. ${TERMS_DISCLAIMER} ${feeMessage} Would you like to proceed with the cancellation?`,
        prompt: 'Explain the cancellation policy and fees, mention the Terms URL, then ask: "Would you like to proceed with the cancellation?" If they say yes, set confirmed: true. If they say no, set confirmed: false.'
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

export default new ConfirmCancellationStep();
