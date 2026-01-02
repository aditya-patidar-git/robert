/**
 * Booking Step: Send Confirmation
 * Step 10 (Existing) / Step 9 (New): Send booking confirmation email
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class SendConfirmationStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.SEND_CONFIRMATION;
  }

  getRequiredPreferences() {
    return []; // No preferences required
  }
}

export default new SendConfirmationStep();

