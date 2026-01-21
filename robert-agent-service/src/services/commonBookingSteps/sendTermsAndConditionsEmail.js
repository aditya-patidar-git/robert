import { takeScreenshot } from './utils.js';
import * as stationeryHelpers from './stationeryHelpers.js';

/**
 * Send Terms & Conditions email after booking confirmation email
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 */
export async function sendTermsAndConditionsEmail(page, screenshotsDir) {
  try {
    console.log('📧 [T&C] Sending Terms & Conditions email...');
    
    // Wait for page to be ready
    await page.waitForTimeout(2000);
    
    // Determine if we need to work with iframe or main page
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    let searchContext = page;
    
    if (eventBookingIframeExists) {
      console.log('🔍 [T&C] Working with eventNewBooking2_iframe...');
      searchContext = page.frameLocator('#eventNewBooking2_iframe');
    } else {
      console.log('🔍 [T&C] Working with main page...');
    }
    
    // Click Back button
    await stationeryHelpers.clickBackButton(page, searchContext);
    
    await takeScreenshot(page, 'back-clicked.png', screenshotsDir);
    
    // Find and click "Send a confirmation" button
    const sendConfirmationButton = await stationeryHelpers.findSendConfirmationButton(page, searchContext);
    
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
    
    // Wait for "Pick an item of stationary" page
    console.log('⏳ [T&C] Waiting for stationary selection page...');
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, 'stationary-page-loaded-tc.png', screenshotsDir);
    
    // Find "Terms & Conditions" template
    const templateName = 'Terms & Conditions';
    console.log(`🔍 [T&C] Looking for template: "${templateName}"`);
    
    // Select the stationery template
    await stationeryHelpers.selectStationeryTemplate(page, searchContext, templateName);
    
    await takeScreenshot(page, 'template-selected-tc.png', screenshotsDir);
    
    // Click Preview button
    await stationeryHelpers.clickPreviewButton(page, searchContext);
    
    await takeScreenshot(page, 'preview-shown-tc.png', screenshotsDir);
    
    // Click Email button
    await stationeryHelpers.clickEmailButton(page, searchContext);
    
    // Wait for email sent confirmation
    await stationeryHelpers.waitForEmailSentConfirmation(page, searchContext);
    
    await takeScreenshot(page, 'email-sent-confirmation-tc.png', screenshotsDir);
    console.log('✅ [T&C] Terms & Conditions email sent successfully');
    
  } catch (error) {
    console.error('❌ [T&C] Error sending Terms & Conditions email:', error);
    await takeScreenshot(page, 'terms-email-error.png', screenshotsDir);
    throw new Error(`Failed to send Terms & Conditions email: ${error.message}`);
  }
}

