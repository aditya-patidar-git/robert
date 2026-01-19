import { takeScreenshot } from '../../utils.js';

/**
 * Navigates to the Diaries tab and waits for the page to fully load.
 * @param {import('playwright').Page} page - Playwright page object.
 * @param {string} screenshotsDir - Directory to save screenshots.
 * @returns {Promise<void>}
 * @throws {Error} If the Diaries tab cannot be found or the page fails to load.
 */
export async function navigateToDiariesTab(page, screenshotsDir) {
  console.log('📅 [STEP 6-7] Navigating to Diaries tab...');
  
  // WAIT FOR PAGE TO BE READY - 3 seconds
  console.log('⏳ [STEP 6-7] Waiting for page to be ready...');
  await page.waitForTimeout(3000);
  
  // Debug: Check what's actually on the page
  console.log('🔍 Debug: Checking page URL and title...');
  const currentUrl = page.url();
  const pageTitle = await page.title();
  console.log(`Current URL: ${currentUrl}`);
  console.log(`Page Title: ${pageTitle}`);
  
  // Click Diaries tab using the same approach as Contacts tab
  console.log('🔍 [STEP 6-7] Looking for Diaries tab...');
  
  // Approach 1: Look for the specific Diaries tab using the same selector as Contacts
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
  
  // Approach 2: Look for any element with "Diaries" text
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
  
  // WAIT FOR DIARIES PAGE TO FULLY LOAD - 8 seconds (increased)
  console.log('⏳ [STEP 6-7] Waiting for Diaries page to fully load...');
  await page.waitForTimeout(8000);
  
  // Check if page is already loaded instead of waiting for networkidle
  console.log('🔍 [STEP 6-7] Checking if Diaries page is already loaded...');
  
  // Check for the presence of the date input field - this is the key indicator
  const dateInputExists = await page.locator('#start_date').count() > 0;
  
  if (dateInputExists) {
    console.log('✅ [STEP 6-7] Diaries page is already loaded - found #start_date element');
  } else {
    console.log('🔍 [STEP 6-7] Date input not found on main page, checking for iframe...');
    
    // Check if Diaries content is loaded in an iframe (similar to Contacts page)
    const diariesIframeExists = await page.locator('#newDiaryDefault_iframe').count() > 0;
    
    if (diariesIframeExists) {
      console.log('🔍 [STEP 6-7] Found Diaries iframe, checking if content is inside...');
      
      // Wait for iframe to load completely
      await page.waitForTimeout(3000);
      
      // Wait for the iframe content to be ready
      await page.waitForFunction(() => {
        const iframe = document.querySelector('#newDiaryDefault_iframe');
        return iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete';
      }, { timeout: 15000 });
      
      console.log('✅ Diaries iframe loaded, checking for content inside iframe...');
      
      // Check for date input inside the specific Diaries iframe
      const iframe = page.frameLocator('#newDiaryDefault_iframe');
      const dateInputInIframe = await iframe.locator('#start_date').count() > 0;
      
      if (dateInputInIframe) {
        console.log('✅ [STEP 6-7] Diaries page loaded in iframe - found #start_date element');
      } else {
        console.log('⏳ [STEP 6-7] Date input not found in iframe, waiting for networkidle...');
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      }
    } else {
      console.log('⏳ [STEP 6-7] No iframe found, waiting for networkidle...');
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    }
  }
  
  // Take screenshot of diaries page
  await takeScreenshot(page, 'diaries-page-loaded.png', screenshotsDir);
}
