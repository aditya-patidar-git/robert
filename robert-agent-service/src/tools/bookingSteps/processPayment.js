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

  /**
   * Payment processing may take longer due to payment gateway interactions
   * @returns {number} Timeout in milliseconds (120 seconds)
   */
  getTimeout() {
    return 120000; // 120 seconds for payment processing (increased from 45 seconds)
  }
}

export default new ProcessPaymentStep();

