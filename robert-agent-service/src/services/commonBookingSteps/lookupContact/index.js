/**
 * Step 9: Lookup contact and wait
 * Main orchestrator that coordinates helper functions.
 * Supports search by mobile (from Step 4) or email; CRM Smart search accepts both (per crm_modules).
 *
 * @param {Page} page - Playwright page object
 * @param {string} searchValue - Mobile number (normalized digits) or email to search
 * @param {string} searchType - 'mobile' or 'email'
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} [clientPostcode] - Optional postcode for verification when multiple results appear
 * @param {boolean} [skipNextClick] - If true, skip clicking Next button (for address confirmation flow)
 * @param {boolean} [allowSkipIfAlreadyOnPage=true] - If false, never skip based on "already on page" (run full lookup)
 * @param {Function|null} [progressCallback] - Optional callback({ message }) for path-based voice updates
 */

import { cleanEmail } from '../utils.js';
import { takeScreenshot } from '../utils.js';
import { checkAlreadyOnPage } from './helpers/checkAlreadyOnPage.js';
import { findIframe } from './helpers/findIframe.js';
import { performSearch } from './helpers/performSearch.js';
import { selectClient } from './helpers/selectClient.js';
import { clickNext } from './helpers/clickNext.js';

export async function lookupContactAndWait(page, searchValue, searchType, screenshotsDir, clientPostcode = null, skipNextClick = false, allowSkipIfAlreadyOnPage = true, progressCallback = null) {
  try {
    console.log(`🔍 [STEP 9] Looking up contact (${searchType})...`);

    let finalSearchValue = searchValue;
    if (searchType === 'email') {
      const cleaned = cleanEmail(searchValue);
      if (!cleaned) {
        throw new Error(`Invalid email address provided: ${searchValue}`);
      }
      if (cleaned !== searchValue) {
        console.log(`🧹 [STEP 9] Cleaned email: "${searchValue}" → "${cleaned}"`);
      }
      finalSearchValue = cleaned;
    } else {
      finalSearchValue = String(searchValue || '').trim();
      if (!finalSearchValue) {
        throw new Error('Search value (mobile) is required for contact lookup');
      }
    }

    // CRITICAL: FIRST check if we're already on the client details page (only when we've already completed this step in this flow)
    const identifierForCheck = searchType === 'email' ? finalSearchValue : '';
    const alreadyHandled = await checkAlreadyOnPage(page, identifierForCheck, screenshotsDir, skipNextClick, allowSkipIfAlreadyOnPage);
    if (alreadyHandled) {
      return;
    }

    const { iframe, iframeId } = await findIframe(page, screenshotsDir);
    progressCallback?.({ message: 'Opening the contact lookup.' });

    await performSearch(page, iframe, iframeId, finalSearchValue, screenshotsDir);
    progressCallback?.({ message: 'Searching for your contact.' });

    await selectClient(page, iframe, iframeId, finalSearchValue, searchType, clientPostcode, screenshotsDir);
    progressCallback?.({ message: 'Loading contact details.' });

    if (skipNextClick) {
      console.log('⏸️ [STEP 9] Skipping Next button click (address confirmation required)');
      return;
    }

    await clickNext(page, iframe, iframeId, screenshotsDir);
  } catch (error) {
    console.error('Error in lookupContactAndWait:', error);
    await takeScreenshot(page, 'contact-lookup-error.png', screenshotsDir);
    throw new Error(`Failed to lookup contact: ${error.message}`);
  }
}
