/**
 * Locate Booking Step Executor
 * Step 7: Find booking in "Bookings, credits, and debits" section and validate date
 * Preserves all Playwright timing and state checks
 */

import { takeScreenshot, waitForThenOptionalDelay, CRM_STABILITY_DELAY_MS } from '../../../commonBookingSteps/utils.js';
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
  const requestedCourseType = args.courseType || sessionState?.courseType;
  
  if (!courseDate) {
    return {
      success: false,
      error: 'Course date is required to locate the booking'
    };
  }

  try {
    console.log(`🔍 [LOCATE_BOOKING] Looking for booking on date: ${courseDate}${requestedCourseType ? `, requested course type: ${requestedCourseType}` : ' (course type will be determined from booking)'}`);
    
    // Work within contactEdit_iframe context (should already be set from Step 6)
    console.log('🔄 [LOCATE_BOOKING] Switching to contactEdit_iframe context...');
    const clientDetailsIframe = page.frameLocator('#contactEdit_iframe');
    
    const bookingsTable = clientDetailsIframe.locator('#contactBookingGrid_page table.jqx_quickGridTable');
    await waitForThenOptionalDelay(page, bookingsTable, { state: 'visible', timeout: 10000, delayMs: CRM_STABILITY_DELAY_MS });

    console.log(`📜 [LOCATE_BOOKING] Scrolling to "Bookings, credits, and debits" section...`);
    const bookingsHeading = clientDetailsIframe.locator('h1.jqx_formBoilerPlateText.jqx_formHeading.jqx_underline:has-text("Bookings, credits and debits")');
    await bookingsHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(CRM_STABILITY_DELAY_MS);
    
    // Find all booking rows (excluding cancelled ones)
    // Filter: tr.jqx_quickGridRow:not(.jqx_cancelled_booking)
    // Also filter by data-isinfuture="Y" and empty data-jcd_cancellation_date
    const bookingRows = bookingsTable.locator('tr.jqx_quickGridRow:not(.jqx_cancelled_booking)');
    const rowCount = await bookingRows.count();
    
    console.log(`📊 [LOCATE_BOOKING] Found ${rowCount} active booking rows`);

    const parseCourseDateInput = (str) => {
      if (!str || typeof str !== 'string') return null;
      const trimmed = str.trim();
      const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) {
        const day = parseInt(dmy[1], 10);
        const month = parseInt(dmy[2], 10) - 1;
        const year = parseInt(dmy[3], 10);
        if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          const d = new Date(year, month, day);
          if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) return d;
        }
      }
      const iso = new Date(trimmed);
      return !isNaN(iso.getTime()) ? iso : null;
    };

    const targetDateOnly = parseCourseDateInput(courseDate);
    if (!targetDateOnly || isNaN(targetDateOnly.getTime())) {
      return {
        success: false,
        error: `Invalid course date format: ${courseDate}. Use DD/MM/YYYY.`,
        retryPrompt: 'Could you confirm the course date in day, month and year?'
      };
    }

    const courseTypeAliases = {
      'Introduction to Motorcycling': ['ITM', 'Introduction to Motorcycling'],
      'ITM': ['ITM', 'Introduction to Motorcycling'],
      'Compulsory Basic Training': ['CBT', 'Compulsory Basic Training'],
      'CBT': ['CBT', 'Compulsory Basic Training'],
      'CBT Executive 1-2-1': ['CBT Executive', 'CBT Executive 1-2-1'],
      'CBT Executive': ['CBT Executive', 'CBT Executive 1-2-1']
    };
    const matchesCourseType = (requestedType, rowCourseName) => {
      if (!rowCourseName || !requestedType) return false;
      const normalized = (rowCourseName || '').trim();
      const aliases = courseTypeAliases[requestedType] || [requestedType];
      return aliases.some(a => normalized.toLowerCase().includes(a.toLowerCase()));
    };
    
    // Helper to extract courseType from course name
    const extractCourseTypeFromName = (courseName) => {
      if (!courseName) return null;
      const courseNameLower = courseName.toLowerCase();
      if (courseNameLower.includes('cbt executive') || courseNameLower.includes('executive')) {
        return 'CBT Executive 1-2-1';
      } else if (courseNameLower.includes('cbt') || courseNameLower.includes('compulsory basic training')) {
        return 'CBT';
      } else if (courseNameLower.includes('itm') || courseNameLower.includes('introduction to motorcycling')) {
        return 'Introduction to Motorcycling';
      } else if (courseNameLower.includes('gear conversion')) {
        return 'Gear Conversion';
      } else if (courseNameLower.includes('private lesson')) {
        return 'Private Lesson';
      }
      return null;
    };

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
    let courseType = null; // Will be set when booking is found (extracted or requested)
    
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
            const courseName = await row.getAttribute('data-etp_name');
            // Extract courseType from booking if not provided
            let extractedCourseType = requestedCourseType;
            if (!extractedCourseType && courseName) {
              extractedCourseType = extractCourseTypeFromName(courseName);
              if (!extractedCourseType) {
                // Default fallback if extraction fails
                extractedCourseType = 'CBT';
                console.log(`⚠️ [LOCATE_BOOKING] Could not determine course type from "${courseName}", defaulting to CBT`);
              } else {
                console.log(`✅ [LOCATE_BOOKING] Extracted course type from booking: "${extractedCourseType}" (from course name: "${courseName}")`);
              }
            }
            
            // If courseType was requested, verify it matches
            if (requestedCourseType && !matchesCourseType(requestedCourseType, courseName)) {
              console.log(`⏭️ [LOCATE_BOOKING] Row ${i} date matches but course type mismatch: requested="${requestedCourseType}", row="${courseName}"`);
              continue;
            }
            
            bookingRow = row;
            bookingFound = true;
            courseType = extractedCourseType; // Use extracted or requested courseType

            const bookingId = await row.getAttribute('data-jcd_booking_id');

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
              courseType: courseType, // Use extracted or requested courseType
              rowIndex: i,
              bookingId: bookingId,
              courseName: courseName,
              displayDate: buttonText,
              extractedPrice: extractedPrice,
              courseTypeExtracted: !requestedCourseType // Flag indicating if courseType was extracted from booking
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
              const courseName = await row.getAttribute('data-etp_name');
              // Extract courseType from booking if not provided
              let extractedCourseType = requestedCourseType;
              if (!extractedCourseType && courseName) {
                extractedCourseType = extractCourseTypeFromName(courseName);
                if (!extractedCourseType) {
                  extractedCourseType = 'CBT';
                  console.log(`⚠️ [LOCATE_BOOKING] Could not determine course type from "${courseName}", defaulting to CBT`);
                } else {
                  console.log(`✅ [LOCATE_BOOKING] Extracted course type from booking: "${extractedCourseType}" (from course name: "${courseName}")`);
                }
              }
              
              // If courseType was requested, verify it matches
              if (requestedCourseType && !matchesCourseType(requestedCourseType, courseName)) {
                console.log(`⏭️ [LOCATE_BOOKING] Row ${i} (plain) date matches but course type mismatch: requested="${requestedCourseType}", row="${courseName}"`);
                continue;
              }
              
              bookingRow = row;
              bookingFound = true;
              courseType = extractedCourseType; // Use extracted or requested courseType

              const bookingId = await row.getAttribute('data-jcd_booking_id');

              const priceCell = cells.nth(4);
              const priceText = await priceCell.textContent();
              const priceMatch = priceText?.match(/£?([\d,]+\.?\d*)/);
              if (priceMatch) {
                extractedPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
              }
              
              bookingDetails = {
                courseDate: courseDate,
                courseType: courseType, // Use extracted or requested courseType
                rowIndex: i,
                bookingId: bookingId,
                courseName: courseName,
                displayDate: courseDateText,
                extractedPrice: extractedPrice,
                courseTypeExtracted: !requestedCourseType
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
        error: `Booking not found for date ${courseDate}${requestedCourseType ? ` and course type "${requestedCourseType}"` : ''}. Please verify the date with the caller.`,
        retryPrompt: 'I could not find a booking for that date. Could you confirm the exact date your course is booked for?'
      };
    }
    
    // Ensure courseType is set (should be extracted from booking by now)
    if (!courseType) {
      // courseType should have been set when booking was found, but double-check
      courseType = bookingDetails?.courseType;
      if (!courseType) {
        return {
          success: false,
          error: 'Could not determine course type from booking. Please try again.',
          retryPrompt: 'I found the booking but could not determine the course type. Could you tell me which course you booked?'
        };
      }
    }
    
    console.log(`✅ [LOCATE_BOOKING] Course type determined: "${courseType}"${bookingDetails?.courseTypeExtracted ? ' (extracted from booking)' : ' (provided by caller)'}`);

    // Validate date is in future (already checked via data-isinfuture="Y", but double-check)
    const bookingDate = new Date(targetDateOnly);
    bookingDate.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

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
    
    const bookingDateIso = `${targetDateOnly.getFullYear()}-${String(targetDateOnly.getMonth() + 1).padStart(2, '0')}-${String(targetDateOnly.getDate()).padStart(2, '0')}`;
    const feeResult = feeCalculationService.calculateCancellationFee(bookingDateIso, bookingPrice);
    
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
