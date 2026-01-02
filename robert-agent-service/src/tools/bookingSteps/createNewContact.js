/**
 * Booking Step: Create New Contact
 * Step 6 (New workflow only): Click "New contact" button
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class CreateNewContactStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.CREATE_NEW_CONTACT;
  }

  getRequiredPreferences() {
    return []; // No preferences required
  }
}

export default new CreateNewContactStep();

