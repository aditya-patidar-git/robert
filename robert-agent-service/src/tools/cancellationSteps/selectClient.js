/**
 * Cancellation Step: Select Client
 * Step 6: Click verified client name to open profile
 */

import { CancellationBaseStepTool } from './cancellationBaseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class SelectClientStep extends CancellationBaseStepTool {
  getStepName() {
    return STEP_NAMES.SELECT_CLIENT;
  }

  getRequiredPreferences() {
    return []; // Client name comes from previous step
  }

  getTimeout() {
    return 60000; // 60 seconds for clicking and navigating to profile
  }
}

export default new SelectClientStep();
