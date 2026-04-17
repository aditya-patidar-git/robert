/**
 * Select Session Step Executor
 * Handles session selection from diaries
 * Preserves all Playwright timing and state checks
 */

import * as commonSteps from '../../../commonBookingSteps/index.js';
import { matchSlotToAvailableSlots, rehydrateSessionDetailsFromLastAvailability } from '../../../commonBookingSteps/slotStorageUtils.js';
import sessionStateManager from '../../sessionStateManager.js';
import { conversations } from '../../../../shared/state.js';

const DDMMYYYY_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Returns true if sessionDetails has a date we can use for the Diaries calendar (startDate or date in DD/MM/YYYY).
 * @param {Object} sd - Session details object
 * @returns {boolean}
 */
function hasValidDateForDiaries(sd) {
  if (!sd) return false;
  if (sd.startDate) {
    const d = new Date(sd.startDate);
    if (!isNaN(d.getTime())) return true;
    if (DDMMYYYY_REGEX.test(String(sd.startDate).trim())) return true;
  }
  if (sd.date && DDMMYYYY_REGEX.test(String(sd.date).trim())) return true;
  return false;
}

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

  // Single-slot or already-persisted recovery: agreedSlot may never have been passed to authenticate
  if (!sessionDetails && args.callSid) {
    const recovered = rehydrateSessionDetailsFromLastAvailability(args.callSid);
    if (recovered) {
      sessionDetails = recovered;
      console.log(`✅ [selectSession] Resolved sessionDetails via rehydrateSessionDetailsFromLastAvailability`);
    }
  }

  if (!sessionDetails) {
    throw new Error(
      'Session details are required to select a session. If multiple slots were offered, the caller must confirm one (then pass agreedSlot on authenticate or sessionDetails here). If one slot was offered, call booking_step_authenticate with agreedSlot from that result.'
    );
  }

  // NORMALIZE FOR DIARIES: If agent passed sessionDetails without a machine-usable date (e.g. date: "Thu 12th", no startDate),
  // prefer stored slot or match from allSlots so the Diaries tab gets startDate or DD/MM/YYYY.
  if (!hasValidDateForDiaries(sessionDetails) && args.callSid) {
    const conversation = conversations[args.callSid];
    const allSlots = conversation?.lastAvailabilityCheck?.allSlots;

    if (allSlots && Array.isArray(allSlots) && allSlots.length > 0) {
      const matchedSlot = matchSlotToAvailableSlots(sessionDetails, allSlots);
      if (matchedSlot) {
        // Keep agent's preferences (time, location) but use matched slot's startDate/date
        sessionDetails = { ...matchedSlot, ...sessionDetails };
        sessionDetails.startDate = matchedSlot.startDate || sessionDetails.startDate;
        if (matchedSlot.date) sessionDetails.date = matchedSlot.date;
        console.log(`✅ [selectSession] Matched agent slot to allSlots; using startDate/date for Diaries`);
      }
    }

    if (!hasValidDateForDiaries(sessionDetails)) {
      const storedSlot = conversation?.lastAvailabilityCheck?.sessionDetails
        || conversation?.lastAvailabilityCheck?.selectedSlot
        || sessionStateManager.getSessionDetails(args.callSid);
      if (storedSlot && (storedSlot.startDate || (storedSlot.date && DDMMYYYY_REGEX.test(String(storedSlot.date).trim())))) {
        sessionDetails = { ...storedSlot, ...sessionDetails };
        if (storedSlot.startDate) sessionDetails.startDate = storedSlot.startDate;
        if (storedSlot.date && DDMMYYYY_REGEX.test(String(storedSlot.date).trim())) sessionDetails.date = storedSlot.date;
        console.log(`✅ [selectSession] Merged stored slot date into sessionDetails for Diaries`);
      }
    }
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

  // TfL courses use the "TfL Diary" calendar type, not the default "Day planner"
  const TFL_COURSES = ['TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT', 'TfL - Beyond CBT - Skills for Delivery Riders'];
  const diaryType = TFL_COURSES.some(c =>
    courseType && courseType.toLowerCase().includes(c.toLowerCase().split(' ')[0]) && courseType.toLowerCase().includes('tfl')
  ) ? 'TfL Diary' : undefined;
  if (diaryType) {
    console.log(`📋 [selectSession] Using diary type: ${diaryType} for course: ${courseType}`);
  }

  await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, screenshotsDir, diaryType, progressCallback);

  return {
    success: true,
    sessionSelected: true,
    sessionDetails
  };
}
