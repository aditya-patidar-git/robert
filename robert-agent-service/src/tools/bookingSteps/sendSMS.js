/**
 * Booking Step: Send SMS
 * Step 12 (Existing) / Step 11 (New): Send SMS confirmation
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class SendSMSStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.SEND_SMS;
  }

  getRequiredPreferences() {
    return []; // Customer mobile comes from args
  }
}

export default new SendSMSStep();

