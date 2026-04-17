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

  const instructorPref = String(args.instructor || '').trim();
  // Voice-friendly: include calendar month/year when present (avoids "Sat 2nd" with no month).
  // When caller asked for a specific instructor and several slots are listed, name each row's instructor.
  const formatSlot = (s) => {
    const datePart = s.monthYear ? `${s.date} ${s.monthYear}` : s.date;
    let line = `${datePart} at ${s.time}, ${_shortLocation(s.location)}, ${s.price}`;
    if (instructorPref && slotCount > 1) {
      const ins = String(s.instructor || '')
        .replace(/^Instructor:\s*/i, '')
        .trim();
      if (ins) line += ` — instructor ${ins}`;
    }
    return line;
  };

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

  const totalSlotsInTable = result.allSlots?.length ?? 0;
  const dateFilterNote =
    dateIntent.type !== 'none' && result.dateFilterSummary
      ? result.noSlotsInDateFilter
        ? ` NO_SLOTS_IN_DATE_FILTER (${result.dateFilterSummary}). No rows in that date window on the calendar currently loaded (${totalSlotsInTable} total slots exist in the diary across other dates). "Slots to present" are the nearest alternatives outside that window—read them verbatim and mention they fall outside the requested period. You can say something like "I have ${totalSlotsInTable} slots available on other dates—would you like me to suggest some?" Offer to call booking_step_check_availability again with preferredDate null, this month, next 7 days, this week, next week, or a rolling year phrase (e.g. next 12 months).`
        : ` DATE_FILTER: ${result.dateFilterSummary}.`
      : '';

  const meta = result.instructorLocationMeta;
  const shortPrefLoc = args.location ? _shortLocation(args.location) : '';
  let instructorClause = '';
  if (meta?.noSlotsInRequestedDateWindow && String(args.instructor || '').trim() && meta.anyInstructorMatch) {
    instructorClause =
      ` INSTRUCTOR_CLARIFICATION: The caller asked for instructor "${args.instructor}". That instructor appears somewhere on the loaded calendar but not in the requested date window. Only attribute "${args.instructor}" to a slot if that slot's instructor field matches. The listed slots may be outside the requested dates.`;
  } else if (meta?.instructorAwayFromPreferredCentre && args.instructor && args.location) {
    instructorClause =
      ` INSTRUCTOR_CLARIFICATION: The caller asked for "${args.instructor}" at ${shortPrefLoc}. ` +
      `Do not say the ${shortPrefLoc} slots are with ${args.instructor} unless that slot's instructor field matches. ` +
      `${args.instructor} is listed at another centre in "Slots to present" — say that clearly when you read the list.`;
  } else if (result.announceIncludesNonPreferredInstructor && instructorPref) {
    instructorClause =
      ` INSTRUCTOR_CLARIFICATION: List slots with "${args.instructor}" first (each line shows that row's instructor). ` +
      'If there are further slots in the list, they are with other instructors from the same search—say that explicitly so the caller is not misled. ' +
      `Offer to narrow date or centre if they want only ${args.instructor}.`;
  } else if (meta?.suggestInstructorSpellingConfirmation && args.instructor) {
    instructorClause =
      ` INSTRUCTOR_CLARIFICATION: The calendar shows availability but no row lists instructor "${args.instructor}". ` +
      'Do not say that instructor definitely has no slots—speech recognition often confuses similar names (e.g. Sean vs Shaun). ' +
      'Ask the caller to confirm the spelling letter-by-letter (e.g. "Could you spell the first name for me?"), then call booking_step_check_availability again with instructor set to the spelling they confirm. ' +
      'GROUNDING RULE: Do NOT spell or state the instructor name yourself (e.g. never say "S-E-A-N" or "S-H-A-U-N") unless the caller has explicitly spelled it out in their own words. ' +
      'Until then, you may read the listed slots verbatim without claiming they are with the requested name.';
  } else if (meta?.instructorRequestedButNoSlotMatch && args.instructor) {
    instructorClause =
      ` INSTRUCTOR_CLARIFICATION: No row in this result lists instructor "${args.instructor}". ` +
      'Say that clearly; do not attribute any presented slot to that instructor.';
  }

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
    announceIncludesNonPreferredInstructor: !!result.announceIncludesNonPreferredInstructor,
    message: `${revisionPreamble}✅ STEP 1 COMPLETE.${dateFilterNote}${instructorClause} Present ONLY these slot(s) to the caller from this result—do not read out any other slots. Slots to present: ${slotsSummary}. Do not call booking_step_check_availability again in the same assistant turn with the same preferences (avoid duplicate runs). If the caller wants different dates, times, locations, instructor, or a fresh availability table after other topics, collect their updated preferences and call booking_step_check_availability again—then present only the new tool result (higher AVAILABILITY_REVISION).${requiresExplicitSlotChoice ? ' MULTIPLE SLOTS: ask which one they want. If the caller interrupts during your readout with a clear selection (naming a specific date, time, or saying "the first one"), accept that immediately and call booking_step_authenticate. Only re-ask if their response is ambiguous.' : ' When the caller confirms this slot, call booking_step_authenticate with agreedSlot set to it—do not ask for name or email; Step 2 is CRM login only.'}`,
    allSlots: result.allSlots,
    selectedSlot: result.selectedSlot,
    slotsToAnnounce,
    monthYear: result.monthYear,
    sessionDetails: sessionDetails || null,
    instructorLocationMeta: meta ?? null
  };
}
