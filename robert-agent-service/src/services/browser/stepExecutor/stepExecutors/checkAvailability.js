/**
 * Check Availability Step Executor
 * Handles availability checking and slot selection
 * Preserves all Playwright timing and state checks
 */

import * as commonSteps from '../../../commonBookingSteps/index.js';
import { resolveAvailabilityDateIntent } from '../../../commonBookingSteps/availabilityDateIntent.js';
import { conversations } from '../../../../shared/state.js';

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
  // No progress/ack during availability check: prevents agent from speaking before tool returns and suggesting imaginary slots
  const courseType = args.courseType || sessionState?.courseType;
  const callSid = args.callSid;
  const lastCheck = callSid && conversations[callSid]?.lastAvailabilityCheck
    ? conversations[callSid].lastAvailabilityCheck
    : null;

  const dateIntent = resolveAvailabilityDateIntent({
    preferredDate: args.preferredDate,
    now: new Date(),
    lastCheck
  });

  const preferences = {
    preferredDate: args.preferredDate,
    preferredTime: args.preferredTime,
    location: args.location,
    instructor: args.instructor,
    _availabilityDateIntent: dateIntent
  };
  if (dateIntent.type === 'range' && dateIntent.startISO === dateIntent.endISO) {
    preferences._preferredDateScanYMD = dateIntent.startISO;
  }

  const result = await commonSteps.checkAvailabilityAndNoteDetails(
    page,
    courseType,
    screenshotsDir,
    preferences,
    null
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
  const slotCount = slotsToAnnounce.length;
  const requiresExplicitSlotChoice = slotCount > 1;

  // Short location name for voice — city/centre only, no full postal address.
  const POSTCODE_TO_CENTRE = {
    RM9: 'Dagenham', EN11: 'Hoddesdon', HA0: 'Alperton',
    CR0: 'Croydon', HA8: 'Edgware', SE3: 'Eltham', KT3: 'Wimbledon',
  };
  const _shortLocation = (loc) => {
    const id = commonSteps.extractLocationIdentifier(loc || '');
    if (!id) return loc || 'Unknown';
    return POSTCODE_TO_CENTRE[String(id).toUpperCase()] || id;
  };

  // Concise voice-friendly format: "Mon 20th at 07:00, Hoddesdon, £125.00"
  // Full address, instructor and other details remain available in slotsToAnnounce
  // objects for the model to share on request.
  const formatSlot = (s) =>
    `${s.date} at ${s.time}, ${_shortLocation(s.location)}, ${s.price}`;

  // Tool message must list EVERY slot the filter produced (slotCount), not only selectedSlot.
  const slotsSummary =
    slotsToAnnounce.length > 0
      ? slotsToAnnounce.map(formatSlot).join('; ')
      : result.selectedSlot
        ? formatSlot(result.selectedSlot)
        : 'No slots';

  let availabilityCheckRevision = 1;
  if (callSid) {
    if (!conversations[callSid]) conversations[callSid] = {};
    availabilityCheckRevision = (conversations[callSid].availabilityCheckRevision ?? 0) + 1;
    conversations[callSid].availabilityCheckRevision = availabilityCheckRevision;
  }

  const revisionPreamble = `AVAILABILITY_REVISION ${availabilityCheckRevision} (AUTHORITATIVE for this call). Ignore every earlier booking_step_check_availability result and any slot list you already read aloud—only this revision counts. `;

  const dateFilterNote =
    dateIntent.type !== 'none' && result.dateFilterSummary
      ? result.noSlotsInDateFilter
        ? ` NO_SLOTS_IN_DATE_FILTER (${result.dateFilterSummary}). Say there are no sessions in that period; do not suggest slots outside that window.`
        : ` DATE_FILTER: ${result.dateFilterSummary}.`
      : '';

  return {
    success: true,
    stepCompleted: 1,
    stepName: 'check_availability',
    nextStep: 'booking_step_authenticate',
    nextStepNumber: 2,
    doNotRetry: true,
    availabilityCheckRevision,
    /** When true, agent must get caller to name a specific slot before authenticate (see toolResultSubmitter). */
    requiresExplicitSlotChoice,
    slotCount,
    noSlotsInDateFilter: !!result.noSlotsInDateFilter,
    message: `${revisionPreamble}✅ STEP 1 COMPLETE.${dateFilterNote} Present ONLY these slot(s) to the caller from this result—do not read out any other slots. Slots to present: ${slotsSummary}. Do not call booking_step_check_availability again in the same assistant turn with the same preferences (avoid duplicate runs). If the caller wants different dates, times, locations, instructor, or a fresh availability table after other topics, collect their updated preferences and call booking_step_check_availability again—then present only the new tool result (higher AVAILABILITY_REVISION).${requiresExplicitSlotChoice ? ' MULTIPLE SLOTS: ask which one they want (by date, time, or location) and only call booking_step_authenticate after they clearly choose one slot that matches the list.' : ' When the caller confirms this slot, call booking_step_authenticate with agreedSlot set to it—do not ask for name or email; Step 2 is CRM login only.'}`,
    allSlots: result.allSlots,
    selectedSlot: result.selectedSlot,
    slotsToAnnounce,
    monthYear: result.monthYear,
    sessionDetails: sessionDetails || null
  };
}
