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
    
    // Wait for preview page to be ready
    await page.waitForTimeout(2000);
    
    // Click Email button
    console.log(`📮 [SEND_CANCELLATION_CONFIRMATION] Clicking Email button...`);
    const emailButton = page.getByRole('button', { name: /Email/i }).first();
    await emailButton.waitFor({ state: 'visible', timeout: 10000 });
    await emailButton.click();
    
    // Wait for email to be sent
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    
    // Verify email was sent successfully
    // Look for success message
    const successMessage = page.getByText(/Email has been sent/i).first();
    await successMessage.waitFor({ state: 'visible', timeout: 10000 });
    
    console.log(`✅ [SEND_CANCELLATION_CONFIRMATION] Email sent successfully`);
    
    await takeScreenshot(page, 'send-cancellation-confirmation-sent.png', screenshotsDir);
    
    // Click Back button
    console.log(`⬅️ [SEND_CANCELLATION_CONFIRMATION] Clicking Back button...`);
    const backButton = page.getByRole('button', { name: /Back/i }).first();
    await backButton.waitFor({ state: 'visible', timeout: 10000 });
    await backButton.click();
    
    // Wait for navigation
    await page.waitForTimeout(2000);
    
    // Click Ok button to exit
    console.log(`✅ [SEND_CANCELLATION_CONFIRMATION] Clicking Ok button...`);
    const okButton = page.getByRole('button', { name: /Ok/i }).first();
    
    // Wait for Ok button to be visible (may take a moment)
    await okButton.waitFor({ state: 'visible', timeout: 10000 });
    await okButton.click();
    
    // Wait for navigation back to profile
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    
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
