/**
 * Booking Step: Search Client
 * Step 5 (Existing workflow only): Search and verify existing client
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class SearchClientStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.SEARCH_CLIENT;
  }

  getRequiredPreferences() {
    return []; // Client search uses customerMobile/customerEmail from args
  }
}

export default new SearchClientStep();

