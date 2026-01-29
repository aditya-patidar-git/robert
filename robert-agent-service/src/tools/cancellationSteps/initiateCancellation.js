/**
 * Cancellation Step: Initiate Cancellation
 * Step 9: Click booking row → "Cancel booking" from context menu
 */

import { CancellationBaseStepTool } from './cancellationBaseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class InitiateCancellationStep extends CancellationBaseStepTool {
  getStepName() {
    return STEP_NAMES.INITIATE_CANCELLATION;
  }

  getRequiredPreferences() {
    return ['courseDate']; // Need course date to locate booking row
  }

  getTimeout() {
    return 60000; // 60 seconds for clicking and opening context menu
  }
}

export default new InitiateCancellationStep();
