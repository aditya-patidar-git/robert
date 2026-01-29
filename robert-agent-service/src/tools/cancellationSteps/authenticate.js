/**
 * Cancellation Step: Authenticate
 * Step 2: Login to CRM (reuses booking_step_authenticate)
 */

import { CancellationBaseStepTool } from './cancellationBaseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class CancellationAuthenticateStep extends CancellationBaseStepTool {
  getStepName() {
    return STEP_NAMES.AUTHENTICATE;
  }

  getRequiredPreferences() {
    return []; // No preferences required for authentication
  }

  getTimeout() {
    return 60000; // 60 seconds for CRM login
  }
}

export default new CancellationAuthenticateStep();
