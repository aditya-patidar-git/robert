/**
 * Cancellation Step: Navigate Contacts
 * Step 4: Navigate to Contacts tab (reuses booking_step_navigate_contacts)
 */

import { BaseStepTool } from '../bookingSteps/baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class CancellationNavigateContactsStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.NAVIGATE_CONTACTS;
  }

  getRequiredPreferences() {
    return []; // No preferences required
  }
}

export default new CancellationNavigateContactsStep();
