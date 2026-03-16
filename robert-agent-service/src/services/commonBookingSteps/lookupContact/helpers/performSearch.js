/**
 * Perform Search Helper
 * Executes contact search with Smart search option
 * Preserves all Playwright timing and state checks
 */

import { takeScreenshot, waitForThenOptionalDelay, CRM_STABILITY_DELAY_MS, CRM_RESULTS_STABILITY_MS } from '../../utils.js';

/** Same row selector as selectClient - wait until at least one row exists before proceeding. */
const RESULTS_GRID_ROW_SELECTOR = 'table.dx-datagrid-table tr.dx-row.dx-data-row[role="row"]';
const RESULTS_READY_TIMEOUT_MS = 4000;
const RESULTS_POLL_INTERVAL_MS = 350;

/**
 * Perform contact search (Smart search supports telephone, email, or name per CRM doc)
 * @param {Object} page - Playwright page object
 * @param {Object} iframe - Iframe locator
 * @param {string} iframeId - Iframe ID
 * @param {string} searchValue - Mobile number (digits) or email to search
 * @param {string} screenshotsDir - Screenshots directory
 */
export async function performSearch(page, iframe, iframeId, searchValue, screenshotsDir) {
  // STEP 1: Look for the search dropdown/selector in the iframe (robust logic from findAndVerifyClient)
  console.log('🔍 [STEP 9] Looking for search dropdown in iframe...');
  
  // Look for the specific dropdown by ID first, then fallback to generic selectors
  let searchDropdown = iframe.locator('#cntFindWhat').first();
  
  if (await searchDropdown.count() === 0) {
    // Fallback to generic selectors
    searchDropdown = iframe.locator('select, [role="combobox"], .dx-dropdowneditor, [data-onchange="chgCntFindWhat"]').first();
  }
  
  // Wait for the dropdown to be visible
  await searchDropdown.waitFor({ state: 'visible', timeout: 10000 });
  
  console.log('✅ [STEP 9] Found search dropdown, clicking to open options...');
  
  // Try clicking the dropdown button first (more specific), then fallback to the container
  const dropdownButton = searchDropdown.locator('[role="button"][aria-label="Select"], .dx-dropdowneditor-button').first();
  if (await dropdownButton.count() > 0) {
    await dropdownButton.click();
  } else {
    // Fallback: click on the dropdown container itself
    await searchDropdown.click();
  }
  
  const smartSearchOption = iframe.locator('div.dx-list-item[role="option"]:has-text("Smart search")').first();
  await smartSearchOption.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  
  await takeScreenshot(page, 'dropdown-menu-opened.png', screenshotsDir);
  
  const isSmartSearchVisible = await smartSearchOption.isVisible();
  console.log(`🔍 [STEP 9] Smart search visible: ${isSmartSearchVisible}`);
  
  if (!isSmartSearchVisible) {
    console.log('🔍 [STEP 9] Smart search not visible, scrolling up in dropdown...');
    await page.keyboard.press('Home');
    await page.waitForTimeout(CRM_STABILITY_DELAY_MS);
    const dropdownMenu = iframe.locator('[role="listbox"], .dx-dropdownlist, .dx-list, .dx-list-items').first();
    if (await dropdownMenu.count() > 0) {
      await dropdownMenu.evaluate(el => el.scrollTop = 0);
      await page.waitForTimeout(CRM_STABILITY_DELAY_MS);
    }
  }
  
  await smartSearchOption.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✅ [STEP 9] Smart search option is now visible, clicking...');
  await smartSearchOption.click();
  await iframe.locator('#cntSearchParams input, input[placeholder*="search"], input[placeholder*="Search"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  
  await takeScreenshot(page, 'smart-search-selected.png', screenshotsDir);
  
  // STEP 3: Look for the search input field (robust logic from findAndVerifyClient)
  console.log('🔍 [STEP 9] Looking for search input field...');
  
  // Look for the specific search input by ID first (target the input inside the container)
  let searchField = iframe.locator('#cntSearchParams input.dx-texteditor-input, #cntSearchParams input[type="text"]').first();
  
  if (await searchField.count() === 0) {
    // Fallback: try the container itself (might be clickable)
    searchField = iframe.locator('#cntSearchParams').first();
  }
  
  if (await searchField.count() === 0) {
    // Final fallback to generic selectors
    searchField = iframe.locator('input[placeholder*="search"], input[placeholder*="Search"], input[type="search"], input[data-placeholder*="Search"]').first();
  }
  
  // Wait for the search field to be visible
  await searchField.waitFor({ state: 'visible', timeout: 10000 });
  
  // STEP 4: Enter search value (mobile or email) in search field
  console.log(`🔍 [STEP 9] Searching for client: ${searchValue}`);
  await searchField.fill(searchValue);
  
  // NEW: Try multiple approaches to trigger the search (robust logic from findAndVerifyClient)
  console.log('🔍 [STEP 9] Triggering search...');
  
  await searchField.press('Enter');
  await waitForThenOptionalDelay(page, iframe.locator('table.dx-datagrid-table tr.dx-row.dx-data-row, table tbody tr').first(), { state: 'visible', timeout: 8000, delayMs: CRM_STABILITY_DELAY_MS }).catch(() => {});

  console.log('🔍 [STEP 9] Looking for search icon/button...');
  const searchButton = iframe.locator('button[type="submit"], .search-button, [aria-label*="search"], [title*="search"], .fa-search, .search-icon').first();
  
  if (await searchButton.count() > 0) {
    console.log('✅ [STEP 9] Found search button, clicking...');
    await searchButton.click();
    await iframe.locator('table.dx-datagrid-table tr.dx-row.dx-data-row, table tbody tr').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  } else {
    console.log('❌ [STEP 9] No search button found, trying alternative...');
    
    // Approach 3: Safer approach - Use JavaScript to blur the input field directly
    console.log('🔍 [STEP 9] Blurring search input field to trigger search...');
    try {
      const frameElement = await page.$(iframeId);
      if (frameElement) {
        const actualFrame = await frameElement.contentFrame();
        if (actualFrame) {
          await actualFrame.evaluate(() => {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.tagName === 'INPUT') {
              activeElement.blur();
            }
          });
          console.log('✅ [STEP 9] Blurred search input field using JavaScript');
        }
      }
    } catch (e) {
      console.log(`⚠️ [STEP 9] Could not blur input: ${e.message}, trying container click...`);
      // Fallback: Try clicking on a safe container
      const safeContainer = iframe.locator('.jqx_pageContent, .dx-widget, [class*="container"]').first();
      if (await safeContainer.count() > 0) {
        await safeContainer.click({ position: { x: 10, y: 10 }, force: true });
        console.log('✅ [STEP 9] Clicked on safe container');
      } else {
        // Last resort: Click on body at top-left corner (less likely to hit interactive elements)
        await iframe.locator('body').click({ position: { x: 10, y: 10 }, force: true });
        console.log('⚠️ [STEP 9] Clicked on body as last resort');
      }
    }
    await iframe.locator('table.dx-datagrid-table tr.dx-row.dx-data-row, table tbody tr').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  }

  await page.waitForTimeout(CRM_STABILITY_DELAY_MS);

  // CRITICAL: Wait until results grid has at least one data row (same selector as selectClient)
  // so we don't call selectClient before the grid has rendered and return "no matches" early.
  const resultRowsLocator = iframe.locator(RESULTS_GRID_ROW_SELECTOR);
  const deadline = Date.now() + RESULTS_READY_TIMEOUT_MS;
  let rowCount = await resultRowsLocator.count();
  while (rowCount === 0 && Date.now() < deadline) {
    await page.waitForTimeout(RESULTS_POLL_INTERVAL_MS);
    rowCount = await resultRowsLocator.count();
  }
  if (rowCount === 0) {
    console.log('⚠️ [STEP 9] No result rows visible after waiting - selectClient may still retry once');
  } else {
    console.log(`✅ [STEP 9] Results grid ready: ${rowCount} row(s) visible`);
  }
  await page.waitForTimeout(CRM_RESULTS_STABILITY_MS);

  // Take screenshot after search
  await takeScreenshot(page, 'contact-search-results.png', screenshotsDir);
}
