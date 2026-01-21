import { takeScreenshot } from './utils.js';
import * as stationeryHelpers from './stationeryHelpers.js';

/**
 * Send SMS confirmation after booking is completed
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} courseType - Course type enum value (can be simplified format like 'tfl-one-to-one' or full enum like 'ITM', 'CBT', etc.)
 */
export async function sendSMSConfirmation(page, screenshotsDir, courseType = 'tfl-one-to-one') {
  try {
    console.log('📱 [SMS] Sending SMS confirmation...');
    
    // Wait for page to be ready
    await page.waitForTimeout(2000);
    
    // Determine if we need to work with iframe or main page
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    let searchContext = page;
    
    if (eventBookingIframeExists) {
      console.log('🔍 [SMS] Working with eventNewBooking2_iframe...');
      searchContext = page.frameLocator('#eventNewBooking2_iframe');
    } else {
      console.log('🔍 [SMS] Working with main page...');
    }
    
    // Click Back button (reuse existing helper)
    await stationeryHelpers.clickBackButton(page, searchContext);
    
    await takeScreenshot(page, 'back-clicked-sms.png', screenshotsDir);
    
    // Find and click "Send SMS" button
    const sendSMSButton = await stationeryHelpers.findSendSMSButton(page, searchContext);
    
    // Click the list item - handle hidden elements
    console.log('🖱️ [SMS] Clicking "Send SMS" list item...');
    try {
      // Try to scroll list item into view
      await sendSMSButton.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      
      // Check if list item is visible
      const isVisible = await sendSMSButton.isVisible().catch(() => false);
      
      if (isVisible) {
        // List item is visible, click normally
        await sendSMSButton.click({ timeout: 5000 });
        console.log('✅ [SMS] Clicked list item (visible)');
      } else {
        // List item is hidden, use force click
        console.log('⚠️ [SMS] List item is hidden, using force click');
        await sendSMSButton.click({ force: true, timeout: 5000 });
        console.log('✅ [SMS] Clicked list item (force)');
      }
    } catch (clickErr) {
      // Fallback: try force click if normal click fails
      console.log('⚠️ [SMS] Normal click failed, trying force click...');
      await sendSMSButton.click({ force: true, timeout: 5000 });
      console.log('✅ [SMS] Clicked list item (force fallback)');
    }
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, 'sms-page-loaded.png', screenshotsDir);
    
    // Determine preset template name based on course type using helper function
    const presetTemplateName = stationeryHelpers.getSMSPresetTemplateName(courseType);
    console.log(`🔍 [SMS] Looking for preset template: "${presetTemplateName}"`);
    
    // Select the SMS preset template
    await stationeryHelpers.selectSMSPreset(page, searchContext, presetTemplateName);
    
    await takeScreenshot(page, 'preset-selected.png', screenshotsDir);
    
    // Click Send message button
    await stationeryHelpers.clickSendMessageButton(page, searchContext);
    
    await takeScreenshot(page, 'sms-sent.png', screenshotsDir);
    console.log('✅ [SMS] SMS confirmation sent successfully');
    
  } catch (error) {
    console.error('❌ [SMS] Error sending SMS confirmation:', error);
    await takeScreenshot(page, 'sms-error.png', screenshotsDir);
    throw new Error(`Failed to send SMS confirmation: ${error.message}`);
  }
}

