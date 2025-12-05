import { takeScreenshot } from './utils.js';

/**
 * Step 11: Select payment method - "Mastercard"
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 */
export async function selectPaymentMethod(page, screenshotsDir) {
  try {
    console.log('💳 [STEP 11] Selecting payment method...');
    
    // Wait for payment method dropdown to be available
    console.log('⏳ [STEP 11] Waiting for payment method dropdown to be available...');
    await page.waitForTimeout(1000);
    
    // Determine if we need to work with iframe or main page (same pattern as payment option dropdown)
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    let paymentMethodDropdown;
    let searchContext;
    
    if (eventBookingIframeExists) {
      console.log('🔍 [STEP 11] Working with eventNewBooking2_iframe for payment method dropdown...');
      const iframe = page.frameLocator('#eventNewBooking2_iframe');
      paymentMethodDropdown = iframe.locator('[data-onchange="jqx_chgPaymentMethod"]').first();
      searchContext = iframe;
    } else {
      console.log('🔍 [STEP 11] Working with main page for payment method dropdown...');
      paymentMethodDropdown = page.locator('[data-onchange="jqx_chgPaymentMethod"]').first();
      searchContext = page;
    }
    
    // Wait for dropdown to be visible
    await paymentMethodDropdown.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ [STEP 11] Found payment method dropdown');
    
    // Click on the dropdown to open it (same pattern as other dropdowns)
    console.log('💳 [STEP 11] Clicking payment method dropdown to open...');
    // Try clicking the dropdown button first (more specific), then fallback to the container
    const dropdownButton = paymentMethodDropdown.locator('[role="button"][aria-label="Select"], .dx-dropdowneditor-button').first();
    if (await dropdownButton.count() > 0) {
      await dropdownButton.click();
    } else {
      // Fallback: click on the dropdown container itself
      await paymentMethodDropdown.click();
    }
    
    // WAIT FOR DROPDOWN MENU TO APPEAR - 2 seconds (same as other dropdowns)
    console.log('⏳ [STEP 11] Waiting for payment method dropdown menu to appear...');
    await page.waitForTimeout(2000);
    
    // Take screenshot of opened dropdown
    await takeScreenshot(page, 'payment-method-dropdown-opened.png', screenshotsDir);
    
    // Find all payment method options in the dropdown (same pattern as other dropdowns)
    // Options are in: .dx-list-item[role="option"] with text in .dx-item-content.dx-list-item-content
    const paymentMethodOptions = searchContext.locator('div.dx-list-item[role="option"]');
    const optionCount = await paymentMethodOptions.count();
    console.log(`📊 [STEP 11] Found ${optionCount} payment method options in dropdown`);
    
    // Find matching option - "Mastercard"
    let matchingOption = null;
    const targetOptionText = 'Mastercard';
    
    for (let i = 0; i < optionCount; i++) {
      const option = paymentMethodOptions.nth(i);
      const optionText = await option.locator('.dx-item-content.dx-list-item-content').textContent();
      const optionTextTrimmed = optionText ? optionText.trim() : '';
      
      console.log(`   Option ${i + 1}: "${optionTextTrimmed}"`);
      
      // Check if option text matches "Mastercard" (exact match)
      if (optionTextTrimmed === targetOptionText) {
        console.log(`✅ [STEP 11] Found matching payment method option: "${optionTextTrimmed}"`);
        matchingOption = option;
        break;
      }
    }
    
    if (matchingOption) {
      // Check if it's visible, if not, scroll (same pattern as other dropdowns)
      const isMatchingOptionVisible = await matchingOption.isVisible();
      console.log(`🔍 [STEP 11] Matching option visible: ${isMatchingOptionVisible}`);
      
      if (!isMatchingOptionVisible) {
        console.log('🔍 [STEP 11] Matching option not visible, scrolling in dropdown...');
        
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
      console.log('💳 [STEP 11] Matching payment method option is now visible, clicking...');
      await matchingOption.click();
      
      // WAIT FOR PAYMENT METHOD SELECTION TO BE APPLIED - 2 seconds (same as other dropdowns)
      console.log('⏳ [STEP 11] Waiting for payment method selection...');
      await page.waitForTimeout(2000);
      
      // Take screenshot after payment method selection
      await takeScreenshot(page, 'payment-method-selected.png', screenshotsDir);
      console.log('✅ [STEP 11] Payment method selected successfully');
    } else {
      console.log(`⚠️ [STEP 11] No matching payment method option found for "${targetOptionText}"`);
      console.log(`⚠️ [STEP 11] Available options were checked, but none matched. Continuing without payment method selection...`);
      // Close dropdown if it's still open (press Escape)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
    
  } catch (error) {
    console.error('Error in selectPaymentMethod:', error);
    await takeScreenshot(page, 'payment-method-selection-error.png', screenshotsDir);
    // Don't throw error - allow workflow to continue even if payment method selection fails
    console.log('⚠️ [STEP 11] Payment method selection failed, but continuing workflow...');
  }
}

