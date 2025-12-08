import { takeScreenshot } from './utils.js';

/**
 * Step 10: Select payment option
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} paymentType - Payment type: 'now' (default) for "Take a payment now", 'none' for "No payment required"
 */
export async function selectPaymentOption(page, screenshotsDir, paymentType = 'now') {
  try {
    console.log(`💳 [STEP 10] Selecting payment option (type: ${paymentType})...`);
    
    // Wait for payment page to load
    console.log('⏳ [STEP 10] Waiting for payment page to load...');
    await page.waitForTimeout(3000);
    
    // Check for "Confirm and Pay" page indicator
    console.log('🔍 [STEP 10] Checking for Confirm and Pay page...');
    const confirmPayHeader = page.locator('text=/Confirm and Pay/i, text=/4. Pay/i, text=/Payment/i').first();
    const headerExists = await confirmPayHeader.count() > 0;
    
    if (!headerExists) {
      console.log('⚠️ [STEP 10] Confirm and Pay page not immediately visible, continuing...');
    }
    
    // Determine if we need to work with iframe or main page (same pattern as location dropdown)
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    let paymentDropdown;
    let searchContext;
    
    if (eventBookingIframeExists) {
      console.log('🔍 [STEP 10] Working with eventNewBooking2_iframe for payment dropdown...');
      const iframe = page.frameLocator('#eventNewBooking2_iframe');
      paymentDropdown = iframe.locator('[data-onchange="jqx_chgPayWhen"]').first();
      searchContext = iframe;
    } else {
      console.log('🔍 [STEP 10] Working with main page for payment dropdown...');
      paymentDropdown = page.locator('[data-onchange="jqx_chgPayWhen"]').first();
      searchContext = page;
    }
    
    // Wait for dropdown to be visible
    await paymentDropdown.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ [STEP 10] Found payment dropdown');
    
    // Click on the dropdown to open it (same pattern as Contacts tab and location dropdown)
    console.log('💳 [STEP 10] Clicking payment dropdown to open...');
    // Try clicking the dropdown button first (more specific), then fallback to the container
    const dropdownButton = paymentDropdown.locator('[role="button"][aria-label="Select"], .dx-dropdowneditor-button').first();
    if (await dropdownButton.count() > 0) {
      await dropdownButton.click();
    } else {
      // Fallback: click on the dropdown container itself
      await paymentDropdown.click();
    }
    
    // WAIT FOR DROPDOWN MENU TO APPEAR - 2 seconds (same as Contacts tab pattern)
    console.log('⏳ [STEP 10] Waiting for payment dropdown menu to appear...');
    await page.waitForTimeout(2000);
    
    // Take screenshot of opened dropdown
    await takeScreenshot(page, 'payment-dropdown-opened.png', screenshotsDir);
    
    // Find all payment options in the dropdown (same pattern as location dropdown)
    // Options are in: .dx-list-item[role="option"] with text in .dx-item-content.dx-list-item-content
    const paymentOptions = searchContext.locator('div.dx-list-item[role="option"]');
    const optionCount = await paymentOptions.count();
    console.log(`📊 [STEP 10] Found ${optionCount} payment options in dropdown`);
    
    // Determine target option text based on paymentType
    let matchingOption = null;
    const targetOptionText = paymentType === 'none' ? 'No payment required' : 'Take a payment now';
    
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
        await page.keyboard.press('Home'); // Go to top of dropdown
        await page.waitForTimeout(1000);
        
        // Alternative: try to scroll the dropdown container
        const dropdownMenu = searchContext.locator('[role="listbox"], .dx-dropdownlist, .dx-list, .dx-list-items').first();
        if (await dropdownMenu.count() > 0) {
          await dropdownMenu.evaluate(el => el.scrollTop = 0);
          await page.waitForTimeout(1000);
        }
      }
      
      // Now try to find and click the matching option
      await matchingOption.waitFor({ state: 'visible', timeout: 5000 });
      console.log('💳 [STEP 10] Matching payment option is now visible, clicking...');
      await matchingOption.click();
      
      // WAIT FOR PAYMENT OPTION SELECTION TO BE APPLIED - 2 seconds (same as Contacts tab)
      console.log('⏳ [STEP 10] Waiting for payment option selection...');
      await page.waitForTimeout(2000);
      
      // Take screenshot after payment option selection
      await takeScreenshot(page, 'payment-option-selected.png', screenshotsDir);
      console.log('✅ [STEP 10] Payment option selected successfully');
    } else {
      console.log(`⚠️ [STEP 10] No matching payment option found for "${targetOptionText}"`);
      console.log(`⚠️ [STEP 10] Available options were checked, but none matched. Continuing without payment selection...`);
      // Close dropdown if it's still open (press Escape)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
    
  } catch (error) {
    console.error('Error in selectPaymentOption:', error);
    await takeScreenshot(page, 'payment-selection-error.png', screenshotsDir);
    // Don't throw error - allow workflow to continue even if payment selection fails
    console.log('⚠️ [STEP 10] Payment selection failed, but continuing workflow...');
  }
}

