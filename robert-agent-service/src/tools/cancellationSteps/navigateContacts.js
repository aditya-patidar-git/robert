/**
 * Cancellation Step: Navigate Contacts
 * Step 4: Navigate to Contacts tab (reuses booking_step_navigate_contacts)
 */

import { CancellationBaseStepTool } from './cancellationBaseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class CancellationNavigateContactsStep extends CancellationBaseStepTool {
  getStepName() {
    return STEP_NAMES.NAVIGATE_CONTACTS;
  }

  getRequiredPreferences() {
    return []; // No preferences required
  }

  getTimeout() {
    return 60000; // 60 seconds for CRM navigation
  }
}

export default new CancellationNavigateContactsStep();
