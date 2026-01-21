import { takeScreenshot } from './utils.js';
import * as stationeryHelpers from './stationeryHelpers.js';

/**
 * Send booking confirmation email after booking is completed
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} courseType - Course type enum value (e.g., 'ITM', 'Introduction to Motorcycling', 'CBT', 'TfL 1-2-1', etc.)
 */
export async function sendBookingConfirmationEmail(page, screenshotsDir, courseType = 'tfl') {
  try {
    console.log('📧 [CONFIRMATION] Sending booking confirmation email...');
    
    // Wait for page to be ready after booking completion
    await page.waitForTimeout(3000);
    
    // Determine if we need to work with iframe or main page
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    let searchContext = page;
    
    if (eventBookingIframeExists) {
      console.log('🔍 [CONFIRMATION] Working with eventNewBooking2_iframe...');
      searchContext = page.frameLocator('#eventNewBooking2_iframe');
    } else {
      console.log('🔍 [CONFIRMATION] Working with main page...');
    }
    
    // Find and click "Send a confirmation" button
    const sendConfirmationButton = await stationeryHelpers.findSendConfirmationButton(page, searchContext);
    
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
    
    // Wait for "Pick an item of stationary" page
    console.log('⏳ [CONFIRMATION] Waiting for stationary selection page...');
    await page.waitForTimeout(2000);
    
    // Check for "Pick an item of stationary" text
    const stationaryPageIndicator = searchContext.locator('text=/Pick an item of stationary/i, text=/stationary/i').first();
    const pageLoaded = await stationaryPageIndicator.count() > 0;
    if (!pageLoaded) {
      console.log('⚠️ [CONFIRMATION] Stationary page indicator not immediately visible, continuing...');
    }
    
    await takeScreenshot(page, 'stationary-page-loaded.png', screenshotsDir);
    
    // Determine template name based on course type using helper function
    const templateName = stationeryHelpers.getConfirmationTemplateName(courseType);
    console.log(`🔍 [CONFIRMATION] Looking for template: "${templateName}"`);
    
    // Select the stationery template
    await stationeryHelpers.selectStationeryTemplate(page, searchContext, templateName);
    
    await takeScreenshot(page, 'template-selected.png', screenshotsDir);
    
    // Click Preview button
    await stationeryHelpers.clickPreviewButton(page, searchContext);
    
    await takeScreenshot(page, 'preview-shown.png', screenshotsDir);
    
    // Click Email button
    await stationeryHelpers.clickEmailButton(page, searchContext);
    
    // Wait for email sent confirmation
    await stationeryHelpers.waitForEmailSentConfirmation(page, searchContext);
    
    await takeScreenshot(page, 'email-sent-confirmation.png', screenshotsDir);
    console.log('✅ [CONFIRMATION] Booking confirmation email sent successfully');
    
  } catch (error) {
    console.error('❌ [CONFIRMATION] Error sending booking confirmation email:', error);
    await takeScreenshot(page, 'confirmation-email-error.png', screenshotsDir);
    throw new Error(`Failed to send booking confirmation email: ${error.message}`);
  }
}

