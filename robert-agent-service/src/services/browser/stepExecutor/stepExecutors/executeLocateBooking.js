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
    
    // Work within contactEdit_iframe context (should already be set from Step 6)
    console.log('🔄 [LOCATE_BOOKING] Switching to contactEdit_iframe context...');
    const clientDetailsIframe = page.frameLocator('#contactEdit_iframe');
    
    // Wait for iframe to be ready
    await page.waitForTimeout(2000);
    
    // Scroll to "Bookings, credits, and debits" section inside iframe
    console.log(`📜 [LOCATE_BOOKING] Scrolling to "Bookings, credits, and debits" section...`);
    const bookingsHeading = clientDetailsIframe.locator('h1.jqx_formBoilerPlateText.jqx_formHeading.jqx_underline:has-text("Bookings, credits and debits")');
    await bookingsHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    
    // Find the bookings table: #contactBookingGrid_page → table.jqx_quickGridTable
    console.log('🔍 [LOCATE_BOOKING] Finding bookings table...');
    const bookingsTable = clientDetailsIframe.locator('#contactBookingGrid_page table.jqx_quickGridTable');
    await bookingsTable.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // Find all booking rows (excluding cancelled ones)
    // Filter: tr.jqx_quickGridRow:not(.jqx_cancelled_booking)
    // Also filter by data-isinfuture="Y" and empty data-jcd_cancellation_date
    const bookingRows = bookingsTable.locator('tr.jqx_quickGridRow:not(.jqx_cancelled_booking)');
    const rowCount = await bookingRows.count();
    
    console.log(`📊 [LOCATE_BOOKING] Found ${rowCount} active booking rows`);
    
    // Parse courseDate to match different date formats
    const targetDate = new Date(courseDate);
    const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    
    // Helper function to parse Course Date button text (format: "Mon 30 Mar 2026 09:00")
    const parseCourseDateButton = (buttonText) => {
      if (!buttonText) return null;
      // Format: "Mon 30 Mar 2026 09:00"
      // Extract date part: "30 Mar 2026"
      const dateMatch = buttonText.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
      if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames.indexOf(dateMatch[2]);
        const year = parseInt(dateMatch[3]);
        if (month !== -1) {
          return new Date(year, month, day);
        }
      }
      return null;
    };
    
    let bookingFound = false;
    let bookingDetails = null;
    let bookingRow = null;
    let extractedPrice = null;
    
    // Iterate through booking rows to find matching date
    for (let i = 0; i < rowCount; i++) {
      const row = bookingRows.nth(i);
      
      // Check data attributes first
      const isInFuture = await row.getAttribute('data-isinfuture');
      const cancellationDate = await row.getAttribute('data-jcd_cancellation_date');
      
      // Skip if already cancelled or not in future
      if (isInFuture !== 'Y' || (cancellationDate && cancellationDate.trim() !== '')) {
        continue;
      }
      
      // Get Course Date column (4th column, index 3)
      const cells = row.locator('td');
      const courseDateCell = cells.nth(3); // 4th column (0-indexed)
      
      // Check if Course Date cell has a button (id starts with "ChangeDate_")
      const courseDateButton = courseDateCell.locator('button[id^="ChangeDate_"]');
      const buttonCount = await courseDateButton.count();
      
      if (buttonCount > 0) {
        // Extract date from button text
        const buttonText = await courseDateButton.first().textContent();
        const parsedDate = parseCourseDateButton(buttonText);
        
        if (parsedDate) {
          // Compare dates (ignoring time)
          const parsedDateOnly = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
          
          if (parsedDateOnly.getTime() === targetDateOnly.getTime()) {
            // Found matching booking!
            bookingRow = row;
            bookingFound = true;
            
            // Extract booking details from data attributes
            const bookingId = await row.getAttribute('data-jcd_booking_id');
            const courseName = await row.getAttribute('data-etp_name');
            
            // Extract price from Price column (5th column, index 4)
            const priceCell = cells.nth(4); // 5th column
            const priceText = await priceCell.textContent();
            // Price format: "£125.00" - extract number
            const priceMatch = priceText?.match(/£?([\d,]+\.?\d*)/);
            if (priceMatch) {
              extractedPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
            }
            
            bookingDetails = {
              courseDate: courseDate,
              courseType: courseType,
              rowIndex: i,
              bookingId: bookingId,
              courseName: courseName,
              displayDate: buttonText,
              extractedPrice: extractedPrice
            };
            
            console.log(`✅ [LOCATE_BOOKING] Found booking row at index ${i}`);
            console.log(`   Booking ID: ${bookingId}`);
            console.log(`   Course Name: ${courseName}`);
            console.log(`   Course Date: ${buttonText}`);
            console.log(`   Price: £${extractedPrice || 'N/A'}`);
            break;
          }
        }
      } else {
        // Fallback: Course Date might be plain text (for cancelled bookings that slipped through)
        const courseDateText = await courseDateCell.textContent();
        if (courseDateText) {
          // Try to parse plain text date
          const parsedDate = parseCourseDateButton(courseDateText);
          if (parsedDate) {
            const parsedDateOnly = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
            if (parsedDateOnly.getTime() === targetDateOnly.getTime()) {
              // Found matching booking
              bookingRow = row;
              bookingFound = true;
              
              const bookingId = await row.getAttribute('data-jcd_booking_id');
              const courseName = await row.getAttribute('data-etp_name');
              
              const priceCell = cells.nth(4);
              const priceText = await priceCell.textContent();
              const priceMatch = priceText?.match(/£?([\d,]+\.?\d*)/);
              if (priceMatch) {
                extractedPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
              }
              
              bookingDetails = {
                courseDate: courseDate,
                courseType: courseType,
                rowIndex: i,
                bookingId: bookingId,
                courseName: courseName,
                displayDate: courseDateText,
                extractedPrice: extractedPrice
              };
              
              console.log(`✅ [LOCATE_BOOKING] Found booking row at index ${i} (plain text date)`);
              break;
            }
          }
        }
      }
    }
    
    if (!bookingFound) {
      return {
        success: false,
        error: `Booking not found for date ${courseDate}. Please verify the date with the caller.`,
        retryPrompt: 'I could not find a booking for that date. Could you please confirm the exact date of your course?'
      };
    }
    
    // Validate date is in future (already checked via data-isinfuture="Y", but double-check)
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
    
    // Calculate cancellation fee using extracted price or fallback to course-specific defaults
    let bookingPrice = extractedPrice;
    if (!bookingPrice || bookingPrice === 0) {
      // Fallback to course-specific defaults if price extraction failed
      bookingPrice = 125; // Default
      if (courseType === 'CBT' || courseType === 'Compulsory Basic Training') {
        bookingPrice = 195; // CBT price
      } else if (courseType === 'CBT Executive' || courseType === 'CBT Executive 1-2-1') {
        bookingPrice = 550; // Executive CBT price
      } else if (courseType === 'ITM' || courseType === 'Introduction to Motorcycling') {
        bookingPrice = 125; // ITM price
      }
      console.log(`⚠️ [LOCATE_BOOKING] Could not extract price, using default: £${bookingPrice}`);
    }
    
    const feeResult = feeCalculationService.calculateCancellationFee(courseDate, bookingPrice);
    
    console.log(`💰 [LOCATE_BOOKING] Cancellation fee calculation:`);
    console.log(`   Booking Price: £${bookingPrice.toFixed(2)}`);
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
        bookingPrice: bookingPrice,
        workingDaysUntilBooking: workingDays,
        meetsNoticeRequirement: meetsNoticeRequirement
      },
      cancellationFee: feeResult.fee,
      refundAmount: feeResult.refundAmount,
      feePolicy: feeResult.policy,
      meetsNoticeRequirement: meetsNoticeRequirement,
      bookingRow: bookingRow ? { rowIndex: bookingDetails.rowIndex } : null // Store row reference for next step
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
