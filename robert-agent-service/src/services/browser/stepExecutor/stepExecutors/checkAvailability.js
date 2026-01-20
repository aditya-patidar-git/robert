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
    stepCompleted: 1, // Explicitly state which step is complete
    stepName: 'check_availability', // Explicit step name
    nextStep: 'booking_step_authenticate', // Explicitly state next step tool to call
    nextStepNumber: 2, // Explicitly state next step number (authenticate is Step 2 for all courses)
    doNotRetry: true, // Explicitly prevent retry
    message: `✅ STEP 1 COMPLETE: booking_step_check_availability has been successfully completed. Availability checked and slots retrieved. DO NOT RETRY THIS STEP. Present the available slots to the caller and confirm their selection. Once a slot is agreed upon, proceed to STEP 2 by calling booking_step_authenticate tool.`,
    allSlots: result.allSlots,
    selectedSlot: result.selectedSlot,
    monthYear: result.monthYear,
    // If a slot was selected, include it as sessionDetails for next steps
    sessionDetails: sessionDetails || null
  };
}
