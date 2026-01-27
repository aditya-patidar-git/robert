/**
 * Fill Cancellation Form Step Executor
 * Step 10: Fill cancellation form fields and submit
 * Preserves all Playwright timing and state checks
 */

import { takeScreenshot } from '../../../commonBookingSteps/utils.js';

/**
 * Execute fillCancellationForm step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<Object>} Step execution result
 */
export async function executeFillCancellationForm(page, args, sessionState, screenshotsDir) {
  const courseType = args.courseType || sessionState?.courseType;
  const cancellationFee = args.cancellationFee || sessionState?.cancellationFee;
  const cancellationReason = args.cancellationReason || 'No longer needed';
  
  if (!courseType) {
    return {
      success: false,
      error: 'Course type is required'
    };
  }
  
  if (cancellationFee === undefined || cancellationFee === null) {
    return {
      success: false,
      error: 'Cancellation fee is required'
    };
  }

  try {
    console.log(`📝 [FILL_CANCELLATION_FORM] Filling cancellation form for ${courseType}`);
    console.log(`   Cancellation fee: £${cancellationFee.toFixed(2)}`);
    
    // Wait for form to be fully loaded
    await page.waitForTimeout(2000);
    
    // 1. Select reason for cancelling: "No longer needed"
    console.log(`📋 [FILL_CANCELLATION_FORM] Selecting cancellation reason...`);
    const reasonDropdown = page.getByLabel(/Please select the reason for cancelling/i).first();
    await reasonDropdown.waitFor({ state: 'visible', timeout: 10000 });
    await reasonDropdown.selectOption('No longer needed');
    await page.waitForTimeout(1000);
    
    // 2. Add cancellation notes with date and time
    console.log(`📝 [FILL_CANCELLATION_FORM] Adding cancellation notes...`);
    const today = new Date().toLocaleDateString('en-GB');
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const note = `Client called on ${today} ${time} and asked to cancel the booking. The Client is aware of the cancellation charges as follows: If you wish to cancel your (CBT), (ITM), (Gear Conversion), (Private Motorcycling lesson) you MUST provide a minimum of 3 (Three) full working days' notice before the start of your course. Be aware that there is a charge of 30% for administration fee. Cancellations made within less than 3 (three) full working days will result in the entire paid fees. Notes by AI Agent Robert on ${today}.`;
    
    const notesField = page.getByLabel(/or add\/amend the text below/i).first();
    await notesField.waitFor({ state: 'visible', timeout: 10000 });
    await notesField.fill(note);
    await page.waitForTimeout(1000);
    
    // 3. Set charge for cancellation: "Yes"
    console.log(`💰 [FILL_CANCELLATION_FORM] Setting charge for cancellation...`);
    const chargeDropdown = page.getByLabel(/Charge for this cancellation/i).first();
    await chargeDropdown.waitFor({ state: 'visible', timeout: 10000 });
    await chargeDropdown.selectOption('Yes');
    await page.waitForTimeout(1000);
    
    // 4. Set charge amount based on course type
    console.log(`💷 [FILL_CANCELLATION_FORM] Setting cancellation fee amount...`);
    
    // Determine fee amount based on course type
    let feeAmount = '';
    if (courseType === 'CBT' || courseType === 'Compulsory Basic Training') {
      feeAmount = '58.50';
    } else if (courseType === 'CBT Executive' || courseType === 'CBT Executive 1-2-1') {
      feeAmount = '165.00';
    } else {
      // ITM, Gear Conversion, Private Lesson
      feeAmount = '37.50';
    }
    
    // Use the calculated fee if available, otherwise use course-specific default
    const finalFeeAmount = cancellationFee > 0 ? cancellationFee.toFixed(2) : feeAmount;
    
    const amountField = page.getByLabel(/Amount to charge/i).first();
    await amountField.waitFor({ state: 'visible', timeout: 10000 });
    await amountField.fill(finalFeeAmount);
    await page.waitForTimeout(1000);
    
    // 5. Leave financial category as default (No category) - no action needed
    
    // 6. Click "Cancel now" button
    console.log(`✅ [FILL_CANCELLATION_FORM] Submitting cancellation form...`);
    const cancelNowButton = page.getByRole('button', { name: /Cancel now/i }).first();
    await cancelNowButton.waitFor({ state: 'visible', timeout: 10000 });
    await cancelNowButton.click();
    
    // Wait for cancellation to process
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle');
    
    // Verify cancellation was successful
    // Look for success indicators (returned to profile page, booking marked as cancelled, etc.)
    const successIndicators = [
      page.getByText(/Bookings, credits, and debits/i),
      page.getByText(/cancelled/i),
      page.locator('text=/success/i')
    ];
    
    let cancellationSuccessful = false;
    for (const indicator of successIndicators) {
      const count = await indicator.count();
      if (count > 0) {
        cancellationSuccessful = true;
        break;
      }
    }
    
    // If we're back on the profile page, cancellation likely succeeded
    const backOnProfile = await page.getByText(/Bookings, credits, and debits/i).count() > 0;
    if (backOnProfile) {
      cancellationSuccessful = true;
    }
    
    if (!cancellationSuccessful) {
      // Wait a bit more and check again
      await page.waitForTimeout(3000);
      const retryCheck = await page.getByText(/Bookings, credits, and debits/i).count() > 0;
      cancellationSuccessful = retryCheck;
    }
    
    console.log(`✅ [FILL_CANCELLATION_FORM] Cancellation form submitted successfully`);
    
    await takeScreenshot(page, 'fill-cancellation-form-submitted.png', screenshotsDir);
    
    return {
      success: true,
      cancellationSubmitted: true,
      bookingCancelled: cancellationSuccessful,
      cancellationFee: parseFloat(finalFeeAmount)
    };
    
  } catch (error) {
    console.error(`❌ [FILL_CANCELLATION_FORM] Error:`, error);
    await takeScreenshot(page, 'fill-cancellation-form-error.png', screenshotsDir);
    
    return {
      success: false,
      error: error.message || 'Failed to fill cancellation form'
    };
  }
}
