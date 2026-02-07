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
    
    // CRITICAL FIX: Check for afterBooking_iframe FIRST (where confirmation page actually appears)
    // After booking completion, the confirmation page appears in afterBooking_iframe
    const afterBookingIframeExists = await page.locator('#afterBooking_iframe').count() > 0;
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    let searchContext = page;
    
    if (afterBookingIframeExists) {
      console.log('🔍 [SMS] Working with afterBooking_iframe (confirmation page)...');
      searchContext = page.frameLocator('#afterBooking_iframe');
    } else if (eventBookingIframeExists) {
      console.log('🔍 [SMS] Working with eventNewBooking2_iframe (fallback)...');
      searchContext = page.frameLocator('#eventNewBooking2_iframe');
    } else {
      console.log('🔍 [SMS] Working with main page...');
    }
    
    try {
      await stationeryHelpers.clickBackButton(page, searchContext);
      await takeScreenshot(page, 'back-clicked-sms.png', screenshotsDir);
    } catch (backErr) {
      console.log('⚠️ [SMS] Back button not found or not visible (may already be on menu):', backErr.message);
    }

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
    
    // CRITICAL FIX: After clicking "Send SMS", the page transitions to smsEdit_iframe
    // Step 12 (SMS preset selection, send message) must use smsEdit_iframe
    console.log('⏳ [SMS] Waiting for page transition to smsEdit_iframe...');
    let smsEditIframeExists = false;
    let smsSearchContext = searchContext; // Default to previous context as fallback
    
    // Check for smsEdit_iframe with retry logic
    for (let i = 0; i < 10; i++) {
      smsEditIframeExists = await page.locator('#smsEdit_iframe').count() > 0;
      if (smsEditIframeExists) {
        try {
          const smsEditIframe = page.frameLocator('#smsEdit_iframe');
          const testLocator = smsEditIframe.locator('body').first();
          await testLocator.waitFor({ state: 'attached', timeout: 3000 });
          console.log('✅ [SMS] Found smsEdit_iframe (SMS editing page)');
          smsSearchContext = smsEditIframe;
          break;
        } catch (iframeError) {
          console.log(`⚠️ [SMS] SmsEdit iframe detected but not loaded yet, retrying (${i + 1}/10)...`);
          if (i < 9) await page.waitForTimeout(2000);
        }
      } else {
        if (i < 9) {
          console.log(`⏳ [SMS] SmsEdit iframe not found, retrying (${i + 1}/10)...`);
          await page.waitForTimeout(2000);
        }
      }
    }
    
    if (!smsEditIframeExists) {
      console.log('⚠️ [SMS] SmsEdit iframe not found after 10 attempts, using previous context as fallback');
    }
    
    await takeScreenshot(page, 'sms-page-loaded.png', screenshotsDir);
    
    // Fill "Send To" input field with phone number
    console.log('📱 [SMS] Filling "Send To" field with: 07833913454');
    try {
      // Locate the "Send To" input field using multiple selector strategies
      const sendToInput = smsSearchContext.locator('#smm_mobile_number input').first();
      
      // Wait for input field to be visible/attached
      await sendToInput.waitFor({ state: 'visible', timeout: 5000 });
      
      // Clear any existing value and fill with new number
      await sendToInput.fill('07833913454');
      await page.waitForTimeout(500);
      
      // Verify the value was set correctly
      const inputValue = await sendToInput.inputValue();
      if (inputValue === '07833913454') {
        console.log('✅ [SMS] "Send To" field filled successfully');
      } else {
        console.log(`⚠️ [SMS] "Send To" field value mismatch. Expected: 07833913454, Got: ${inputValue}`);
      }
    } catch (error) {
      console.error('❌ [SMS] Error filling "Send To" field:', error.message);
      // Continue execution - don't fail the entire process if this step fails
      console.log('⚠️ [SMS] Continuing with preset selection despite "Send To" field error');
    }
    
    // Determine preset template name based on course type using helper function
    const presetTemplateName = stationeryHelpers.getSMSPresetTemplateName(courseType);
    console.log(`🔍 [SMS] Looking for preset template: "${presetTemplateName}"`);
    
    // Select the SMS preset template (using smsEdit_iframe context)
    await stationeryHelpers.selectSMSPreset(page, smsSearchContext, presetTemplateName);
    
    await takeScreenshot(page, 'preset-selected.png', screenshotsDir);
    
    // Click Send message button (using smsEdit_iframe context)
    await stationeryHelpers.clickSendMessageButton(page, smsSearchContext);
    
    await takeScreenshot(page, 'sms-sent.png', screenshotsDir);
    console.log('✅ [SMS] SMS confirmation sent successfully');
    
  } catch (error) {
    console.error('❌ [SMS] Error sending SMS confirmation:', error);
    await takeScreenshot(page, 'sms-error.png', screenshotsDir);
    throw new Error(`Failed to send SMS confirmation: ${error.message}`);
  }
}

