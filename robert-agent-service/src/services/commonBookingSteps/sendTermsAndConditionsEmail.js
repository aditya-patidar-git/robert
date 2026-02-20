import { takeScreenshot } from './utils.js';
import * as stationeryHelpers from './stationeryHelpers.js';

/**
 * Send Terms & Conditions email after booking confirmation email
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 */
export async function sendTermsAndConditionsEmail(page, screenshotsDir, progressCallback = null) {
  try {
    progressCallback?.({ message: 'Preparing the terms.' });
    console.log('📧 [T&C] Sending Terms & Conditions email...');
    
    // Wait for page to be ready
    await page.waitForTimeout(2000);
    
    // CRITICAL FIX: Check for afterBooking_iframe FIRST (where confirmation page actually appears)
    // After Step 10 completes, it returns to afterBooking_iframe
    const afterBookingIframeExists = await page.locator('#afterBooking_iframe').count() > 0;
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    let searchContext = page;
    
    if (afterBookingIframeExists) {
      console.log('🔍 [T&C] Working with afterBooking_iframe (confirmation page)...');
      searchContext = page.frameLocator('#afterBooking_iframe');
    } else if (eventBookingIframeExists) {
      console.log('🔍 [T&C] Working with eventNewBooking2_iframe (fallback)...');
      searchContext = page.frameLocator('#eventNewBooking2_iframe');
    } else {
      console.log('🔍 [T&C] Working with main page...');
    }
    
    // Find and click "Send a confirmation" button
    const sendConfirmationButton = await stationeryHelpers.findSendConfirmationButton(page, searchContext);
    
    progressCallback?.({ message: 'Sending the terms now.' });
    // Click the list item - handle hidden elements
    console.log('🖱️ [T&C] Clicking "Send a confirmation" list item...');
    try {
      // Try to scroll list item into view
      await sendConfirmationButton.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      
      // Check if list item is visible
      const isVisible = await sendConfirmationButton.isVisible().catch(() => false);
      
      if (isVisible) {
        // List item is visible, click normally
        await sendConfirmationButton.click({ timeout: 5000 });
        console.log('✅ [T&C] Clicked list item (visible)');
      } else {
        // List item is hidden, use force click
        console.log('⚠️ [T&C] List item is hidden, using force click');
        await sendConfirmationButton.click({ force: true, timeout: 5000 });
        console.log('✅ [T&C] Clicked list item (force)');
      }
    } catch (clickErr) {
      // Fallback: try force click if normal click fails
      console.log('⚠️ [T&C] Normal click failed, trying force click...');
      await sendConfirmationButton.click({ force: true, timeout: 5000 });
      console.log('✅ [T&C] Clicked list item (force fallback)');
    }
    await page.waitForTimeout(2000);
    
    // CRITICAL FIX: After clicking "Send a confirmation", the page transitions to stationerySender_iframe
    // Template selection, preview, email must use stationerySender_iframe
    console.log('⏳ [T&C] Waiting for page transition to stationerySender_iframe...');
    let stationerySenderIframeExists = false;
    let stationerySearchContext = searchContext; // Default to previous context as fallback
    
    // Check for stationerySender_iframe with retry logic
    for (let i = 0; i < 10; i++) {
      stationerySenderIframeExists = await page.locator('#stationerySender_iframe').count() > 0;
      if (stationerySenderIframeExists) {
        try {
          const stationerySenderIframe = page.frameLocator('#stationerySender_iframe');
          const testLocator = stationerySenderIframe.locator('body').first();
          await testLocator.waitFor({ state: 'attached', timeout: 3000 });
          console.log('✅ [T&C] Found stationerySender_iframe (stationery selection page)');
          stationerySearchContext = stationerySenderIframe;
          break;
        } catch (iframeError) {
          console.log(`⚠️ [T&C] StationerySender iframe detected but not loaded yet, retrying (${i + 1}/10)...`);
          if (i < 9) await page.waitForTimeout(2000);
        }
      } else {
        if (i < 9) {
          console.log(`⏳ [T&C] StationerySender iframe not found, retrying (${i + 1}/10)...`);
          await page.waitForTimeout(2000);
        }
      }
    }
    
    if (!stationerySenderIframeExists) {
      console.log('⚠️ [T&C] StationerySender iframe not found after 10 attempts, using previous context as fallback');
    }
    
    // Wait for "Pick an item of stationary" page
    console.log('⏳ [T&C] Waiting for stationary selection page...');
    await page.waitForTimeout(2000);
    
    // Check for "Pick an item of stationary" text in the new iframe context
    const stationaryPageIndicator = stationerySearchContext.locator('text=/Pick an item of stationary/i, text=/stationary/i').first();
    const pageLoaded = await stationaryPageIndicator.count() > 0;
    if (!pageLoaded) {
      console.log('⚠️ [T&C] Stationary page indicator not immediately visible, continuing...');
    }
    
    await takeScreenshot(page, 'stationary-page-loaded-tc.png', screenshotsDir);
    
    // Find "Terms & Conditions" template
    const templateName = 'Terms & Conditions';
    console.log(`🔍 [T&C] Looking for template: "${templateName}"`);
    
    // Select the stationery template (using stationerySender_iframe context)
    await stationeryHelpers.selectStationeryTemplate(page, stationerySearchContext, templateName);
    
    await takeScreenshot(page, 'template-selected-tc.png', screenshotsDir);
    
    // Click Preview button (using stationerySender_iframe context)
    await stationeryHelpers.clickPreviewButton(page, stationerySearchContext);
    
    await takeScreenshot(page, 'preview-shown-tc.png', screenshotsDir);
    
    // Click Email button (using stationerySender_iframe context)
    await stationeryHelpers.clickEmailButton(page, stationerySearchContext);
    
    // Wait for email sent confirmation (using stationerySender_iframe context)
    await stationeryHelpers.waitForEmailSentConfirmation(page, stationerySearchContext);
    
    await takeScreenshot(page, 'email-sent-confirmation-tc.png', screenshotsDir);
    console.log('✅ [T&C] Terms & Conditions email sent successfully');
    
    // Click Back button to return to afterBooking_iframe
    // This ensures Step 12 starts in the correct iframe context
    console.log('🔙 [T&C] Clicking back button to return to afterBooking_iframe...');
    await stationeryHelpers.clickBackButton(page, stationerySearchContext);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'back-to-after-booking-menu-tc.png', screenshotsDir);
    console.log('✅ [T&C] Returned to afterBooking_iframe - Step 11 complete');
    
  } catch (error) {
    console.error('❌ [T&C] Error sending Terms & Conditions email:', error);
    await takeScreenshot(page, 'terms-email-error.png', screenshotsDir);
    throw new Error(`Failed to send Terms & Conditions email: ${error.message}`);
  }
}

