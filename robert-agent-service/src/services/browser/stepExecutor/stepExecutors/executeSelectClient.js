/**
 * Select Client Step Executor
 * Step 6: Click verified client name to open profile
 * Preserves all Playwright timing and state checks
 */

import { takeScreenshot } from '../../../commonBookingSteps/utils.js';

/**
 * Execute selectClient step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<Object>} Step execution result
 */
export async function executeSelectClient(page, args, sessionState, screenshotsDir) {
  const clientName = args.clientName || sessionState?.clientDetails?.name;
  
  if (!clientName) {
    return {
      success: false,
      error: 'Client name is required. Please complete the search client step first.'
    };
  }

  try {
    console.log(`👤 [SELECT_CLIENT] Clicking on client name: ${clientName}`);
    
    // Wait for search results to be visible
    await page.waitForSelector('tr', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Click on the client name link in search results
    // The client name should be in a table row (tr) or link
    const clientLink = page.locator(`tr:has-text("${clientName}")`).first();
    
    // Wait for the link to be visible
    await clientLink.waitFor({ state: 'visible', timeout: 10000 });
    await clientLink.click();
    
    // Wait for page to navigate to client profile
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the client profile page
    // Look for "Bookings, credits, and debits" section or profile indicators
    const profileIndicators = [
      page.getByText('Bookings, credits, and debits'),
      page.locator('text=/Contact details/i'),
      page.locator('text=/Profile/i')
    ];
    
    let profileOpened = false;
    for (const indicator of profileIndicators) {
      const count = await indicator.count();
      if (count > 0) {
        profileOpened = true;
        break;
      }
    }
    
    if (!profileOpened) {
      // Try waiting a bit more
      await page.waitForTimeout(3000);
      const retryIndicator = page.getByText('Bookings, credits, and debits');
      profileOpened = await retryIndicator.count() > 0;
    }
    
    if (!profileOpened) {
      throw new Error('Client profile page did not load. Could not find profile indicators.');
    }
    
    console.log(`✅ [SELECT_CLIENT] Client profile opened successfully`);
    
    await takeScreenshot(page, 'select-client-profile-opened.png', screenshotsDir);
    
    return {
      success: true,
      clientProfileOpened: true,
      clientDetails: {
        name: clientName
      }
    };
    
  } catch (error) {
    console.error(`❌ [SELECT_CLIENT] Error:`, error);
    await takeScreenshot(page, 'select-client-error.png', screenshotsDir);
    
    return {
      success: false,
      error: error.message || 'Failed to open client profile'
    };
  }
}
