/**
 * Cancellation Step: Select Client
 * Step 6: Click verified client name to open profile
 */

import { BaseStepTool } from '../bookingSteps/baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class SelectClientStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.SELECT_CLIENT;
  }

  getRequiredPreferences() {
    return []; // Client name comes from previous step
  }

  getTimeout() {
    return 30000; // 30 seconds for clicking and navigating to profile
  }
}

export default new SelectClientStep();
