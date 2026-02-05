/**
 * Cancellation Step: Send Confirmation
 * Step 13: Send cancellation confirmation email
 */

import { CancellationBaseStepTool } from './cancellationBaseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class SendCancellationConfirmationStep extends CancellationBaseStepTool {
  getStepName() {
    return STEP_NAMES.SEND_CANCELLATION_CONFIRMATION;
  }

  getRequiredPreferences() {
    return []; // No preferences required
  }

  getTimeout() {
    return 60000; // 60 seconds for sending email and confirmation
  }
}

export default new SendCancellationConfirmationStep();
