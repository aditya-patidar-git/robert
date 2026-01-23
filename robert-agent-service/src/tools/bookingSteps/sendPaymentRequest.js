/**
 * Booking Step: Send Payment Request
 * Step 9 (Existing) / Step 8 (New): Send payment request via email or SMS
 * This step is an alternative to PROCESS_PAYMENT when using payment request flow
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class SendPaymentRequestStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.SEND_PAYMENT_REQUEST;
  }

  getRequiredPreferences() {
    return []; // No preferences needed
  }

  /**
   * Get timeout for payment request - needs extra time for polling (10 minutes + overhead)
   * Payment request involves: opening modal, filling email/mobile, clicking send,
   * polling every 30 seconds for up to 10 minutes, and clicking "Make booking" button
   * @returns {number} Timeout in milliseconds (900000ms = 15 minutes)
   */
  getTimeout() {
    return 900000; // 15 minutes to account for 10-minute polling + overhead
  }
}

export default new SendPaymentRequestStep();

