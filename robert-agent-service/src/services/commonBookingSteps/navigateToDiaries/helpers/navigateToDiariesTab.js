import { takeScreenshot, CRM_IFRAME_TIMEOUT_MS, CRM_STABILITY_DELAY_MS } from '../../utils.js';

const DIARIES_LOAD_TIMEOUT_MS = 12000;

/**
 * Navigates to the Diaries tab and waits for the page to fully load.
 * @param {import('playwright').Page} page - Playwright page object.
 * @param {string} screenshotsDir - Directory to save screenshots.
 * @returns {Promise<void>}
 * @throws {Error} If the Diaries tab cannot be found or the page fails to load.
 */
export async function navigateToDiariesTab(page, screenshotsDir) {
  console.log('📅 [STEP 6-7] Navigating to Diaries tab...');

  console.log('🔍 [STEP 6-7] Looking for Diaries tab...');

  let diariesTab = null;
  let found = false;

  try {
    diariesTab = page.locator('h3.list-menu-item-heading:has-text("Diaries")');
    const isVisible = await diariesTab.isVisible();
    console.log(`Diaries tab found, visible: ${isVisible}`);
    if (isVisible) {
      found = true;
      console.log('✅ Found visible Diaries tab');
    }
  } catch (e) {
    console.log('❌ Diaries tab not found with h3 selector, trying alternatives...');
  }

  if (!found) {
    console.log('🔍 Looking for any Diaries element...');
    try {
      diariesTab = page.locator('a:has-text("Diaries"), button:has-text("Diaries"), [href*="diary"], text=Diaries').first();
      const isVisible = await diariesTab.isVisible();
      console.log(`Alternative Diaries element found, visible: ${isVisible}`);
      if (isVisible) {
        found = true;
        console.log('✅ Found alternative Diaries element');
      }
    } catch (e) {
      console.log('❌ Alternative Diaries element not found');
    }
  }

  if (!found || !diariesTab) {
    throw new Error('Could not find any visible Diaries tab element on the page');
  }

  console.log('✅ Found Diaries tab, clicking...');
  await diariesTab.click();

  // Wait for Diaries page: either #start_date on main page or #newDiaryDefault_iframe then iframe ready
  console.log('⏳ [STEP 6-7] Waiting for Diaries page to load...');
  const dateOnMain = page.locator('#start_date').first();
  try {
    await dateOnMain.waitFor({ state: 'visible', timeout: DIARIES_LOAD_TIMEOUT_MS });
    console.log('✅ [STEP 6-7] Diaries page loaded - found #start_date on main page');
  } catch (e) {
    await page.waitForSelector('#newDiaryDefault_iframe', { state: 'attached', timeout: DIARIES_LOAD_TIMEOUT_MS });
    await page.waitForFunction(() => {
      const iframe = document.querySelector('#newDiaryDefault_iframe');
      return iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete';
    }, { timeout: CRM_IFRAME_TIMEOUT_MS });
    await page.waitForTimeout(CRM_STABILITY_DELAY_MS);
    const iframe = page.frameLocator('#newDiaryDefault_iframe');
    const dateInIframe = iframe.locator('#start_date').first();
    try {
      await dateInIframe.waitFor({ state: 'visible', timeout: 5000 });
      console.log('✅ [STEP 6-7] Diaries page loaded in iframe - found #start_date');
    } catch (e2) {
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    }
  }

  await takeScreenshot(page, 'diaries-page-loaded.png', screenshotsDir);
}
