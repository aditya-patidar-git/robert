/**
 * Step 9: Lookup contact and wait
 * Main orchestrator that coordinates helper functions
 * Preserves all Playwright timing, selectors, and execution order
 * 
 * @param {Page} page - Playwright page object
 * @param {string} email - Client email address to lookup (may contain "Copy" text)
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} [clientPostcode] - Optional postcode for verification when multiple results appear
 * @param {boolean} [skipNextClick] - If true, skip clicking Next button (for address confirmation flow)
 */

import { cleanEmail } from '../utils.js';
import { takeScreenshot } from '../utils.js';
import { checkAlreadyOnPage } from './helpers/checkAlreadyOnPage.js';
import { findIframe } from './helpers/findIframe.js';
import { performSearch } from './helpers/performSearch.js';
import { selectClient } from './helpers/selectClient.js';
import { clickNext } from './helpers/clickNext.js';

export async function lookupContactAndWait(page, email, screenshotsDir, clientPostcode = null, skipNextClick = false) {
  try {
    console.log('🔍 [STEP 9] Looking up contact...');
    
    // CRITICAL: Clean email before using it (remove "Copy" button text if present)
    const cleanedEmail = cleanEmail(email);
    if (!cleanedEmail) {
      throw new Error(`Invalid email address provided: ${email}`);
    }
    
    if (cleanedEmail !== email) {
      console.log(`🧹 [STEP 9] Cleaned email: "${email}" → "${cleanedEmail}"`);
    }
    
    // Use cleaned email for all operations
    email = cleanedEmail;
    
    // CRITICAL: FIRST check if we're already on the client details page
    // This prevents re-trying the lookup flow if the client was already selected
    const alreadyHandled = await checkAlreadyOnPage(page, email, screenshotsDir, skipNextClick);
    if (alreadyHandled) {
      return; // Early return - already handled
    }
    
    // Find and wait for contact lookup iframe
    const { iframe, iframeId } = await findIframe(page, screenshotsDir);
    
    // Perform search
    await performSearch(page, iframe, iframeId, email, screenshotsDir);
    
    // Select client from results
    await selectClient(page, iframe, iframeId, email, clientPostcode, screenshotsDir);
    
    // If skipNextClick is true, return here (for address confirmation flow)
    if (skipNextClick) {
      console.log('⏸️ [STEP 9] Skipping Next button click (address confirmation required)');
      return;
    }
    
    // Click Next button
    await clickNext(page, iframe, iframeId, screenshotsDir);
    
  } catch (error) {
    console.error('Error in lookupContactAndWait:', error);
    await takeScreenshot(page, 'contact-lookup-error.png', screenshotsDir);
    throw new Error(`Failed to lookup contact: ${error.message}`);
  }
}
