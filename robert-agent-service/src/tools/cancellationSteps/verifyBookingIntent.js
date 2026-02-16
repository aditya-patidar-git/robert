/**
 * Cancellation Step: Verify Booking Intent
 * Step 1: Voice-only step to verify caller has a booking and explain cancellation policy
 */

import { CancellationBaseStepTool } from './cancellationBaseStepTool.js';
import { STEP_NAMES, getStepNumber } from '../../services/browser/stepConfiguration.js';
import sessionStateManager from '../../services/browser/sessionStateManager.js';
import { PROCEED_DECLINED_MESSAGE, TERMS_DISCLAIMER, AFTER_LOGIN_MESSAGE, ASK_COURSE_TYPE_MESSAGE } from '../../config/cancellationPhrases.js';

/** Valid courseType values for cancellation (must be collected before policy and before Step 2). */
const VALID_CANCELLATION_COURSE_TYPES = new Set([
  'ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training',
  'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion'
]);

function isValidCourseType(value) {
  return value && VALID_CANCELLATION_COURSE_TYPES.has(value);
}

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

      const stepName = this.getStepName();
      const lookupCourseType = courseType && isValidCourseType(courseType) ? courseType : 'CBT';
      const stepNumber = getStepNumber(lookupCourseType, 'existing', stepName);

      if (stepNumber === null) {
        return {
          success: false,
          error: `Step "${stepName}" is not valid`
        };
      }

      // Proceed to Step 2 (authenticate): require valid courseType; never use TBD
      if (verified === true && proceedToStep2 === true) {
        if (!isValidCourseType(courseType)) {
          return {
            success: false,
            requiresUserInput: true,
            message: ASK_COURSE_TYPE_MESSAGE,
            prompt: 'Course type is required before proceeding to Step 2. Ask the caller: "What type of course is your booking for? For example, CBT, Introduction to Motorcycling, Private Lesson, or Gear Conversion." Then call this tool with verified: true, proceedToStep2: true, and courseType set to their answer.'
          };
        }
        const session = sessionStateManager.initializeSession(callSid, courseType);
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

      // Caller has booking but declines to proceed
      if (verified === true && proceedToStep2 === false) {
        const sessionCourseType = courseType && isValidCourseType(courseType) ? courseType : 'CBT';
        sessionStateManager.initializeSession(callSid, sessionCourseType);
        sessionStateManager.setCancellationCurrentStep(callSid, stepNumber, { verified: true });
        return {
          success: false,
          verified: true,
          proceedToStep2: false,
          message: PROCEED_DECLINED_MESSAGE
        };
      }

      // Caller confirmed they have a booking but we don't have courseType yet: ask for course type ONLY (before policy)
      if (verified === true && (proceedToStep2 === false || proceedToStep2 === undefined)) {
        if (!isValidCourseType(courseType)) {
          return {
            success: false,
            requiresUserInput: true,
            message: ASK_COURSE_TYPE_MESSAGE,
            prompt: `STRICT: Ask the caller ONLY: "${ASK_COURSE_TYPE_MESSAGE}" Do NOT explain the cancellation policy yet. Once they give the course type (e.g. CBT, Introduction to Motorcycling, Private Lesson, Gear Conversion), call this tool with verified: true and courseType set to that value. Then in your next response you will explain the policy and ask "Would you like to proceed?"`
          };
        }
        // We have courseType; now ask for proceed (explain policy and "Would you like to proceed?")
        const session = sessionStateManager.initializeSession(callSid, courseType);
        sessionStateManager.setCancellationCurrentStep(callSid, stepNumber, { verified: true });
        return {
          success: false,
          requiresUserInput: true,
          verified: true,
          message: `If you wish to cancel your booking you MUST provide a minimum of 3 full working days' notice before the start of your course. There is a 30% administration fee. Cancellations within 3 full working days will result in the entire fee being non-refundable. ${TERMS_DISCLAIMER} Would you like to proceed?`,
          prompt: `Explain the cancellation policy (3 full working days' notice, 30% admin fee, full fee if less than 3 days) and say: "${TERMS_DISCLAIMER}" Then ask: "Would you like to proceed?" If they say yes, call with verified: true, proceedToStep2: true, courseType: "${courseType}". If they say no, call with verified: true, proceedToStep2: false, courseType: "${courseType}".`
        };
      }

      // Caller does not have a booking
      if (verified === false) {
        return {
          success: false,
          verified: false,
          proceedToStep2: false,
          message: 'I understand you don\'t have a current booking. How can I help you today?'
        };
      }

      // First question: do you have a current booking?
      return {
        success: false,
        requiresUserInput: true,
        message: 'Do you have a current booking with us?',
        prompt: `Ask the caller: "Do you have a current booking with us?" If they say yes, do NOT explain the policy yet. Instead ask for course type: "${ASK_COURSE_TYPE_MESSAGE}" Once they give the course type, call this tool with verified: true and courseType set to their answer (e.g. "Introduction to Motorcycling", "CBT", "Private Lesson", "Gear Conversion"). If they say no, call with verified: false.`
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
