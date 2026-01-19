/**
 * Check Availability Step Executor
 * Handles availability checking and slot selection
 * Preserves all Playwright timing and state checks
 */

import * as commonSteps from '../../../commonBookingSteps/index.js';

/**
 * Execute checkAvailability step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<Object>} Step execution result
 */
export async function executeCheckAvailability(page, args, sessionState, screenshotsDir) {
  const courseType = args.courseType || sessionState?.courseType;
  
  // Use existing checkAvailabilityAndNoteDetails logic
  const preferences = {
    preferredDate: args.preferredDate,
    preferredTime: args.preferredTime,
    location: args.location,
    instructor: args.instructor
  };
  
  const result = await commonSteps.checkAvailabilityAndNoteDetails(
    page, 
    courseType, 
    screenshotsDir, 
    preferences
  );

  // CRITICAL FIX: Ensure selectedSlot includes course name
  let sessionDetails = result.selectedSlot;
  if (sessionDetails && !sessionDetails.course) {
    // Map courseType to actual course name
    if (courseType === 'Introduction to Motorcycling' || courseType === 'ITM') {
      sessionDetails.course = 'Introduction to Motorcycling';
    } else {
      sessionDetails.course = courseType;
    }
  }

  // Wrap result with success flag and sessionDetails
  // This ensures currentStep gets set to 1 and sessionDetails is available for next steps
  return {
    success: true,
    allSlots: result.allSlots,
    selectedSlot: result.selectedSlot,
    monthYear: result.monthYear,
    // If a slot was selected, include it as sessionDetails for next steps
    sessionDetails: sessionDetails || null
  };
}
