/**
 * Cancellation Step: Initiate Cancellation
 * Step 9: Click booking row → "Cancel booking" from context menu
 */

import { BaseStepTool } from '../bookingSteps/baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class InitiateCancellationStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.INITIATE_CANCELLATION;
  }

  getRequiredPreferences() {
    return ['courseDate']; // Need course date to locate booking row
  }

  getTimeout() {
    return 30000; // 30 seconds for clicking and opening context menu
  }
}

export default new InitiateCancellationStep();
