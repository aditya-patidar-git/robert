/**
 * Booking Step: Lookup Contact
 * Step 7.5 (Existing workflow only): Lookup existing client contact
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class LookupContactStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.LOOKUP_CONTACT;
  }

  getRequiredPreferences() {
    return []; // No preferences required
  }

  getTimeout() {
    return 60000; // 60 seconds - lookup contact can take longer due to search and selection
  }
}

export default new LookupContactStep();
