import { takeScreenshot } from './utils.js';
import * as stationeryHelpers from './stationeryHelpers.js';

/**
 * Send booking confirmation email after booking is completed
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} courseType - Course type enum value (e.g., 'Introduction to Motorcycling', 'Compulsory Basic Training', etc.)
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @param {string|null} [location] - Raw location string from sessionDetails (used for CBT site-specific template)
 */
export async function sendBookingConfirmationEmail(page, screenshotsDir, courseType = 'Introduction to Motorcycling', progressCallback = null, location = null) {
  try {
    progressCallback?.({ message: 'Preparing your confirmation.' });
    console.log('📧 [CONFIRMATION] Sending booking confirmation email...');
    
    // Wait for page to be ready after booking completion
    await page.waitForTimeout(3000);
    
    // CRITICAL FIX: Check for afterBooking_iframe FIRST (where confirmation page actually appears)
    // After booking completion, the confirmation page appears in afterBooking_iframe
    const afterBookingIframeExists = await page.locator('#afterBooking_iframe').count() > 0;
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    let searchContext = page;
    
    if (afterBookingIframeExists) {
      console.log('🔍 [CONFIRMATION] Working with afterBooking_iframe (confirmation page)...');
      searchContext = page.frameLocator('#afterBooking_iframe');
    } else if (eventBookingIframeExists) {
      console.log('🔍 [CONFIRMATION] Working with eventNewBooking2_iframe (fallback)...');
      searchContext = page.frameLocator('#eventNewBooking2_iframe');
    } else {
      console.log('🔍 [CONFIRMATION] Working with main page...');
    }
    
    // Find and click "Send a confirmation" button
    const sendConfirmationButton = await stationeryHelpers.findSendConfirmationButton(page, searchContext);
    
    progressCallback?.({ message: 'Sending your confirmation now.' });
    // Click the list item - handle hidden elements
    console.log('🖱️ [CONFIRMATION] Clicking "Send a confirmation" list item...');
    try {
      // Try to scroll list item into view
      await sendConfirmationButton.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      
      // Check if list item is visible
      const isVisible = await sendConfirmationButton.isVisible().catch(() => false);
      
      if (isVisible) {
        // List item is visible, click normally
        await sendConfirmationButton.click({ timeout: 5000 });
        console.log('✅ [CONFIRMATION] Clicked list item (visible)');
      } else {
        // List item is hidden, use force click
        console.log('⚠️ [CONFIRMATION] List item is hidden, using force click');
        await sendConfirmationButton.click({ force: true, timeout: 5000 });
        console.log('✅ [CONFIRMATION] Clicked list item (force)');
      }
    } catch (clickErr) {
      // Fallback: try force click if normal click fails
      console.log('⚠️ [CONFIRMATION] Normal click failed, trying force click...');
      await sendConfirmationButton.click({ force: true, timeout: 5000 });
      console.log('✅ [CONFIRMATION] Clicked list item (force fallback)');
    }
    await page.waitForTimeout(2000);
    
    // CRITICAL FIX: After clicking "Send a confirmation", the page transitions to stationerySender_iframe
    // Steps 10-11 (template selection, preview, email) must use stationerySender_iframe
    console.log('⏳ [CONFIRMATION] Waiting for page transition to stationerySender_iframe...');
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
          console.log('✅ [CONFIRMATION] Found stationerySender_iframe (stationery selection page)');
          stationerySearchContext = stationerySenderIframe;
          break;
        } catch (iframeError) {
          console.log(`⚠️ [CONFIRMATION] StationerySender iframe detected but not loaded yet, retrying (${i + 1}/10)...`);
          if (i < 9) await page.waitForTimeout(2000);
        }
      } else {
        if (i < 9) {
          console.log(`⏳ [CONFIRMATION] StationerySender iframe not found, retrying (${i + 1}/10)...`);
          await page.waitForTimeout(2000);
        }
      }
    }
    
    if (!stationerySenderIframeExists) {
      console.log('⚠️ [CONFIRMATION] StationerySender iframe not found after 10 attempts, using previous context as fallback');
    }
    
    // Wait for "Pick an item of stationary" page
    console.log('⏳ [CONFIRMATION] Waiting for stationary selection page...');
    await page.waitForTimeout(2000);
    
    // Check for "Pick an item of stationary" text in the new iframe context
    const stationaryPageIndicator = stationerySearchContext.locator('text=/Pick an item of stationary/i, text=/stationary/i').first();
    const pageLoaded = await stationaryPageIndicator.count() > 0;
    if (!pageLoaded) {
      console.log('⚠️ [CONFIRMATION] Stationary page indicator not immediately visible, continuing...');
    }
    
    await takeScreenshot(page, 'stationary-page-loaded.png', screenshotsDir);
    
    // Determine template name based on course type (and location for CBT site-specific templates)
    const templateName = stationeryHelpers.getConfirmationTemplateName(courseType, location);
    console.log(`🔍 [CONFIRMATION] Looking for template: "${templateName}" (courseType="${courseType}", location="${location || 'none'}")`);
    
    // Select the stationery template (using stationerySender_iframe context)
    await stationeryHelpers.selectStationeryTemplate(page, stationerySearchContext, templateName);
    
    await takeScreenshot(page, 'template-selected.png', screenshotsDir);
    
    // Click Preview button (using stationerySender_iframe context)
    await stationeryHelpers.clickPreviewButton(page, stationerySearchContext);
    
    await takeScreenshot(page, 'preview-shown.png', screenshotsDir);
    
    // Click Email button (using stationerySender_iframe context)
    await stationeryHelpers.clickEmailButton(page, stationerySearchContext);
    
    // Wait for email sent confirmation (using stationerySender_iframe context)
    await stationeryHelpers.waitForEmailSentConfirmation(page, stationerySearchContext);
    
    await takeScreenshot(page, 'email-sent-confirmation.png', screenshotsDir);
    console.log('✅ [CONFIRMATION] Booking confirmation email sent successfully');
    
    // Click Back button to return to afterBooking_iframe
    // This ensures Step 11 starts in the correct iframe context
    console.log('🔙 [CONFIRMATION] Clicking back button to return to afterBooking_iframe...');
    await stationeryHelpers.clickBackButton(page, stationerySearchContext);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'back-to-after-booking-menu.png', screenshotsDir);
    console.log('✅ [CONFIRMATION] Returned to afterBooking_iframe - Step 10 complete');
    
  } catch (error) {
    console.error('❌ [CONFIRMATION] Error sending booking confirmation email:', error);
    await takeScreenshot(page, 'confirmation-email-error.png', screenshotsDir);
    throw new Error(`Failed to send booking confirmation email: ${error.message}`);
  }
}

