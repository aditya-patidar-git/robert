/**
 * Booking Step: Check Availability
 * Step 1: Check availability for a course type
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class CheckAvailabilityStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.CHECK_AVAILABILITY;
  }

  getRequiredPreferences() {
    return []; // No preferences required for availability check
  }
}

export default new CheckAvailabilityStep();

