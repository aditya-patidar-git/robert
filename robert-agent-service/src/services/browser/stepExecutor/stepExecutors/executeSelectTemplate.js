/**
 * Select Template Step Executor
 * Step 12: Select "Cancellation confirmation of course/session" template
 * Preserves all Playwright timing and state checks
 */

import { takeScreenshot } from '../../../commonBookingSteps/utils.js';

/**
 * Execute selectTemplate step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<Object>} Step execution result
 */
export async function executeSelectTemplate(page, args, sessionState, screenshotsDir) {
  try {
    console.log(`📄 [SELECT_TEMPLATE] Selecting cancellation confirmation template...`);
    
    // Wait for page to be ready
    await page.waitForTimeout(2000);
    
    // Click on "Send one of the standard letters to the contact" button
    console.log(`📧 [SELECT_TEMPLATE] Clicking "Send one of the standard letters" button...`);
    const sendLetterButton = page.getByRole('button', { name: /Send one of the standard letters/i }).first();
    await sendLetterButton.waitFor({ state: 'visible', timeout: 10000 });
    await sendLetterButton.click();
    
    // Wait for template list to load
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    
    // Scroll to find "Correspondence letter" section
    console.log(`📜 [SELECT_TEMPLATE] Looking for "Correspondence letter" section...`);
    const correspondenceSection = page.getByText(/Correspondence letter/i).first();
    await correspondenceSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    
    // Find and click "Cancellation confirmation of course/session" link
    console.log(`🔗 [SELECT_TEMPLATE] Clicking "Cancellation confirmation" link...`);
    const cancellationLink = page.getByRole('link', { name: /Cancellation confirmation of course\/session/i }).first();
    
    await cancellationLink.waitFor({ state: 'visible', timeout: 10000 });
    await cancellationLink.click();
    
    // Wait for template to load
    await page.waitForTimeout(2000);
    
    // Click Preview button
    console.log(`👁️ [SELECT_TEMPLATE] Clicking Preview button...`);
    const previewButton = page.getByRole('button', { name: /Preview/i }).first();
    await previewButton.waitFor({ state: 'visible', timeout: 10000 });
    await previewButton.click();
    
    // Wait for preview to load
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    
    // Verify template is selected and preview is shown
    // Look for preview indicators (client name, email button, etc.)
    const previewIndicators = [
      page.getByRole('button', { name: /Email/i }),
      page.getByText(/Preview/i),
      page.locator('text=/client/i')
    ];
    
    let templateSelected = false;
    for (const indicator of previewIndicators) {
      const count = await indicator.count();
      if (count > 0) {
        templateSelected = true;
        break;
      }
    }
    
    if (!templateSelected) {
      // Try waiting a bit more
      await page.waitForTimeout(2000);
      const retryIndicator = page.getByRole('button', { name: /Email/i });
      templateSelected = await retryIndicator.count() > 0;
    }
    
    if (!templateSelected) {
      throw new Error('Template preview did not load. Could not find preview indicators.');
    }
    
    console.log(`✅ [SELECT_TEMPLATE] Template selected and preview shown successfully`);
    
    await takeScreenshot(page, 'select-template-preview.png', screenshotsDir);
    
    return {
      success: true,
      templateSelected: true
    };
    
  } catch (error) {
    console.error(`❌ [SELECT_TEMPLATE] Error:`, error);
    await takeScreenshot(page, 'select-template-error.png', screenshotsDir);
    
    return {
      success: false,
      error: error.message || 'Failed to select cancellation template'
    };
  }
}
