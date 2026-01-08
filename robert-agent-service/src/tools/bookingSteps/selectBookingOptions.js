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

  /**
   * Get timeout for booking options selection - browser automation needs more time
   * Booking options selection involves: waiting for price page, finding booking form,
   * scrolling to options, selecting bike type, and clicking Next button
   * @returns {number} Timeout in milliseconds (60 seconds)
   */
  getTimeout() {
    return 60000; // 60 seconds for complex browser automation (iframe/popup detection, option selection)
  }
}

export default new SelectBookingOptionsStep();

