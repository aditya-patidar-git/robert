/**
 * Booking Step: Send Terms
 * Step 11 (Existing) / Step 10 (New): Send Terms & Conditions email
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class SendTermsStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.SEND_TERMS;
  }

  getRequiredPreferences() {
    return []; // No preferences required
  }
}

export default new SendTermsStep();

