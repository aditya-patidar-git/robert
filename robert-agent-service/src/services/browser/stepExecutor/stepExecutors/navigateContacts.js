/**
 * Navigate Contacts Step Executor
 * Handles navigation to Contacts page
 * Preserves all Playwright timing and state checks
 */

import { waitForThenOptionalDelay, CRM_STABILITY_DELAY_MS } from '../../../commonBookingSteps/utils.js';

/**
 * Execute navigateContacts step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
export async function executeNavigateContacts(page, args, sessionState, screenshotsDir, progressCallback = null) {
  progressCallback?.({ message: 'Opening the Contacts tab.' });
  // Ensure we're on CRM dashboard first
  const currentUrl = page.url();
  if (!currentUrl.includes('takeabyte.co.uk/InContact') || currentUrl.includes('/Account/Login')) {
    console.log('🔐 [navigateContacts] Not on CRM dashboard, navigating...');
    await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 15000 });
  }

  // Wait for dashboard to be fully loaded
  await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 30000 });

  // Navigate to Contacts tab using the correct selector (h3 element, not link)
  const contactsTab = page.locator('h3.list-menu-item-heading:has-text("Contacts")').first();
  await contactsTab.click();

  // Wait for the iframe to be present (ready condition); then optional load state
  progressCallback?.({ message: 'Loading the contacts page.' });
  console.log('🔍 [navigateContacts] Looking for Contacts iframe...');
  await waitForThenOptionalDelay(page, '#contactLookup_iframe', { state: 'attached', timeout: 15000, delayMs: 0 });
  await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {
    console.warn('⚠️ [navigateContacts] load state timeout - continuing to iframe ready check');
  });

  await page.waitForFunction(() => {
    const iframe = document.querySelector('#contactLookup_iframe');
    return iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete';
  }, { timeout: 15000 });
  await page.waitForTimeout(CRM_STABILITY_DELAY_MS);

  progressCallback?.({ message: 'Contacts page is ready.' });
  console.log('✅ [navigateContacts] Contacts page iframe loaded successfully');

  return {
    success: true,
    navigated: true
  };
}
