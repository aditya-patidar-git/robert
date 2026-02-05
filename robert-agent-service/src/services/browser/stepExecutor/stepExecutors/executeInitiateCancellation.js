/**
 * Initiate Cancellation Step Executor
 * Step 9: Click booking row → "Cancel booking" from context menu
 * Preserves all Playwright timing and state checks
 */

import { takeScreenshot } from '../../../commonBookingSteps/utils.js';

/**
 * Execute initiateCancellation step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<Object>} Step execution result
 */
export async function executeInitiateCancellation(page, args, sessionState, screenshotsDir) {
  const courseDate = args.courseDate || sessionState?.bookingDetails?.courseDate;
  const bookingId = sessionState?.bookingDetails?.bookingId;
  const rowIndex = sessionState?.bookingDetails?.rowIndex;
  
  if (!courseDate) {
    return {
      success: false,
      error: 'Course date is required to initiate cancellation'
    };
  }

  try {
    console.log(`❌ [INITIATE_CANCELLATION] Initiating cancellation for booking on ${courseDate}`);
    
    // Work within contactEdit_iframe (should already be set from Step 6)
    console.log('🔄 [INITIATE_CANCELLATION] Switching to contactEdit_iframe context...');
    const clientDetailsIframe = page.frameLocator('#contactEdit_iframe');
    
    // Wait for iframe to be ready
    await page.waitForTimeout(2000);
    
    // Find booking row using bookingId from Step 7 (preferred method)
    let bookingRow = null;
    
    if (bookingId) {
      console.log(`🔍 [INITIATE_CANCELLATION] Finding booking row by bookingId: ${bookingId}`);
      bookingRow = clientDetailsIframe.locator(`tr.jqx_quickGridRow[data-jcd_booking_id="${bookingId}"]`);
      const exists = await bookingRow.count() > 0;
      if (!exists) {
        console.log(`⚠️ [INITIATE_CANCELLATION] Booking row with ID ${bookingId} not found, trying fallback...`);
        bookingRow = null;
      } else {
        console.log(`✅ [INITIATE_CANCELLATION] Found booking row by bookingId`);
      }
    }
    
    // Fallback: Use rowIndex if available
    if (!bookingRow && rowIndex !== undefined && rowIndex !== null) {
      console.log(`🔍 [INITIATE_CANCELLATION] Finding booking row by rowIndex: ${rowIndex}`);
      const bookingsTable = clientDetailsIframe.locator('#contactBookingGrid_page table.jqx_quickGridTable');
      const bookingRows = bookingsTable.locator('tr.jqx_quickGridRow:not(.jqx_cancelled_booking)');
      bookingRow = bookingRows.nth(rowIndex);
      const exists = await bookingRow.count() > 0;
      if (!exists) {
        console.log(`⚠️ [INITIATE_CANCELLATION] Booking row at index ${rowIndex} not found, trying fallback...`);
        bookingRow = null;
      } else {
        console.log(`✅ [INITIATE_CANCELLATION] Found booking row by rowIndex`);
      }
    }
    
    // Fallback: Re-find using courseDate (same logic as Step 7)
    if (!bookingRow) {
      console.log(`🔍 [INITIATE_CANCELLATION] Re-finding booking row by courseDate: ${courseDate}`);
      const bookingsTable = clientDetailsIframe.locator('#contactBookingGrid_page table.jqx_quickGridTable');
      const bookingRows = bookingsTable.locator('tr.jqx_quickGridRow:not(.jqx_cancelled_booking)');
      const rowCount = await bookingRows.count();
      
      const targetDate = new Date(courseDate);
      const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      
      // Helper function to parse Course Date button text (format: "Mon 30 Mar 2026 09:00")
      const parseCourseDateButton = (buttonText) => {
        if (!buttonText) return null;
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
      
      for (let i = 0; i < rowCount; i++) {
        const row = bookingRows.nth(i);
        const isInFuture = await row.getAttribute('data-isinfuture');
        const cancellationDate = await row.getAttribute('data-jcd_cancellation_date');
        
        if (isInFuture !== 'Y' || (cancellationDate && cancellationDate.trim() !== '')) {
          continue;
        }
        
        const cells = row.locator('td');
        const courseDateCell = cells.nth(3); // 4th column
        const courseDateButton = courseDateCell.locator('button[id^="ChangeDate_"]');
        const buttonCount = await courseDateButton.count();
        
        if (buttonCount > 0) {
          const buttonText = await courseDateButton.first().textContent();
          const parsedDate = parseCourseDateButton(buttonText);
          
          if (parsedDate) {
            const parsedDateOnly = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
            if (parsedDateOnly.getTime() === targetDateOnly.getTime()) {
              bookingRow = row;
              console.log(`✅ [INITIATE_CANCELLATION] Found booking row by courseDate at index ${i}`);
              break;
            }
          }
        }
      }
    }
    
    if (!bookingRow) {
      throw new Error(`Could not find booking row for date ${courseDate}`);
    }
    
    // Click on booking row to open context menu
    console.log(`👆 [INITIATE_CANCELLATION] Clicking on booking row to open context menu...`);
    await bookingRow.click();
    await page.waitForTimeout(1000);
    
    // Wait for context menu dropdown (rendered in same document as grid, inside iframe)
    console.log(`⏳ [INITIATE_CANCELLATION] Waiting for context menu dropdown...`);
    const contextMenu = clientDetailsIframe.locator('.dx-overlay-content.dx-inner-overlay.dx-context-menu.dx-menu-base');
    await contextMenu.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);
    
    // Find and click "Cancel booking" option
    console.log(`🔍 [INITIATE_CANCELLATION] Looking for "Cancel booking" option...`);
    const cancelBookingOption = contextMenu.locator('.dx-menu-item-text:has-text("Cancel booking")');
    await cancelBookingOption.waitFor({ state: 'visible', timeout: 5000 });
    await cancelBookingOption.click();
    
    // Wait for cancellation form iframe to appear
    console.log(`⏳ [INITIATE_CANCELLATION] Waiting for cancellation form iframe...`);
    await page.waitForTimeout(3000);
    
    // Verify cancellation form is open by checking for contactCancelBooking_iframe
    const cancelBookingIframe = page.locator('#contactCancelBooking_iframe');
    await cancelBookingIframe.waitFor({ state: 'attached', timeout: 30000 });
    
    // Also verify form fields are visible inside the iframe
    const cancelBookingIframeLocator = page.frameLocator('#contactCancelBooking_iframe');
    await cancelBookingIframeLocator.locator('#presetReason').waitFor({ state: 'visible', timeout: 30000 });
    
    console.log(`✅ [INITIATE_CANCELLATION] Cancellation form opened successfully`);
    
    await takeScreenshot(page, 'initiate-cancellation-form-opened.png', screenshotsDir);
    
    return {
      success: true,
      cancellationFormOpened: true
    };
    
  } catch (error) {
    console.error(`❌ [INITIATE_CANCELLATION] Error:`, error);
    await takeScreenshot(page, 'initiate-cancellation-error.png', screenshotsDir);
    
    return {
      success: false,
      error: error.message || 'Failed to initiate cancellation'
    };
  }
}
