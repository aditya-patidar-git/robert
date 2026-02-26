import { takeScreenshot } from './utils.js';
import * as stationeryHelpers from './stationeryHelpers.js';

/**
 * Send SMS confirmation after booking is completed
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} courseType - Course type enum value (can be simplified format like 'tfl-one-to-one' or full enum like 'ITM', 'CBT', etc.)
 * @param {string|null} clientMobile - Optional client mobile number (from stored client details); when form and this are empty, returns requiresClientMobile so agent asks caller
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<{success: boolean, smsSent?: boolean, requiresClientMobile?: boolean, message?: string, instruction?: string}>}
 */
export async function sendSMSConfirmation(page, screenshotsDir, courseType = 'tfl-one-to-one', clientMobile = null, progressCallback = null) {
  try {
    progressCallback?.({ message: 'Preparing the SMS.' });
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
    
    progressCallback?.({ message: 'Sending the SMS now.' });
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
    
    // Fill "Send To" input field: use existing value, or stored client mobile, or ask caller if both empty
    try {
      const sendToInput = smsSearchContext.locator('#smm_mobile_number input').first();
      await sendToInput.waitFor({ state: 'visible', timeout: 5000 });
      const currentValue = (await sendToInput.inputValue())?.trim() ?? '';
      if (currentValue) {
        console.log(`📱 [SMS] "Send To" field already has value: ${currentValue}`);
      } else if (clientMobile?.trim()) {
        await sendToInput.fill(clientMobile.trim());
        await page.waitForTimeout(500);
        console.log(`📱 [SMS] Filled "Send To" from stored client mobile: ${clientMobile.trim()}`);
      } else {
        console.log('📱 [SMS] "Send To" field empty and no client mobile—ask caller for number');
        return {
          success: false,
          requiresClientMobile: true,
          message: 'I need the mobile number to send the SMS confirmation to.',
          instruction: 'Ask the caller: "What mobile number should I send the SMS confirmation to?" When they give it, call **booking_step_send_sms** again with the same courseType and workflowType and **customerMobile** set to the number they said. Do not use a different tool.'
        };
      }
    } catch (error) {
      console.error('❌ [SMS] Error filling "Send To" field:', error.message);
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
    return { success: true, smsSent: true };
  } catch (error) {
    console.error('❌ [SMS] Error sending SMS confirmation:', error);
    await takeScreenshot(page, 'sms-error.png', screenshotsDir);
    throw new Error(`Failed to send SMS confirmation: ${error.message}`);
  }
}

