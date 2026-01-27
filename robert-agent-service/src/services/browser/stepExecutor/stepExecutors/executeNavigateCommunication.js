/**
 * Navigate Communication Step Executor
 * Step 11: Navigate to Communication tab
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
    console.log(`📧 [NAVIGATE_COMMUNICATION] Navigating to Communication tab...`);
    
    // Wait for page to be ready
    await page.waitForTimeout(2000);
    
    // Click on Communication tab
    // Look for Communication tab - could be a tab, link, or button
    const communicationTab = page.getByRole('tab', { name: /Communication/i }).first();
    
    // Wait for tab to be visible
    await communicationTab.waitFor({ state: 'visible', timeout: 10000 });
    await communicationTab.click();
    
    // Wait for Communication page to load
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    
    // Verify Communication tab is open
    // Look for Communication page indicators
    const communicationIndicators = [
      page.getByRole('button', { name: /Send one of the standard letters/i }),
      page.getByText(/Correspondence letter/i),
      page.getByText(/Communication/i)
    ];
    
    let communicationOpened = false;
    for (const indicator of communicationIndicators) {
      const count = await indicator.count();
      if (count > 0) {
        communicationOpened = true;
        break;
      }
    }
    
    if (!communicationOpened) {
      // Try waiting a bit more
      await page.waitForTimeout(2000);
      const retryIndicator = page.getByRole('button', { name: /Send one of the standard letters/i });
      communicationOpened = await retryIndicator.count() > 0;
    }
    
    if (!communicationOpened) {
      throw new Error('Communication tab did not open. Could not find Communication page indicators.');
    }
    
    console.log(`✅ [NAVIGATE_COMMUNICATION] Communication tab opened successfully`);
    
    await takeScreenshot(page, 'navigate-communication-opened.png', screenshotsDir);
    
    return {
      success: true,
      communicationTabOpened: true
    };
    
  } catch (error) {
    console.error(`❌ [NAVIGATE_COMMUNICATION] Error:`, error);
    await takeScreenshot(page, 'navigate-communication-error.png', screenshotsDir);
    
    return {
      success: false,
      error: error.message || 'Failed to navigate to Communication tab'
    };
  }
}
