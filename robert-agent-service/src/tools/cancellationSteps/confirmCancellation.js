/**
 * Cancellation Step: Confirm Cancellation
 * Step 8: Voice-only step to confirm cancellation and explain fees
 */

import { CancellationBaseStepTool } from './cancellationBaseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';
import sessionStateManager from '../../services/browser/sessionStateManager.js';
import { getStepNumber } from '../../services/browser/stepConfiguration.js';
import { TERMS_DISCLAIMER, AFTER_CONFIRM_CANCEL_MESSAGE } from '../../config/cancellationPhrases.js';

export class ConfirmCancellationStep extends CancellationBaseStepTool {
  getStepName() {
    return STEP_NAMES.CONFIRM_CANCELLATION;
  }

  getRequiredPreferences() {
    return []; // Booking details and fees come from previous step
  }

  getTimeout() {
    return 60000; // 60 seconds
  }

  /**
   * Override execute to handle voice-only step
   */
  async execute(parameters, callContext = {}, progressCallback = null) {
    const callSid = callContext.callSid || 'unknown';
    let { courseType, bookingDetails, cancellationFee, refundAmount, confirmed } = parameters;

    const sessionBooking = sessionStateManager.getBookingDetails(callSid);
    if (
      (!bookingDetails || typeof bookingDetails !== 'object' || Object.keys(bookingDetails).length === 0) &&
      sessionBooking &&
      typeof sessionBooking === 'object'
    ) {
      bookingDetails = sessionBooking;
    }
    if (cancellationFee === undefined || cancellationFee === null) {
      const sessionFee = sessionStateManager.getCancellationFee(callSid);
      if (sessionFee !== undefined && sessionFee !== null) {
        cancellationFee = sessionFee;
      }
    }
    if (refundAmount === undefined || refundAmount === null) {
      const fromDetails = bookingDetails && typeof bookingDetails.refundAmount === 'number' ? bookingDetails.refundAmount : null;
      if (fromDetails != null) {
        refundAmount = fromDetails;
      }
    }
    const sessionCourseType = sessionStateManager.getSession(callSid)?.courseType;
    if (!courseType && sessionCourseType && sessionCourseType !== 'TBD') {
      courseType = sessionCourseType;
    }

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
        sessionStateManager.setCancellationCurrentStep(callSid, stepNumber, { confirmed: true });
        
        return {
          success: true,
          confirmed: true,
          proceedToStep9: true,
          nextStep: 'cancellation_step_initiate_cancellation',
          nextStepNumber: 9,
          message: AFTER_CONFIRM_CANCEL_MESSAGE
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
