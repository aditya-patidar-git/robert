/**
 * Booking Step: Select Booking Options
 * Step 7 (Existing) / Step 5 (New): Select bike type and other booking options
 * This is the step where preference validation happens
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class SelectBookingOptionsStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.SELECT_BOOKING_OPTIONS;
  }

  getRequiredPreferences() {
    // Preferences are validated dynamically based on course type
    // This is handled by preferenceValidator
    return ['bikeType']; // Default - will be validated per course type
  }
}

export default new SelectBookingOptionsStep();

