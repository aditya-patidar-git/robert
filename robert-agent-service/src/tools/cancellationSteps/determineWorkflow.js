/**
 * Cancellation Step: Determine Workflow Type
 * Step 3: Voice-only step - always returns 'existing' for cancellation workflows
 */

import { BaseStepTool } from '../bookingSteps/baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';
import sessionStateManager from '../../services/browser/sessionStateManager.js';
import { getStepNumber } from '../../services/browser/stepConfiguration.js';

export class DetermineWorkflowStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.DETERMINE_WORKFLOW;
  }

  getRequiredPreferences() {
    return []; // No preferences required - this is a voice conversation step
  }

  /**
   * Override execute to handle voice-only step
   * Cancellation workflows always use 'existing' workflow type
   */
  async execute(parameters, callContext = {}, progressCallback = null) {
    const callSid = callContext.callSid || 'unknown';
    const { courseType, workflowType } = parameters;

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

      // Cancellation workflows always use 'existing' workflow type
      // Set workflowType in session
      sessionStateManager.setWorkflowType(callSid, 'existing');
      sessionStateManager.setCurrentStep(callSid, stepNumber, { workflowType: 'existing' });
      
      return {
        success: true,
        workflowType: 'existing',
        nextStep: 'cancellation_step_navigate_contacts',
        nextStepNumber: 4,
        message: 'I\'ll now search for your profile in our system.'
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

export default new DetermineWorkflowStep();
