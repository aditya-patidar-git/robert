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
  
  if (!courseDate) {
    return {
      success: false,
      error: 'Course date is required to initiate cancellation'
    };
  }

  try {
    console.log(`❌ [INITIATE_CANCELLATION] Initiating cancellation for booking on ${courseDate}`);
    
    // Parse courseDate to match different date formats
    const dateObj = new Date(courseDate);
    const dateStr = dateObj.toLocaleDateString('en-GB'); // DD/MM/YYYY format
    const dateStrUS = dateObj.toLocaleDateString('en-US'); // MM/DD/YYYY format
    const dateStrISO = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Find the booking row matching the courseDate
    const bookingRows = page.locator('tr');
    const rowCount = await bookingRows.count();
    
    let bookingRow = null;
    
    for (let i = 0; i < rowCount; i++) {
      const row = bookingRows.nth(i);
      const rowText = await row.textContent();
      
      // Check if row contains the date
      if (rowText && (
        rowText.includes(dateStr) || 
        rowText.includes(dateStrUS) || 
        rowText.includes(dateStrISO) ||
        rowText.includes(courseDate)
      )) {
        bookingRow = row;
        break;
      }
    }
    
    if (!bookingRow) {
      throw new Error(`Could not find booking row for date ${courseDate}`);
    }
    
    // Click on the booking row (first td or description column)
    console.log(`👆 [INITIATE_CANCELLATION] Clicking on booking row...`);
    const firstCell = bookingRow.locator('td').first();
    await firstCell.click();
    await page.waitForTimeout(2000);
    
    // Wait for context menu to appear
    console.log(`⏳ [INITIATE_CANCELLATION] Waiting for context menu...`);
    await page.waitForTimeout(1000);
    
    // Look for "Cancel booking" option in context menu
    const cancelOption = page.getByRole('menuitem', { name: /Cancel booking/i }).first();
    
    // Wait for menu item to be visible
    await cancelOption.waitFor({ state: 'visible', timeout: 10000 });
    await cancelOption.click();
    
    // Wait for cancellation form to open
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    
    // Verify cancellation form is open
    // Look for form indicators
    const formIndicators = [
      page.getByLabel(/reason for cancelling/i),
      page.getByText(/reason for cancelling/i),
      page.getByLabel(/charge for this cancellation/i),
      page.locator('text=/Cancel now/i')
    ];
    
    let formOpened = false;
    for (const indicator of formIndicators) {
      const count = await indicator.count();
      if (count > 0) {
        formOpened = true;
        break;
      }
    }
    
    if (!formOpened) {
      // Try waiting a bit more
      await page.waitForTimeout(2000);
      const retryIndicator = page.getByLabel(/reason for cancelling/i);
      formOpened = await retryIndicator.count() > 0;
    }
    
    if (!formOpened) {
      throw new Error('Cancellation form did not open. Could not find form indicators.');
    }
    
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
