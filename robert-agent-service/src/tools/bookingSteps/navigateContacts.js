/**
 * Booking Step: Navigate Contacts
 * Step 4 (Existing workflow only): Navigate to Contacts tab
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class NavigateContactsStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.NAVIGATE_CONTACTS;
  }

  getRequiredPreferences() {
    return []; // No preferences required
  }
}

export default new NavigateContactsStep();

