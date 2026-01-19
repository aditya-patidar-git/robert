/**
 * Select Session Step Executor
 * Handles session selection from diaries
 * Preserves all Playwright timing and state checks
 */

import * as commonSteps from '../../../commonBookingSteps/index.js';

/**
 * Execute selectSession step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<Object>} Step execution result
 */
export async function executeSelectSession(page, args, sessionState, screenshotsDir) {
  const sessionDetails = args.sessionDetails || sessionState.sessionDetails;
  
  if (!sessionDetails) {
    throw new Error('Session details are required to select a session');
  }

  // CRITICAL FIX: Ensure course and instructor are included in sessionDetails
  // If they're missing, try to get them from the courseType or sessionState
  const courseType = args.courseType || sessionState?.courseType;
  
  // Map courseType to actual course name for ITM
  if (!sessionDetails.course && courseType) {
    if (courseType === 'Introduction to Motorcycling' || courseType === 'ITM') {
      sessionDetails.course = 'Introduction to Motorcycling';
    } else {
      // For other courses, use the courseType as the course name
      sessionDetails.course = courseType;
    }
  }
  
  // If instructor is missing but was provided in preferences, use it
  if (!sessionDetails.instructor && sessionState?.preferences?.instructor) {
    sessionDetails.instructor = sessionState.preferences.instructor;
  }
  
  // If instructor is still missing, set to empty string (will match any instructor)
  if (!sessionDetails.instructor) {
    sessionDetails.instructor = '';
  }

  // Use existing navigateToDiariesAndSelectSession logic
  await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, screenshotsDir);

  return {
    success: true,
    sessionSelected: true,
    sessionDetails
  };
}
