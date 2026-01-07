/**
 * Booking Step: Select Session
 * Step 6 (Existing) / Step 4 (New): Navigate to Diaries and select session
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class SelectSessionStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.SELECT_SESSION;
  }

  getRequiredPreferences() {
    return []; // Session details come from sessionState or args
  }

  /**
   * Get timeout for session selection - browser automation needs more time
   * Session selection involves: navigating to Diaries, selecting date, location,
   * calendar type, finding matching entry, clicking, waiting for context menu
   * @returns {number} Timeout in milliseconds (90 seconds)
   */
  getTimeout() {
    return 90000; // 90 seconds for complex browser automation (multiple navigation steps, waiting for menus)
  }
}

export default new SelectSessionStep();

