/**
 * Cancellation Step: Send Confirmation
 * Step 13: Send cancellation confirmation email
 */

import { BaseStepTool } from '../bookingSteps/baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class SendCancellationConfirmationStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.SEND_CANCELLATION_CONFIRMATION;
  }

  getRequiredPreferences() {
    return []; // No preferences required
  }

  getTimeout() {
    return 30000; // 30 seconds for sending email and confirmation
  }
}

export default new SendCancellationConfirmationStep();
