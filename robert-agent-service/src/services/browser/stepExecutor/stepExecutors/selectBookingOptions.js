/**
 * Select Booking Options Step Executor
 * Handles booking options selection based on course type
 * Preserves all Playwright timing and state checks
 */

/**
 * Execute selectBookingOptions step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
export async function executeSelectBookingOptions(page, args, sessionState, screenshotsDir, progressCallback = null) {
  progressCallback?.({ message: 'Loading booking options.' });
  const courseType = args.courseType || sessionState?.courseType;
  
  if (!courseType) {
    throw new Error('courseType is required for selectBookingOptions');
  }
  
  // Map course type to extracted selectBookingOptions functions
  const selectBookingOptionsMap = {
    'ITM': () => import('../../../itmBooking/selectBookingOptions.js'),
    'Introduction to Motorcycling': () => import('../../../itmBooking/selectBookingOptions.js'),
    'CBT': () => import('../../../commonBookingSteps/selectBookingOptions/cbt.js'),
    'Compulsory Basic Training': () => import('../../../commonBookingSteps/selectBookingOptions/cbt.js'),
    'CBT Executive': () => import('../../../commonBookingSteps/selectBookingOptions/cbtExecutive.js'),
    'CBT Executive 1-2-1': () => import('../../../commonBookingSteps/selectBookingOptions/cbtExecutive.js'),
    'Private Lesson': () => import('../../../commonBookingSteps/selectBookingOptions/privateLesson.js'),
    'Gear Conversion': () => import('../../../commonBookingSteps/selectBookingOptions/gearConversion.js'),
    'TfL 1-2-1': () => import('../../../commonBookingSteps/selectBookingOptions/tflOneToOne.js'),
    'TfL 1-2-1 Motorcycle Skills': () => import('../../../commonBookingSteps/selectBookingOptions/tflOneToOne.js'),
    'TfL Beyond CBT': () => import('../../../commonBookingSteps/selectBookingOptions/tflBeyondCbt.js'),
    'TfL - Beyond CBT - Skills for Delivery Riders': () => import('../../../commonBookingSteps/selectBookingOptions/tflBeyondCbt.js'),
    'Full Licence Assessment': () => import('../../../commonBookingSteps/selectBookingOptions/fullLicenceAssessment.js'),
    'Full Motorcycle Licence Assessment': () => import('../../../commonBookingSteps/selectBookingOptions/fullLicenceAssessment.js')
  };
  
  const loader = selectBookingOptionsMap[courseType];
  if (!loader) {
    throw new Error(`selectBookingOptions not implemented for course type: ${courseType}`);
  }
  
  // All functions now use the same signature: (page, args, screenshotsDir)
  const module = await loader();
  const selectBookingOptionsFn = module.default || module.selectBookingOptions;
  
  if (typeof selectBookingOptionsFn !== 'function') {
    throw new Error(`Invalid selectBookingOptions export for course type: ${courseType}`);
  }
  
  const result = await selectBookingOptionsFn(page, args, screenshotsDir, progressCallback);
  progressCallback?.({ message: 'Booking options applied.' });
  return result;
}
