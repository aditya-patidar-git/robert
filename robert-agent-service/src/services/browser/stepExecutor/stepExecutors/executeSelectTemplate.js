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
    
    // Wait for stationerySender_iframe to appear (after Step 11)
    console.log('⏳ [SELECT_TEMPLATE] Waiting for stationerySender_iframe...');
    let stationerySenderIframeExists = false;
    for (let i = 0; i < 10; i++) {
      stationerySenderIframeExists = await page.locator('#stationerySender_iframe').count() > 0;
      if (stationerySenderIframeExists) {
        try {
          const stationerySenderIframe = page.frameLocator('#stationerySender_iframe');
          const testLocator = stationerySenderIframe.locator('body').first();
          await testLocator.waitFor({ state: 'attached', timeout: 3000 });
          console.log('✅ [SELECT_TEMPLATE] Found stationerySender_iframe');
          break;
        } catch (iframeError) {
          console.log(`⚠️ [SELECT_TEMPLATE] Iframe detected but not loaded yet, retrying (${i + 1}/10)...`);
          if (i < 9) await page.waitForTimeout(2000);
        }
      } else {
        if (i < 9) {
          console.log(`⏳ [SELECT_TEMPLATE] StationerySender iframe not found, retrying (${i + 1}/10)...`);
          await page.waitForTimeout(2000);
        }
      }
    }
    
    if (!stationerySenderIframeExists) {
      throw new Error('Could not find stationerySender_iframe after Step 11');
    }
    
    const stationerySenderIframe = page.frameLocator('#stationerySender_iframe');
    
    // Wait for template list to load
    await page.waitForTimeout(2000);
    
    // Scroll to "Correspondence letter" section (if needed)
    console.log(`📜 [SELECT_TEMPLATE] Looking for "Correspondence letter" section...`);
    const correspondenceSection = stationerySenderIframe.locator('text=/Correspondence letter/i');
    await correspondenceSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    
    // Find template grid
    console.log(`🔍 [SELECT_TEMPLATE] Finding template grid...`);
    const gridContainer = stationerySenderIframe.locator('#stationeryGrid_page');
    await gridContainer.waitFor({ state: 'visible', timeout: 10000 });
    
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
    
    // Click on the matching template row
    console.log(`🖱️ [SELECT_TEMPLATE] Clicking template row...`);
    await matchingRow.click();
    await page.waitForTimeout(2000);
    
    // Click Preview button (#btnPreview)
    console.log(`👁️ [SELECT_TEMPLATE] Clicking Preview button...`);
    const previewButton = stationerySenderIframe.locator('#btnPreview');
    await previewButton.waitFor({ state: 'visible', timeout: 10000 });
    
    const isVisible = await previewButton.isVisible().catch(() => false);
    if (!isVisible) {
      console.log('⚠️ [SELECT_TEMPLATE] Preview button not visible, scrolling into view...');
      await previewButton.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
    }
    
    await previewButton.click();
    await page.waitForTimeout(3000);
    
    // Verify preview is shown (check for Email button #btnEmail)
    console.log(`🔍 [SELECT_TEMPLATE] Verifying preview is shown...`);
    const emailButton = stationerySenderIframe.locator('#btnEmail');
    await emailButton.waitFor({ state: 'visible', timeout: 10000 });
    
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
