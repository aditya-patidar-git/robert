/**
 * Select Template Step Executor
 * Step 12: Select "Cancellation confirmation of course/session" template
 * Preserves all Playwright timing and state checks
 */

import { takeScreenshot, waitForThenOptionalDelay, CRM_STABILITY_DELAY_MS } from '../../../commonBookingSteps/utils.js';

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
    
    console.log('⏳ [SELECT_TEMPLATE] Waiting for stationerySender_iframe...');
    await waitForThenOptionalDelay(page, '#stationerySender_iframe', { state: 'attached', timeout: 20000, delayMs: 0 });
    const stationerySenderIframe = page.frameLocator('#stationerySender_iframe');
    await stationerySenderIframe.locator('body').first().waitFor({ state: 'attached', timeout: 5000 });
    console.log('✅ [SELECT_TEMPLATE] Found stationerySender_iframe');

    const gridContainer = stationerySenderIframe.locator('#stationeryGrid_page');
    await waitForThenOptionalDelay(page, gridContainer, { state: 'visible', timeout: 15000, delayMs: CRM_STABILITY_DELAY_MS });

    console.log(`📜 [SELECT_TEMPLATE] Looking for "Correspondence letters" section...`);
    const correspondenceSection = stationerySenderIframe.getByText('Correspondence letters', { exact: true });
    await correspondenceSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(CRM_STABILITY_DELAY_MS);
    
    // Find all template rows
    const templateRows = gridContainer.locator('tr.jqx_quickGridRow');
    const rowCount = await templateRows.count();
    
    if (rowCount === 0) {
      throw new Error('No template rows found in #stationeryGrid_page');
    }
    
    console.log(`📊 [SELECT_TEMPLATE] Found ${rowCount} template rows, searching for "Cancellation confirmation of course/session"...`);
    
    // Search for "Cancellation confirmation of course/session" template
    const templateName = 'Cancellation confirmation of course/session';
    let matchingRow = null;
    
    for (let i = 0; i < rowCount; i++) {
      const row = templateRows.nth(i);
      const rowText = await row.textContent();
      const normalizedRowText = rowText ? rowText.trim() : '';
      
      // Check for exact match or partial match
      if (normalizedRowText.includes(templateName) || templateName.includes(normalizedRowText)) {
        console.log(`✅ [SELECT_TEMPLATE] Found matching template at row ${i + 1}: "${normalizedRowText.substring(0, 100)}..."`);
        matchingRow = row;
        break;
      }
    }
    
    if (!matchingRow) {
      throw new Error(`Could not find template: "${templateName}" in stationery grid`);
    }
    
    console.log(`🖱️ [SELECT_TEMPLATE] Clicking template row...`);
    await matchingRow.click();
    await stationerySenderIframe.locator('#btnPreview').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(200);
    
    console.log(`👁️ [SELECT_TEMPLATE] Clicking Preview button...`);
    const previewButton = stationerySenderIframe.locator('#btnPreview');
    await previewButton.waitFor({ state: 'visible', timeout: 10000 });
    await previewButton.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
    await previewButton.click();
    await waitForThenOptionalDelay(page, stationerySenderIframe.locator('#btnEmail'), { state: 'visible', timeout: 15000, delayMs: CRM_STABILITY_DELAY_MS });

    // Verify preview is shown (check for Email button #btnEmail)
    console.log(`🔍 [SELECT_TEMPLATE] Verifying preview is shown...`);
    const emailButton = stationerySenderIframe.locator('#btnEmail');
    await emailButton.waitFor({ state: 'visible', timeout: 30000 });
    
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
