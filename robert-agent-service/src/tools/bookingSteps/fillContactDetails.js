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
}

export default new FillContactDetailsStep();

