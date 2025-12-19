import * as commonSteps from '../../commonBookingSteps/index.js';
import { takeScreenshot, extractPriceFromBooking } from '../../commonBookingSteps/utils.js';

/**
 * Reschedule booking task handler
 * Wraps commonBookingSteps/rescheduleBooking with audit logging
 */
export async function rescheduleBooking(page, args, auditId, screenshotsDir) {
  try {
    console.log(`✅ [${auditId}] Rescheduling booking...`);
    
    // Find customer and booking (same as dry-run)
    if (!args.customerEmail && !args.customerMobile && !args.customerPhone) {
      throw new Error('Customer email or mobile number is required');
    }
    
    const searchType = args.customerMobile || args.customerPhone ? 'mobile' : 'email';
    const searchValue = args.customerMobile || args.customerPhone || args.customerEmail;
    
    const searchResult = await commonSteps.findAndVerifyClient(page, searchType, searchValue, screenshotsDir, args.customerEmail);
    
    if (!searchResult.found) {
      throw new Error('Customer not found');
    }
    
    const iframe = page.frameLocator('#contactLookup_iframe');
    const bookingResult = await commonSteps.findBooking(page, iframe, screenshotsDir, args.bookingReference);
    
    if (!bookingResult.found || !bookingResult.bookings || bookingResult.bookings.length === 0) {
      throw new Error(args.bookingReference ? `Booking ${args.bookingReference} not found` : 'No bookings found');
    }
    
    const existingBooking = args.bookingReference 
      ? bookingResult.bookings.find(b => b.bookingReference === args.bookingReference)
      : bookingResult.bookings[0];
    
    if (!existingBooking) {
      throw new Error(`Booking ${args.bookingReference} not found`);
    }
    
    // Execute reschedule using commonBookingSteps
    const result = await commonSteps.rescheduleBooking(page, iframe, args, existingBooking, screenshotsDir);
    
    if (result.success) {
      await takeScreenshot(page, `${auditId}_reschedule_success.png`, screenshotsDir);
      return {
        success: true,
        result: result.result,
        screenshots: [`${auditId}_reschedule_success.png`]
      };
    } else {
      throw new Error(result.error || 'Reschedule failed');
    }
    
  } catch (error) {
    console.error(`❌ [${auditId}] Reschedule booking error:`, error);
    await takeScreenshot(page, `${auditId}_reschedule_error.png`, screenshotsDir);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Dry-run reschedule booking
 */
export async function dryRunRescheduleBooking(page, args, auditId, screenshotsDir) {
  try {
    console.log(`🔍 [${auditId}] Dry run: Reschedule booking`);
    
    const feeCalculationService = (await import('../../feeCalculationService.js')).default;
    
    // Step 1: Find customer and booking
    if (!args.customerEmail && !args.customerMobile && !args.customerPhone) {
      return {
        success: false,
        error: 'Customer email or mobile number is required to find booking'
      };
    }
    
    // Find customer first
    const searchType = args.customerMobile || args.customerPhone ? 'mobile' : 'email';
    const searchValue = args.customerMobile || args.customerPhone || args.customerEmail;
    
    const searchResult = await commonSteps.findAndVerifyClient(page, searchType, searchValue, screenshotsDir, args.customerEmail);
    
    if (!searchResult.found) {
      return {
        success: false,
        error: 'Customer not found. Please verify customer details.'
      };
    }
    
    // Find booking
    const iframe = page.frameLocator('#contactLookup_iframe');
    const bookingResult = await commonSteps.findBooking(page, iframe, screenshotsDir, args.bookingReference);
    
    if (!bookingResult.found || !bookingResult.bookings || bookingResult.bookings.length === 0) {
      return {
        success: false,
        error: args.bookingReference 
          ? `Booking with reference ${args.bookingReference} not found`
          : 'No bookings found for this customer'
      };
    }
    
    const existingBooking = args.bookingReference 
      ? bookingResult.bookings.find(b => b.bookingReference === args.bookingReference)
      : bookingResult.bookings[0];
    
    if (!existingBooking) {
      return {
        success: false,
        error: `Booking with reference ${args.bookingReference} not found`
      };
    }
    
    // Calculate reschedule fee
    const bookingPrice = extractPriceFromBooking(existingBooking) || 125; // Default price if not found
    const feeResult = feeCalculationService.calculateRescheduleFee(
      existingBooking.date,
      args.newDate,
      bookingPrice,
      existingBooking.courseType
    );
    
    await takeScreenshot(page, `${auditId}_reschedule_dryrun.png`, screenshotsDir);
    
    return {
      success: true,
      result: {
        action: 'reschedule_booking',
        bookingReference: existingBooking.bookingReference,
        currentBooking: {
          date: existingBooking.date,
          time: existingBooking.time,
          location: existingBooking.location,
          courseType: existingBooking.courseType
        },
        newBooking: {
          date: args.newDate,
          time: args.newTime || existingBooking.time,
          location: args.newLocation || existingBooking.location
        },
        fee: feeResult.fee,
        feePolicy: feeResult.policy
      },
      requiresConfirmation: true
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

