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
    
    // Wait for contactEdit_iframe to appear after clicking client name
    // The client profile page loads in contactEdit_iframe
    console.log('🔄 [SELECT_CLIENT] Waiting for contactEdit_iframe to appear...');
    await page.waitForTimeout(3000); // Give time for iframe to load
    
    // Check if contactEdit_iframe exists
    const contactEditIframeExists = await page.locator('#contactEdit_iframe').count();
    if (contactEditIframeExists === 0) {
      console.log('⚠️ [SELECT_CLIENT] contactEdit_iframe not found, waiting longer...');
      await page.waitForTimeout(2000);
    }
    
    // Switch to contactEdit_iframe for client profile
    const clientDetailsIframe = page.frameLocator('#contactEdit_iframe');
    
    // Wait for the client profile page to load in the iframe
    console.log('⏳ [SELECT_CLIENT] Waiting for client profile page to load in iframe...');
    await page.waitForTimeout(2000);
    
    // Verify we're on the client profile page by checking for the heading
    // Heading selector: <h1 class="jqx_formBoilerPlateText jqx_formHeading jqx_underline"><span>Bookings, credits and debits</span></h1>
    console.log('🔍 [SELECT_CLIENT] Verifying profile opened using heading selector...');
    try {
      await clientDetailsIframe.locator('h1.jqx_formBoilerPlateText.jqx_formHeading.jqx_underline:has-text("Bookings, credits and debits")').waitFor({ 
        state: 'visible', 
        timeout: 15000 
      });
      console.log('✅ [SELECT_CLIENT] Profile heading found in contactEdit_iframe');
    } catch (e) {
      // Fallback: try with different text matching
      console.log('⚠️ [SELECT_CLIENT] Heading not found with exact selector, trying alternative...');
      try {
        await clientDetailsIframe.locator('h1:has-text("Bookings, credits and debits")').waitFor({ 
          state: 'visible', 
          timeout: 10000 
        });
        console.log('✅ [SELECT_CLIENT] Profile heading found with alternative selector');
      } catch (e2) {
        throw new Error('Client profile page did not load. Could not find "Bookings, credits and debits" heading in contactEdit_iframe.');
      }
    }
    
    const profileOpened = true;
    
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
