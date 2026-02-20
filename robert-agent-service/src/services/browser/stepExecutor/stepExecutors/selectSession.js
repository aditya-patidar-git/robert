/**
 * Select Session Step Executor
 * Handles session selection from diaries
 * Preserves all Playwright timing and state checks
 */

import * as commonSteps from '../../../commonBookingSteps/index.js';
import sessionStateManager from '../../sessionStateManager.js';
import { conversations } from '../../../../shared/state.js';

/**
 * Execute selectSession step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
export async function executeSelectSession(page, args, sessionState, screenshotsDir, progressCallback = null) {
  progressCallback?.({ message: 'Opening the diary.' });
  // CRITICAL FIX: Try multiple sources for sessionDetails
  let sessionDetails = args.sessionDetails || sessionState?.sessionDetails;
  
  // If still not found, try retrieving from sessionStateManager
  if (!sessionDetails && args.callSid) {
    sessionDetails = sessionStateManager.getSessionDetails(args.callSid);
  }
  
  // If still not found, check conversations for lastAvailabilityCheck
  if (!sessionDetails && args.callSid) {
    const conversation = conversations[args.callSid];
    if (conversation?.lastAvailabilityCheck?.sessionDetails) {
      sessionDetails = conversation.lastAvailabilityCheck.sessionDetails;
      console.log(`✅ [selectSession] Retrieved sessionDetails from conversation.lastAvailabilityCheck`);
    } else if (conversation?.lastAvailabilityCheck?.selectedSlot) {
      sessionDetails = conversation.lastAvailabilityCheck.selectedSlot;
      console.log(`✅ [selectSession] Retrieved sessionDetails from conversation.lastAvailabilityCheck.selectedSlot`);
    }
  }
  
  if (!sessionDetails) {
    throw new Error('Session details are required to select a session. Please ensure a slot was agreed upon in Step 1 (check_availability) before proceeding to Step 6 (select_session).');
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

  // Use existing navigateToDiariesAndSelectSession logic (progressCallback gives in-between messages)
  await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, screenshotsDir, undefined, progressCallback);

  return {
    success: true,
    sessionSelected: true,
    sessionDetails
  };
}
