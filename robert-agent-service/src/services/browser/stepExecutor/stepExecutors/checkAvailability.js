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
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
export async function executeCheckAvailability(page, args, sessionState, screenshotsDir, progressCallback = null) {
  progressCallback?.({ message: 'Checking availability for you.' });
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
    preferences,
    progressCallback
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

  const slotsToAnnounce = result.slotsToAnnounce ?? [];
  const slotsSummary = slotsToAnnounce.length > 0
    ? slotsToAnnounce.map(s => `${s.date} at ${s.time}, ${s.location}, ${s.price}`).join('; ')
    : (result.selectedSlot ? `${result.selectedSlot.date} at ${result.selectedSlot.time}, ${result.selectedSlot.location}, ${result.selectedSlot.price}` : 'No slots');

  return {
    success: true,
    stepCompleted: 1,
    stepName: 'check_availability',
    nextStep: 'booking_step_authenticate',
    nextStepNumber: 2,
    doNotRetry: true,
    message: `✅ STEP 1 COMPLETE. DO NOT RETRY. Present ONLY these slot(s) to the caller and confirm their selection. Do not read out any other slots. Slots to present: ${slotsSummary}. Once a slot is agreed, call booking_step_authenticate.`,
    allSlots: result.allSlots,
    selectedSlot: result.selectedSlot,
    slotsToAnnounce,
    monthYear: result.monthYear,
    sessionDetails: sessionDetails || null
  };
}
