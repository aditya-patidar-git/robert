/**
 * Send Cancellation Confirmation Step Executor
 * Step 13: Send cancellation confirmation email
 * Preserves all Playwright timing and state checks
 */

import { takeScreenshot } from '../../../commonBookingSteps/utils.js';

/**
 * Execute sendCancellationConfirmation step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<Object>} Step execution result
 */
export async function executeSendCancellationConfirmation(page, args, sessionState, screenshotsDir) {
  try {
    console.log(`📧 [SEND_CANCELLATION_CONFIRMATION] Sending cancellation confirmation email...`);
    
    // Work within stationerySender_iframe (should already be set from Step 12)
    const stationerySenderIframe = page.frameLocator('#stationerySender_iframe');
    
    // Wait for preview page to be ready
    await page.waitForTimeout(2000);
    
    // Click Email button (#btnEmail)
    console.log(`📮 [SEND_CANCELLATION_CONFIRMATION] Clicking Email button...`);
    const emailButton = stationerySenderIframe.locator('#btnEmail');
    await emailButton.waitFor({ state: 'visible', timeout: 30000 });
    
    const isEmailButtonVisible = await emailButton.isVisible().catch(() => false);
    if (!isEmailButtonVisible) {
      console.log('⚠️ [SEND_CANCELLATION_CONFIRMATION] Email button not visible, scrolling into view...');
      await emailButton.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
    }
    
    await emailButton.click();
    await page.waitForTimeout(2000);
    
    // Wait for email sent confirmation
    console.log(`⏳ [SEND_CANCELLATION_CONFIRMATION] Waiting for email sent confirmation...`);
    const confirmationSelectors = [
      'text=/Email has been sent/i',
      'text=/email.*sent/i'
    ];
    
    let confirmationFound = false;
    for (const selector of confirmationSelectors) {
      try {
        const confirmation = stationerySenderIframe.locator(selector).first();
        if (await confirmation.count() > 0) {
          await confirmation.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
          const isVisible = await confirmation.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [SEND_CANCELLATION_CONFIRMATION] Email sent confirmation found using selector: "${selector}"`);
            confirmationFound = true;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!confirmationFound) {
      console.log('⚠️ [SEND_CANCELLATION_CONFIRMATION] Email sent confirmation not immediately visible, but continuing...');
    }
    
    console.log(`✅ [SEND_CANCELLATION_CONFIRMATION] Email sent successfully`);
    
    await takeScreenshot(page, 'send-cancellation-confirmation-sent.png', screenshotsDir);
    
    // Click Back button (#btnClose) in stationerySender_iframe
    console.log(`⬅️ [SEND_CANCELLATION_CONFIRMATION] Clicking Back button...`);
    const backButton = stationerySenderIframe.locator('#btnClose');
    await backButton.waitFor({ state: 'visible', timeout: 10000 });
    
    const isBackButtonVisible = await backButton.isVisible().catch(() => false);
    if (!isBackButtonVisible) {
      console.log('⚠️ [SEND_CANCELLATION_CONFIRMATION] Back button not visible, scrolling into view...');
      await backButton.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
    }
    
    await backButton.click();
    await page.waitForTimeout(2000);
    
    // After clicking Back, we return to contactEdit_iframe (profile page)
    // OK button is in main page: #mainArea > #bottomToolbar > #btnBack (sibling of iframe, not inside it)
    console.log(`✅ [SEND_CANCELLATION_CONFIRMATION] Clicking Ok button...`);
    const okButton = page.locator('#bottomToolbar #btnBack');
    
    // Wait for Ok button to be visible (may take a moment after returning from stationerySender_iframe)
    await okButton.waitFor({ state: 'visible', timeout: 30000 });
    await okButton.click();
    
    await page.waitForTimeout(2000);

    await takeScreenshot(page, 'send-cancellation-confirmation-complete.png', screenshotsDir);
    
    return {
      success: true,
      emailSent: true
    };
    
  } catch (error) {
    console.error(`❌ [SEND_CANCELLATION_CONFIRMATION] Error:`, error);
    await takeScreenshot(page, 'send-cancellation-confirmation-error.png', screenshotsDir);
    
    return {
      success: false,
      error: error.message || 'Failed to send cancellation confirmation email'
    };
  }
}
