/**
 * Cancellation Step: Navigate Communication
 * Step 11: Navigate to Communication tab
 */

import { BaseStepTool } from '../bookingSteps/baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class NavigateCommunicationStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.NAVIGATE_COMMUNICATION;
  }

  getRequiredPreferences() {
    return []; // No preferences required
  }

  getTimeout() {
    return 20000; // 20 seconds for navigation
  }
}

export default new NavigateCommunicationStep();
