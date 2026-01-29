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
      communicationMenuItem = clientDetailsIframe.locator('#contactMenu .dx-menu-item-text:has-text("Communication")');
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
    
    // Wait for dropdown context menu to appear (may appear on main page, not in iframe)
    console.log('⏳ [NAVIGATE_COMMUNICATION] Waiting for Communication dropdown menu...');
    const communicationDropdown = page.locator('.dx-overlay-content.dx-inner-overlay.dx-context-menu.dx-menu-base');
    await communicationDropdown.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);
    
    // Find and click "Send one of the standard letters to the contact" option
    console.log('🔍 [NAVIGATE_COMMUNICATION] Looking for "Send one of the standard letters" option...');
    const standardLettersOption = communicationDropdown.locator('.dx-menu-item-text:has-text("Send one of the standard letters to the contact")');
    await standardLettersOption.waitFor({ state: 'visible', timeout: 5000 });
    await standardLettersOption.click();
    
    // Wait for template selection page to load
    console.log('⏳ [NAVIGATE_COMMUNICATION] Waiting for template selection page...');
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    
    // Verify template selection page opened
    // Look for template selection indicators
    console.log('🔍 [NAVIGATE_COMMUNICATION] Verifying template selection page opened...');
    const templateIndicators = [
      page.getByText(/Correspondence letter/i),
      page.getByText(/Cancellation confirmation/i),
      page.locator('text=/template/i'),
      page.getByRole('link', { name: /Cancellation confirmation/i })
    ];
    
    let templatePageOpened = false;
    for (const indicator of templateIndicators) {
      const count = await indicator.count();
      if (count > 0) {
        templatePageOpened = true;
        console.log(`✅ [NAVIGATE_COMMUNICATION] Template selection page indicator found`);
        break;
      }
    }
    
    if (!templatePageOpened) {
      // Try waiting a bit more
      console.log('⚠️ [NAVIGATE_COMMUNICATION] Template indicators not found, waiting longer...');
      await page.waitForTimeout(2000);
      const retryIndicator = page.getByText(/Correspondence letter/i);
      templatePageOpened = await retryIndicator.count() > 0;
    }
    
    if (!templatePageOpened) {
      throw new Error('Template selection page did not open. Could not find template selection indicators.');
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
