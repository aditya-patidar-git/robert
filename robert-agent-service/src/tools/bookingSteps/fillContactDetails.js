/**
 * Booking Step: Fill Contact Details
 * Step 8 (Existing) / Step 7 (New): Fill contact details form
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class FillContactDetailsStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.FILL_CONTACT_DETAILS;
  }

  getRequiredPreferences() {
    return []; // Contact details come from args
  }

  /**
   * Get timeout for fill contact details - browser automation needs more time
   * Fill contact details involves: navigating to contact page, filling multiple fields,
   * handling address confirmation, checking for missing fields, clicking Next button
   * @returns {number} Timeout in milliseconds (90 seconds)
   */
  getTimeout() {
    return 90000; // 90 seconds for browser automation (navigation, form filling, validation, navigation)
  }
}

export default new FillContactDetailsStep();

