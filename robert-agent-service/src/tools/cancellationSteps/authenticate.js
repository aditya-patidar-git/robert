/**
 * Cancellation Step: Authenticate
 * Step 2: Login to CRM (reuses booking_step_authenticate)
 */

import { BaseStepTool } from '../bookingSteps/baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class CancellationAuthenticateStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.AUTHENTICATE;
  }

  getRequiredPreferences() {
    return []; // No preferences required for authentication
  }
}

export default new CancellationAuthenticateStep();
