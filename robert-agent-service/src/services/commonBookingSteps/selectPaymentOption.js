import { takeScreenshot, waitForThenOptionalDelay, CRM_STABILITY_DELAY_MS } from './utils.js';

/**
 * Step 10: Select payment option
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} paymentType - Payment type: 'now' (default) for "Take a payment now", 'none' for "No payment required"
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 */
export async function selectPaymentOption(page, screenshotsDir, paymentType = 'now', progressCallback = null) {
  try {
    console.log(`💳 [STEP 10] Selecting payment option (type: ${paymentType})...`);
    
    progressCallback?.({ message: 'Waiting for payment page.' });
    await page.waitForSelector('#eventNewBooking2_iframe, text=/Confirm and Pay/i, text=/4\\. Pay/i', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(CRM_STABILITY_DELAY_MS);

    let eventBookingIframeExists = false;
    let paymentDropdown;
    let searchContext;
    
    eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    if (eventBookingIframeExists) {
      try {
        const iframe = page.frameLocator('#eventNewBooking2_iframe');
        await iframe.locator('body').first().waitFor({ state: 'attached', timeout: 5000 });
        console.log('🔍 [STEP 10] Working with eventNewBooking2_iframe for payment dropdown...');
        paymentDropdown = iframe.locator('[data-onchange="jqx_chgPayWhen"]').first();
        searchContext = iframe;
      } catch (iframeError) {
        eventBookingIframeExists = false;
      }
    }
    
    if (!eventBookingIframeExists || !paymentDropdown) {
      console.log('🔍 [STEP 10] Working with main page for payment dropdown...');
      paymentDropdown = page.locator('[data-onchange="jqx_chgPayWhen"]').first();
      searchContext = page;
    }
    
    progressCallback?.({ message: 'Moving to payment method dropdown.' });
    // Wait for dropdown to be visible with increased timeout and retry logic
    let dropdownFound = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await paymentDropdown.waitFor({ state: 'visible', timeout: 15000 }); // Increased from 10000 to 15000
        dropdownFound = true;
        console.log('✅ [STEP 10] Found payment dropdown');
        break;
      } catch (error) {
        if (attempt < 2) {
          console.log(`⚠️ [STEP 10] Payment dropdown not visible yet, retrying (${attempt + 1}/3)...`);
          await page.waitForTimeout(CRM_STABILITY_DELAY_MS);
          // Try refreshing the locator
          if (eventBookingIframeExists) {
            const iframe = page.frameLocator('#eventNewBooking2_iframe');
            paymentDropdown = iframe.locator('[data-onchange="jqx_chgPayWhen"]').first();
          } else {
            paymentDropdown = page.locator('[data-onchange="jqx_chgPayWhen"]').first();
          }
        } else {
          throw error;
        }
      }
    }
    
    if (!dropdownFound) {
      throw new Error('Payment dropdown not found after multiple attempts');
    }
    
    // Click on the dropdown to open it (same pattern as Contacts tab and location dropdown)
    progressCallback?.({ message: 'Opening payment options.' });
    console.log('💳 [STEP 10] Clicking payment dropdown to open...');
    // Try clicking the dropdown button first (more specific), then fallback to the container
    const dropdownButton = paymentDropdown.locator('[role="button"][aria-label="Select"], .dx-dropdowneditor-button').first();
    if (await dropdownButton.count() > 0) {
      await dropdownButton.click();
    } else {
      // Fallback: click on the dropdown container itself
      await paymentDropdown.click();
    }
    
    progressCallback?.({ message: 'Waiting for payment dropdown.' });
    console.log('⏳ [STEP 10] Waiting for payment dropdown menu to appear...');
    await waitForThenOptionalDelay(page, searchContext.locator('div.dx-list-item[role="option"]').first(), { state: 'visible', timeout: 5000, delayMs: CRM_STABILITY_DELAY_MS });

    await takeScreenshot(page, 'payment-dropdown-opened.png', screenshotsDir);

    const paymentOptions = searchContext.locator('div.dx-list-item[role="option"]');
    const optionCount = await paymentOptions.count();
    console.log(`📊 [STEP 10] Found ${optionCount} payment options in dropdown`);
    
    // Determine target option text based on paymentType
    let matchingOption = null;
    let targetOptionText;
    if (paymentType === 'none') {
      targetOptionText = 'No payment required';
    } else if (paymentType === 'request') {
      targetOptionText = 'Send a payment request';
    } else {
      targetOptionText = 'Take a payment now';
    }
    
    for (let i = 0; i < optionCount; i++) {
      const option = paymentOptions.nth(i);
      const optionText = await option.locator('.dx-item-content.dx-list-item-content').textContent();
      const optionTextTrimmed = optionText ? optionText.trim() : '';
      
      console.log(`   Option ${i + 1}: "${optionTextTrimmed}"`);
      
      // Check if option text matches target (exact match, case-insensitive)
      if (optionTextTrimmed.toLowerCase() === targetOptionText.toLowerCase()) {
        console.log(`✅ [STEP 10] Found matching payment option: "${optionTextTrimmed}"`);
        matchingOption = option;
        break;
      }
    }
    
    if (matchingOption) {
      // Check if it's visible, if not, scroll (same pattern as Contacts tab)
      const isMatchingOptionVisible = await matchingOption.isVisible();
      console.log(`🔍 [STEP 10] Matching option visible: ${isMatchingOptionVisible}`);
      
      if (!isMatchingOptionVisible) {
        console.log('🔍 [STEP 10] Matching option not visible, scrolling in dropdown...');
        
        // Scroll up in the dropdown menu to make option visible
        await page.keyboard.press('Home');
        await page.waitForTimeout(CRM_STABILITY_DELAY_MS);
        const dropdownMenu = searchContext.locator('[role="listbox"], .dx-dropdownlist, .dx-list, .dx-list-items').first();
        if (await dropdownMenu.count() > 0) {
          await dropdownMenu.evaluate(el => el.scrollTop = 0);
          await page.waitForTimeout(CRM_STABILITY_DELAY_MS);
        }
      }

      await matchingOption.waitFor({ state: 'visible', timeout: 5000 });
      console.log('💳 [STEP 10] Matching payment option is now visible, clicking...');
      await matchingOption.click();
      if (paymentType === 'now') {
        await searchContext.locator('[data-onchange="jqx_chgPaymentMethod"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      }
      await page.waitForTimeout(CRM_STABILITY_DELAY_MS);
      
      if (paymentType === 'now') {
        console.log('🔍 [STEP 10] Verifying payment option selection was applied...');
        const paymentMethodDropdown = searchContext.locator('[data-onchange="jqx_chgPaymentMethod"]').first();
        const isPaymentMethodVisible = await paymentMethodDropdown.isVisible({ timeout: 3000 }).catch(() => false);
        if (!isPaymentMethodVisible) {
          console.warn('⚠️ [STEP 10] Payment method dropdown not visible after selection - attempting retry...');
          await matchingOption.click();
          await searchContext.locator('[data-onchange="jqx_chgPaymentMethod"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
          // Check again
          const isPaymentMethodVisibleRetry = await paymentMethodDropdown.isVisible({ timeout: 3000 }).catch(() => false);
          if (!isPaymentMethodVisibleRetry) {
            console.error('❌ [STEP 10] Payment option selection verification failed - payment method dropdown still not visible');
          } else {
            console.log('✅ [STEP 10] Payment method dropdown appeared after retry - selection confirmed');
          }
        } else {
          console.log('✅ [STEP 10] Payment method dropdown appeared - selection confirmed');
        }
      } else if (paymentType === 'request') {
        console.log('✅ [STEP 10] Payment request option selected - payment method dropdown may not appear (expected)');
        
        // CRITICAL FIX: Wait for page transition to paymentRequestLink page
        // After clicking "Send a payment request", the page transitions from PaymentPage 
        // (eventNewBooking2_iframe) to paymentRequestLink page (contactSend3DSecureRequest_iframe)
        console.log('⏳ [STEP 10] Waiting for payment request link page...');
        try {
          await page.waitForSelector('#contactSend3DSecureRequest_iframe', { state: 'attached', timeout: 10000 });
          const paymentRequestIframe = page.frameLocator('#contactSend3DSecureRequest_iframe');
          await paymentRequestIframe.locator('body').first().waitFor({ state: 'attached', timeout: 5000 });
          console.log('✅ [STEP 10] Payment request link page loaded');
        } catch (e) {
          console.warn('⚠️ [STEP 10] Payment request page transition may not have completed');
        }
      }
      
      // Take screenshot after payment option selection
      await takeScreenshot(page, 'payment-option-selected.png', screenshotsDir);
      console.log('✅ [STEP 10] Payment option selected successfully');
    } else {
      console.log(`⚠️ [STEP 10] No matching payment option found for "${targetOptionText}"`);
      console.log(`⚠️ [STEP 10] Available options were checked, but none matched. Continuing without payment selection...`);
      // Close dropdown if it's still open (press Escape)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(CRM_STABILITY_DELAY_MS);
    }

  } catch (error) {
    console.error('Error in selectPaymentOption:', error);
    await takeScreenshot(page, 'payment-selection-error.png', screenshotsDir);
    // Don't throw error - allow workflow to continue even if payment selection fails
    console.log('⚠️ [STEP 10] Payment selection failed, but continuing workflow...');
  }
}

