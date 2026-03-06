/**
 * Navigate Contacts Step Executor
 * Handles navigation to Contacts page
 * Preserves all Playwright timing and state checks
 */

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
    await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  }

  // Wait for dashboard to be fully loaded
  await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 30000 });

  // Navigate to Contacts tab using the correct selector (h3 element, not link)
  const contactsTab = page.locator('h3.list-menu-item-heading:has-text("Contacts")').first();
  await contactsTab.click();

  // Wait for main page load (use 'load' to avoid networkidle timeout on CRM with long-lived requests)
  progressCallback?.({ message: 'Loading the contacts page.' });
  console.log('⏳ [navigateContacts] Waiting for Contacts page to load...');
  await page.waitForTimeout(2000);
  await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {
    console.warn('⚠️ [navigateContacts] load state timeout - continuing to iframe wait');
  });

  // CRITICAL: Wait for the iframe to be present and loaded (timeouts fit within tool's 30s limit)
  // The Contacts page content is inside an iframe, not in the main page
  console.log('🔍 [navigateContacts] Looking for Contacts iframe...');
  await page.waitForSelector('#contactLookup_iframe', { state: 'attached', timeout: 15000 });

  // Wait for the iframe content to be ready
  await page.waitForFunction(() => {
    const iframe = document.querySelector('#contactLookup_iframe');
    return iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete';
  }, { timeout: 15000 });

  progressCallback?.({ message: 'Contacts page is ready.' });
  console.log('✅ [navigateContacts] Contacts page iframe loaded successfully');

  return {
    success: true,
    navigated: true
  };
}
