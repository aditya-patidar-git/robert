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
}

export default new SelectSessionStep();

