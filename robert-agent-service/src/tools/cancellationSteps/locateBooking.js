/**
 * Cancellation Step: Locate Booking
 * Step 7: Find booking in "Bookings, credits, and debits" section and validate date
 */

import { BaseStepTool } from '../bookingSteps/baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class LocateBookingStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.LOCATE_BOOKING;
  }

  getRequiredPreferences() {
    return ['courseDate', 'courseType']; // Need course date and type to locate booking
  }

  getTimeout() {
    return 45000; // 45 seconds for scrolling, searching, and validation
  }
}

export default new LocateBookingStep();
