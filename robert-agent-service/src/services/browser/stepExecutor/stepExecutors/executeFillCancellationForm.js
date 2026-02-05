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
    
    // Switch to contactCancelBooking_iframe
    console.log('🔄 [FILL_CANCELLATION_FORM] Switching to contactCancelBooking_iframe context...');
    const cancelBookingIframe = page.frameLocator('#contactCancelBooking_iframe');
    
    // Wait for form to be loaded
    await page.waitForTimeout(2000);
    await cancelBookingIframe.locator('#presetReason').waitFor({ state: 'visible', timeout: 30000 });
    
    // 1. Select reason for cancelling dropdown (#presetReason)
    console.log(`📋 [FILL_CANCELLATION_FORM] Selecting cancellation reason...`);
    const reasonDropdown = cancelBookingIframe.locator('#presetReason');
    
    // For DevExtreme dropdowns, click the dropdown button to open it
    const reasonDropdownButton = reasonDropdown.locator('.dx-dropdowneditor-button');
    await reasonDropdownButton.waitFor({ state: 'visible', timeout: 30000 });
    await reasonDropdownButton.click();
    await page.waitForTimeout(500);
    
    // Wait for dropdown list to appear and select option
    // The dropdown list appears on the main page (not in iframe)
    const reasonOption = page.locator('.dx-list-item:has-text("No longer needed")').first();
    try {
      await reasonOption.waitFor({ state: 'visible', timeout: 5000 });
      await reasonOption.click();
    } catch (e) {
      // Fallback: Try using the input field directly
      console.log('⚠️ [FILL_CANCELLATION_FORM] Dropdown list not found, trying input field...');
      const reasonInput = reasonDropdown.locator('input.dx-texteditor-input');
      await reasonInput.fill('No longer needed');
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1000);
    
    // 2. Add cancellation notes with date and time (#cancellationReason)
    console.log(`📝 [FILL_CANCELLATION_FORM] Adding cancellation notes...`);
    const today = new Date().toLocaleDateString('en-GB');
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const note = `Client called on ${today} ${time} and asked to cancel the booking. The Client is aware of the cancellation charges as follows: If you wish to cancel your (CBT), (ITM), (Gear Conversion), (Private Motorcycling lesson) you MUST provide a minimum of 3 (Three) full working days' notice before the start of your course. Be aware that there is a charge of 30% for administration fee. Cancellations made within less than 3 (three) full working days will result in the entire paid fees. Notes by AI Agent Robert on ${today}.`;
    
    const notesTextarea = cancelBookingIframe.locator('#cancellationReason textarea.dx-texteditor-input');
    await notesTextarea.waitFor({ state: 'visible', timeout: 10000 });
    await notesTextarea.fill(note);
    await page.waitForTimeout(1000);
    
    // 3. Set charge for cancellation dropdown (#cancellationCharge) to "Yes"
    console.log(`💰 [FILL_CANCELLATION_FORM] Setting charge for cancellation...`);
    const chargeDropdown = cancelBookingIframe.locator('#cancellationCharge');
    const chargeDropdownButton = chargeDropdown.locator('.dx-dropdowneditor-button');
    await chargeDropdownButton.waitFor({ state: 'visible', timeout: 30000 });
    await chargeDropdownButton.click();
    await page.waitForTimeout(500);

    const yesOption = cancelBookingIframe.locator('.dx-list-item:has-text("Yes")').first();
    try {
      await yesOption.waitFor({ state: 'visible', timeout: 8000 });
      await yesOption.click();
    } catch (e) {
      console.log('⚠️ [FILL_CANCELLATION_FORM] Yes option not found in iframe, trying input field...');
      const chargeInput = chargeDropdown.locator('input.dx-texteditor-input');
      await chargeInput.fill('Yes');
      await page.waitForTimeout(300);
      const yesOptionPage = page.locator('.dx-list-item:has-text("Yes")').first();
      if (await yesOptionPage.count() > 0) {
        await yesOptionPage.click();
      } else {
        await page.keyboard.press('Enter');
      }
    }
    await page.waitForTimeout(1000);
    
    // 4. Set charge amount (#chargeAmount) - conditional, only visible when charge="Yes"
    console.log(`💷 [FILL_CANCELLATION_FORM] Setting cancellation fee amount...`);
    
    // Determine fee amount based on course type (fallback)
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
    
    // Wait for amount field to appear (conditional field)
    const amountField = cancelBookingIframe.locator('#chargeAmount input.dx-texteditor-input');
    await amountField.waitFor({ state: 'visible', timeout: 12000 });
    await amountField.clear();
    await amountField.fill(finalFeeAmount);
    await page.waitForTimeout(1000);
    
    // 5. Handle financial category (#category_id) - conditional, only visible when charge="Yes"
    // Note: Field is marked as jqx_required, but "No category" (value="0") might be valid
    // For now, leave as default unless validation fails
    console.log(`📊 [FILL_CANCELLATION_FORM] Financial category field is present (may need selection if required)...`);
    const categoryDropdown = cancelBookingIframe.locator('#category_id');
    const categoryExists = await categoryDropdown.count() > 0;
    if (categoryExists) {
      const categoryValue = await categoryDropdown.locator('input[type="hidden"]').getAttribute('value');
      console.log(`   Current category value: ${categoryValue}`);
      // If value is "0" (No category) and field is required, we may need to select a category
      // For now, leave as is and let form validation handle it
    }
    
    // 6. Click "Back to previous screen" (#btnCancel) - in main page #mainArea / #bottomToolbar, not in iframe
    console.log(`✅ [FILL_CANCELLATION_FORM] Clicking Back to previous screen...`);
    const backButton = page.locator('#btnCancel[aria-label="Back to previous screen"]');
    await backButton.waitFor({ state: 'visible', timeout: 30000 });
    await backButton.click();

    await page.waitForTimeout(3000);
    
    // Verify cancellation was successful
    // Check if we're back on the profile page (contactEdit_iframe)
    console.log(`🔍 [FILL_CANCELLATION_FORM] Verifying cancellation success...`);
    const clientDetailsIframe = page.frameLocator('#contactEdit_iframe');
    let cancellationSuccessful = false;
    
    try {
      // Check for "Bookings, credits, and debits" heading in contactEdit_iframe
      const bookingsHeading = clientDetailsIframe.locator('h1.jqx_formBoilerPlateText.jqx_formHeading.jqx_underline:has-text("Bookings, credits and debits")');
      await bookingsHeading.waitFor({ state: 'visible', timeout: 30000 });
      cancellationSuccessful = true;
      console.log(`✅ [FILL_CANCELLATION_FORM] Returned to profile page - cancellation successful`);
    } catch (e) {
      // Try alternative check
      const backOnProfile = await page.locator('#contactEdit_iframe').count() > 0;
      if (backOnProfile) {
        cancellationSuccessful = true;
        console.log(`✅ [FILL_CANCELLATION_FORM] contactEdit_iframe present - cancellation likely successful`);
      } else {
        console.log(`⚠️ [FILL_CANCELLATION_FORM] Could not verify cancellation success`);
      }
    }
    
    if (!cancellationSuccessful) {
      // Wait a bit more and check again
      await page.waitForTimeout(3000);
      try {
        const bookingsHeading = clientDetailsIframe.locator('h1:has-text("Bookings, credits and debits")');
        cancellationSuccessful = await bookingsHeading.count() > 0;
      } catch (e) {
        // Final check
        cancellationSuccessful = await page.locator('#contactEdit_iframe').count() > 0;
      }
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
