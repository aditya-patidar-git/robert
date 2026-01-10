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

  /**
   * Get timeout for client search - browser automation needs more time
   * Client search involves: search execution, waiting for results, clicking row,
   * navigating to iframe, extracting client details
   * @returns {number} Timeout in milliseconds (60 seconds)
   */
  getTimeout() {
    return 60000; // 60 seconds for browser automation (search, wait, click, navigate, extract)
  }
}

export default new SearchClientStep();

