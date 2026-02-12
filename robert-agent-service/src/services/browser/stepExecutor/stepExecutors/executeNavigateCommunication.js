/**
 * Navigate Communication Step Executor
 * Step 11: Click Communication dropdown menu and select "Send one of the standard letters to the contact"
 * Preserves all Playwright timing and state checks
 */

import { takeScreenshot } from '../../../commonBookingSteps/utils.js';

/**
 * Execute navigateCommunication step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<Object>} Step execution result
 */
export async function executeNavigateCommunication(page, args, sessionState, screenshotsDir) {
  try {
    console.log(`📧 [NAVIGATE_COMMUNICATION] Navigating to Communication menu...`);
    
    // Work within contactEdit_iframe (should already be set from Step 6)
    console.log('🔄 [NAVIGATE_COMMUNICATION] Switching to contactEdit_iframe context...');
    const clientDetailsIframe = page.frameLocator('#contactEdit_iframe');
    
    // Wait for iframe to be ready
    await page.waitForTimeout(2000);
    
    // Find Communication menu item in menu bar (id="contactMenu")
    console.log('🔍 [NAVIGATE_COMMUNICATION] Finding Communication menu item...');
    let communicationMenuItem = null;
    
    // Try multiple selector approaches
    try {
      communicationMenuItem = clientDetailsIframe.locator('#contactMenu span.dx-menu-item-text:has-text("Communication")');
      await communicationMenuItem.waitFor({ state: 'visible', timeout: 5000 });
      console.log('✅ [NAVIGATE_COMMUNICATION] Found Communication menu item using selector 1');
    } catch (e) {
      console.log('⚠️ [NAVIGATE_COMMUNICATION] Selector 1 failed, trying alternative...');
      try {
        communicationMenuItem = clientDetailsIframe.locator('#contactMenu').getByText('Communication');
        await communicationMenuItem.waitFor({ state: 'visible', timeout: 5000 });
        console.log('✅ [NAVIGATE_COMMUNICATION] Found Communication menu item using selector 2');
      } catch (e2) {
        console.log('⚠️ [NAVIGATE_COMMUNICATION] Selector 2 failed, trying alternative...');
        communicationMenuItem = clientDetailsIframe.locator('span.dx-menu-item-text:has-text("Communication")');
        await communicationMenuItem.waitFor({ state: 'visible', timeout: 5000 });
        console.log('✅ [NAVIGATE_COMMUNICATION] Found Communication menu item using selector 3');
      }
    }
    
    // Click Communication menu item to open dropdown
    console.log('👆 [NAVIGATE_COMMUNICATION] Clicking Communication menu item...');
    await communicationMenuItem.click();
    await page.waitForTimeout(1000);
    
    console.log('⏳ [NAVIGATE_COMMUNICATION] Waiting for Communication dropdown menu...');
    const communicationDropdown = clientDetailsIframe.locator('.dx-overlay-wrapper .dx-overlay-content.dx-inner-overlay.dx-context-menu.dx-menu-base');
    await communicationDropdown.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);
    
    // Find and click "Send one of the standard letters to the contact" option
    console.log('🔍 [NAVIGATE_COMMUNICATION] Looking for "Send one of the standard letters" option...');
    const standardLettersOption = communicationDropdown.locator('.dx-menu-item-text:has-text("Send one of the standard letters to the contact")');
    await standardLettersOption.waitFor({ state: 'visible', timeout: 5000 });
    await standardLettersOption.click();
    
    console.log('⏳ [NAVIGATE_COMMUNICATION] Waiting for template selection page (stationerySender_iframe)...');
    await page.waitForLoadState('load');
    let templatePageOpened = false;
    const maxWaitAttempts = 10;
    const waitBetweenAttempts = 2000;

    for (let i = 0; i < maxWaitAttempts; i++) {
      const iframeExists = await page.locator('#stationerySender_iframe').count() > 0;
      if (!iframeExists) {
        console.log(`⏳ [NAVIGATE_COMMUNICATION] stationerySender_iframe not yet present, waiting (${i + 1}/${maxWaitAttempts})...`);
        await page.waitForTimeout(waitBetweenAttempts);
        continue;
      }
      const stationeryIframe = page.frameLocator('#stationerySender_iframe');
      try {
        const correspondenceInFrame = stationeryIframe.getByText(/Correspondence letter/i);
        await correspondenceInFrame.first().waitFor({ state: 'visible', timeout: 5000 });
        templatePageOpened = true;
        console.log('✅ [NAVIGATE_COMMUNICATION] Template selection page opened (stationerySender_iframe content visible)');
        break;
      } catch (e) {
        try {
          const gridInFrame = stationeryIframe.locator('#stationeryGrid_page');
          await gridInFrame.waitFor({ state: 'visible', timeout: 3000 });
          templatePageOpened = true;
          console.log('✅ [NAVIGATE_COMMUNICATION] Template selection page opened (stationeryGrid_page visible)');
          break;
        } catch (e2) {
          console.log(`⚠️ [NAVIGATE_COMMUNICATION] Iframe present but content not ready, retrying (${i + 1}/${maxWaitAttempts})...`);
          await page.waitForTimeout(waitBetweenAttempts);
        }
      }
    }

    if (!templatePageOpened) {
      throw new Error('Template selection page did not open: stationerySender_iframe did not load or template list not visible.');
    }
    
    console.log(`✅ [NAVIGATE_COMMUNICATION] Template selection page opened successfully`);
    
    await takeScreenshot(page, 'navigate-communication-opened.png', screenshotsDir);
    
    return {
      success: true,
      communicationTabOpened: true,
      templatePageOpened: true
    };
    
  } catch (error) {
    console.error(`❌ [NAVIGATE_COMMUNICATION] Error:`, error);
    await takeScreenshot(page, 'navigate-communication-error.png', screenshotsDir);
    
    return {
      success: false,
      error: error.message || 'Failed to navigate to Communication menu'
    };
  }
}
