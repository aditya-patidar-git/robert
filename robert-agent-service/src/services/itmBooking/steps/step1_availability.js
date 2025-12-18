import * as commonSteps from '../../commonBookingSteps/index.js';

/**
 * Step 1: Check availability and agree on slot with caller
 * Handles availability checking, preference matching, and slot agreement
 */
export async function step1Availability(page, bookingArgs, screenshotsDir, screenshots) {
  let sessionDetails = bookingArgs.sessionDetails;
  
  // CRITICAL FIX: Check for agreedSlot FIRST, before calling checkAvailabilityAndNoteDetails
  // If an agreedSlot is provided, skip Step 1 entirely and use that slot
  if (bookingArgs.agreedSlot || bookingArgs.selectedSlot) {
    // Use the agreed/selected slot - skip availability check
    sessionDetails = bookingArgs.agreedSlot || bookingArgs.selectedSlot;
    console.log('✅ Step 1: Using agreed slot from bookingArgs (skipping availability check):', {
      date: sessionDetails.date,
      time: sessionDetails.time,
      location: sessionDetails.location,
      instructor: sessionDetails.instructor
    });
    
    // Ensure all required fields are present for the agreed slot
    if (!sessionDetails.startDate && sessionDetails.date) {
      // Try to extract date from the date string if startDate is missing
      try {
        let dateObj = null;
        
        // First, try DD/MM/YYYY format (common in availability tables)
        const ddmmyyyyMatch = sessionDetails.date.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (ddmmyyyyMatch) {
          const [, day, month, year] = ddmmyyyyMatch;
          dateObj = new Date(`${year}-${month}-${day}`);
          console.log(`📅 Parsed DD/MM/YYYY format: ${day}/${month}/${year} -> ${year}-${month}-${day}`);
        } else {
          // Try standard Date parsing for other formats
          dateObj = new Date(sessionDetails.date);
        }
        
        if (dateObj && !isNaN(dateObj.getTime())) {
          sessionDetails.startDate = dateObj.toISOString().split('T')[0];
          console.log(`✅ Extracted startDate from date field: ${sessionDetails.startDate}`);
        } else {
          throw new Error('Date parsing failed');
        }
      } catch (e) {
        // If parsing fails, use a default
        console.warn(`⚠️ Could not parse date from "${sessionDetails.date}", using default date`);
        sessionDetails.startDate = bookingArgs.preferredDate || new Date().toISOString().split('T')[0];
      }
    }
    
    // Ensure course name is set
    if (!sessionDetails.course) {
      sessionDetails.course = 'ITM - Introduction to Motorcycle';
    }
    
    console.log('✅ Step 1 completed: Slot agreed and selected (from previous check)');
    console.log(`   Agreed slot: ${sessionDetails.date} at ${sessionDetails.time}, Location: ${sessionDetails.location}, Instructor: ${sessionDetails.instructor || 'TBD'}`);
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-1-availability-checked.png', screenshotsDir));
    return { sessionDetails, requiresSlotSelection: false };
  } else if (!sessionDetails) {
    // Only check availability if no agreedSlot and no sessionDetails
    // Extract preferences from bookingArgs (for matching if provided)
    const preferences = {
      preferredDate: bookingArgs.preferredDate,
      preferredTime: bookingArgs.preferredTime,
      location: bookingArgs.location,
      instructor: bookingArgs.instructor
    };
    
    // Log what preferences we received (for debugging)
    console.log('📅 Step 1: Received preferences:', {
      preferredDate: preferences.preferredDate || '(not provided)',
      preferredTime: preferences.preferredTime || '(not provided)',
      location: preferences.location || '(not provided)',
      instructor: preferences.instructor || '(not provided)'
    });
    
    // Always check availability first to get all slots
    const availabilityResult = await commonSteps.checkAvailabilityAndNoteDetails(
      page,
      'ITM',
      screenshotsDir,
      preferences // Pass preferences for matching, but we'll return all slots
    );
    
    if (!availabilityResult.selectedSlot) {
      // No slot selected (either no preferences or no match) - return all slots and ask for preferences
      console.log('📅 Step 1: No slot selected (no preferences or no match), returning all slots for discussion');
      
      return {
        sessionDetails: null,
        requiresSlotSelection: true,
        message: 'I can see we have availability for ITM sessions. To help you find the best slot, could you please tell me: (1) Do you have any preference for the date or time? (2) Do you have any location preference? We have training centres in Alperton, Croydon, Edgware, Eltham, Wimbledon, RM9, and Hoddesdon. (3) Do you have any instructor preference?',
        allSlots: availabilityResult.allSlots,
        monthYear: availabilityResult.monthYear,
        suggestedSlot: availabilityResult.selectedSlot || null
      };
    } else {
      // Preferences provided and slot was selected - but still need user agreement
      console.log('📅 Step 1: Slot selected based on preferences, but user agreement needed');
      
      return {
        sessionDetails: null,
        requiresSlotSelection: true,
        message: `I found a slot that matches your preferences: ${availabilityResult.selectedSlot.date} at ${availabilityResult.selectedSlot.time}, Location: ${availabilityResult.selectedSlot.location}. Would you like to proceed with this slot, or would you prefer a different date, time, or location?`,
        allSlots: availabilityResult.allSlots,
        monthYear: availabilityResult.monthYear,
        suggestedSlot: availabilityResult.selectedSlot
      };
    }
  } else {
    console.log('✅ Step 1: Using availability data from previous check (backward compatibility)');
    console.log(`   Slot: ${sessionDetails.date} at ${sessionDetails.time}, Location: ${sessionDetails.location}`);
    return { sessionDetails, requiresSlotSelection: false };
  }
}

