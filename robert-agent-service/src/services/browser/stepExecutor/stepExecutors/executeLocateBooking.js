/**
 * Locate Booking Step Executor
 * Step 7: Find booking in "Bookings, credits, and debits" section and validate date
 * Preserves all Playwright timing and state checks
 */

import { takeScreenshot } from '../../../commonBookingSteps/utils.js';
import feeCalculationService from '../../../feeCalculationService.js';

/**
 * Execute locateBooking step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<Object>} Step execution result
 */
export async function executeLocateBooking(page, args, sessionState, screenshotsDir) {
  const courseDate = args.courseDate;
  const courseType = args.courseType || sessionState?.courseType;
  
  if (!courseDate) {
    return {
      success: false,
      error: 'Course date is required to locate the booking'
    };
  }
  
  if (!courseType) {
    return {
      success: false,
      error: 'Course type is required'
    };
  }

  try {
    console.log(`🔍 [LOCATE_BOOKING] Looking for booking on date: ${courseDate}, course type: ${courseType}`);
    
    // Scroll to "Bookings, credits, and debits" section
    console.log(`📜 [LOCATE_BOOKING] Scrolling to "Bookings, credits, and debits" section...`);
    const bookingsSection = page.getByText('Bookings, credits, and debits');
    await bookingsSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    
    // Wait for bookings table to be visible
    await page.waitForSelector('tr', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Find booking row matching courseDate
    // The course date should be in a table row (tr)
    // Format: Look for rows containing the date
    const bookingRows = page.locator('tr');
    const rowCount = await bookingRows.count();
    
    let bookingFound = false;
    let bookingDetails = null;
    let bookingRow = null;
    
    // Parse courseDate to match different date formats
    const dateObj = new Date(courseDate);
    const dateStr = dateObj.toLocaleDateString('en-GB'); // DD/MM/YYYY format
    const dateStrUS = dateObj.toLocaleDateString('en-US'); // MM/DD/YYYY format
    const dateStrISO = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log(`🔍 [LOCATE_BOOKING] Searching for dates: ${dateStr}, ${dateStrUS}, ${dateStrISO}`);
    
    for (let i = 0; i < rowCount; i++) {
      const row = bookingRows.nth(i);
      const rowText = await row.textContent();
      
      // Check if row contains the date in any format
      if (rowText && (
        rowText.includes(dateStr) || 
        rowText.includes(dateStrUS) || 
        rowText.includes(dateStrISO) ||
        rowText.includes(courseDate)
      )) {
        // Found a row with the date - extract booking details
        bookingRow = row;
        bookingFound = true;
        
        // Extract booking details from row
        const cells = row.locator('td');
        const cellCount = await cells.count();
        
        bookingDetails = {
          courseDate: courseDate,
          courseType: courseType,
          rowIndex: i
        };
        
        // Try to extract additional details from cells
        if (cellCount > 0) {
          // Course date column (usually first or second column)
          const dateCell = cells.nth(0);
          const dateText = await dateCell.textContent();
          if (dateText) {
            bookingDetails.displayDate = dateText.trim();
          }
        }
        
        console.log(`✅ [LOCATE_BOOKING] Found booking row at index ${i}`);
        break;
      }
    }
    
    if (!bookingFound) {
      return {
        success: false,
        error: `Booking not found for date ${courseDate}. Please verify the date with the caller.`,
        retryPrompt: 'I could not find a booking for that date. Could you please confirm the exact date of your course?'
      };
    }
    
    // Validate date is in future
    const bookingDate = new Date(courseDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    bookingDate.setHours(0, 0, 0, 0);
    
    if (bookingDate < now) {
      return {
        success: false,
        error: 'Cannot cancel a booking in the past',
        message: 'The booking date you provided is in the past. Please verify the date.'
      };
    }
    
    // Calculate working days until booking
    const workingDays = feeCalculationService.calculateWorkingDays(now, bookingDate);
    
    // Check if meets 3-day notice requirement
    const meetsNoticeRequirement = workingDays > 3;
    
    // Calculate cancellation fee
    // Default booking price - will need to extract from booking if available
    // For now, use course-specific defaults
    let bookingPrice = 125; // Default
    if (courseType === 'CBT' || courseType === 'Compulsory Basic Training') {
      bookingPrice = 195; // CBT price
    } else if (courseType === 'CBT Executive' || courseType === 'CBT Executive 1-2-1') {
      bookingPrice = 550; // Executive CBT price
    } else if (courseType === 'ITM' || courseType === 'Introduction to Motorcycling') {
      bookingPrice = 125; // ITM price
    }
    
    const feeResult = feeCalculationService.calculateCancellationFee(courseDate, bookingPrice);
    
    console.log(`💰 [LOCATE_BOOKING] Cancellation fee calculation:`);
    console.log(`   Working days until booking: ${workingDays}`);
    console.log(`   Meets 3-day requirement: ${meetsNoticeRequirement}`);
    console.log(`   Cancellation fee: £${feeResult.fee.toFixed(2)}`);
    console.log(`   Refund amount: £${feeResult.refundAmount.toFixed(2)}`);
    
    await takeScreenshot(page, 'locate-booking-found.png', screenshotsDir);
    
    return {
      success: true,
      bookingFound: true,
      bookingDetails: {
        ...bookingDetails,
        bookingDate: courseDate,
        courseType: courseType,
        workingDaysUntilBooking: workingDays,
        meetsNoticeRequirement: meetsNoticeRequirement
      },
      cancellationFee: feeResult.fee,
      refundAmount: feeResult.refundAmount,
      feePolicy: feeResult.policy,
      meetsNoticeRequirement: meetsNoticeRequirement
    };
    
  } catch (error) {
    console.error(`❌ [LOCATE_BOOKING] Error:`, error);
    await takeScreenshot(page, 'locate-booking-error.png', screenshotsDir);
    
    return {
      success: false,
      error: error.message || 'Failed to locate booking'
    };
  }
}
