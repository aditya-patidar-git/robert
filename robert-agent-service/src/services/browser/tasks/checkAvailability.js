import fs from 'fs';
import * as commonSteps from '../../commonBookingSteps/index.js';
import { takeScreenshot } from '../../commonBookingSteps/utils.js';

/**
 * Check availability task handler
 * Wraps commonBookingSteps/checkAvailabilityAndNoteDetails with caching
 */
export async function checkAvailability(page, args, auditId, screenshotsDir) {
  try {
    const courseType = args.courseType || '';
    if (!courseType) {
      throw new Error('Course type is required for availability check');
    }
    
    console.log(`📚 [${auditId}] Checking availability for ${courseType}...`);
    
    // Extract preferences from args if provided
    const preferences = {
      preferredDate: args.preferredDate,
      preferredTime: args.preferredTime,
      location: args.location
    };
    
    const availability = await commonSteps.checkAvailabilityAndNoteDetails(page, courseType, screenshotsDir, preferences);
    await takeScreenshot(page, `${auditId}_${courseType.toLowerCase().replace(/\s+/g, '-')}_availability_check.png`, screenshotsDir);
    
    // Store availability data to file as fallback (for development/debugging)
    const availabilityCachePath = './availability-cache.json';
    try {
      // Extract callSid from auditId (format: audit_${timestamp}_${callSid})
      const callSidFromAuditId = auditId.split('_').slice(2).join('_') || 'unknown';
      
      const cacheData = {
        courseType: courseType,
        allSlots: availability.allSlots,
        selectedSlot: availability.selectedSlot,
        sessionDetails: availability.selectedSlot, // Keep for backward compatibility
        monthYear: availability.monthYear,
        timestamp: new Date().toISOString(),
        callSid: callSidFromAuditId
      };
      fs.writeFileSync(availabilityCachePath, JSON.stringify(cacheData, null, 2));
      console.log(`💾 [${auditId}] Stored availability data to ${availabilityCachePath} as fallback`);
    } catch (error) {
      console.warn(`⚠️ [${auditId}] Could not save availability cache:`, error.message);
    }
    
    return {
      success: true,
      result: {
        allSlots: availability.allSlots, // All available slots
        selectedSlot: availability.selectedSlot, // Best matching slot
        sessionDetails: availability.selectedSlot, // Keep for backward compatibility
        monthYear: availability.monthYear,
        ...availability.selectedSlot // Also include slot fields directly for easy access
      },
      screenshots: [`${auditId}_${courseType.toLowerCase().replace(/\s+/g, '-')}_availability_check.png`]
    };
  } catch (error) {
    console.error(`❌ [${auditId}] Check availability error:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Dry-run check availability
 */
export async function dryRunCheckAvailability(page, args, auditId, screenshotsDir) {
  try {
    console.log(`🔍 [${auditId}] Dry run: Check availability for ${args.courseType || 'unspecified'}`);
    
    const courseType = args.courseType || '';
    
    if (!courseType) {
      return {
        success: false,
        error: 'Course type is required for availability check'
      };
    }
    
    // Use common availability check function for all course types
    // Extract preferences from args if provided
    const preferences = {
      preferredDate: args.preferredDate,
      preferredTime: args.preferredTime,
      location: args.location
    };
    
    const availability = await commonSteps.checkAvailabilityAndNoteDetails(page, courseType, screenshotsDir, preferences);
    await takeScreenshot(page, `${auditId}_${courseType.toLowerCase().replace(/\s+/g, '-')}_availability_dryrun.png`, screenshotsDir);
    
    return {
      success: true,
      result: {
        action: 'check_availability',
        courseType: courseType,
        allSlots: availability.allSlots,
        selectedSlot: availability.selectedSlot,
        sessionDetails: availability.selectedSlot, // Keep for backward compatibility
        monthYear: availability.monthYear,
        availability: availability.selectedSlot // Keep for backward compatibility
      },
      requiresConfirmation: false
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

