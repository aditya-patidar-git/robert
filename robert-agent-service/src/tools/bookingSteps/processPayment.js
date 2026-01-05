/**
 * Booking Step: Process Payment
 * Step 9 (Existing) / Step 8 (New): Process payment and complete booking
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class ProcessPaymentStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.PROCESS_PAYMENT;
  }

  getRequiredPreferences() {
    return []; // Payment details come from args
  }
}

export default new ProcessPaymentStep();

