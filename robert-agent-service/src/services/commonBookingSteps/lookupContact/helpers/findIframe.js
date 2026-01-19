/**
 * Find Iframe Helper
 * Finds and waits for contact lookup iframe
 * Preserves all Playwright timing and state checks
 */

import { takeScreenshot } from '../../utils.js';

/**
 * Find and wait for contact lookup iframe
 * @param {Object} page - Playwright page object
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<{iframe: Object, iframeId: string}>} Iframe locator and ID
 */
export async function findIframe(page, screenshotsDir) {
  // WAIT FOR CONTACT PAGE TO LOAD - 3 seconds
  console.log('⏳ [STEP 9] Waiting for contact page to load...');
  await page.waitForTimeout(3000);
  
  // The contact choice page is inside eventNewBooking2_iframe
  console.log('🔍 [STEP 9] Checking for contact choice page in iframe...');
  const eventBookingIframeExistsCheck = await page.locator('#eventNewBooking2_iframe').count() > 0;
  
  if (!eventBookingIframeExistsCheck) {
    throw new Error('eventNewBooking2_iframe not found - contact choice page may not have loaded');
  }
  
  const eventBookingIframe = page.frameLocator('#eventNewBooking2_iframe');
  
  // Wait for iframe to be ready
  await page.waitForTimeout(2000);
  
  // Should see "Contact choice" or "3. Contact" page with two options
  console.log('🔍 [STEP 9] Looking for contact choice page indicators...');
  const contactChoiceIndicators = [
    'text=Contact choice',
    'text=3. Contact',
    'text=Choose one of these options',
    '#btnBookExisting'  // The lookup contact button ID
  ];
  
  let contactPageFound = false;
  for (const indicator of contactChoiceIndicators) {
    const element = eventBookingIframe.locator(indicator).first();
    if (await element.count() > 0) {
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`✅ [STEP 9] Found contact choice page indicator: "${indicator}"`);
        contactPageFound = true;
        break;
      }
    }
  }
  
  if (!contactPageFound) {
    console.log('⚠️ [STEP 9] Contact choice page indicators not found, but continuing...');
  }
  
  // Take screenshot of contact page
  await takeScreenshot(page, 'contact-page-loaded.png', screenshotsDir);
  
  // Click "Lookup contact..." button - use specific ID first, then fallback to text
  console.log('👆 [STEP 9] Clicking Lookup contact...');
  let lookupButton = eventBookingIframe.locator('#btnBookExisting').first();
  
  if (await lookupButton.count() === 0) {
    // Fallback: try text-based selectors
    lookupButton = eventBookingIframe.locator('button:has-text("Lookup contact"), button:has-text("Lookup Contact"), .contactButton, [aria-label*="Lookup contact"]').first();
  }
  
  if (await lookupButton.count() === 0) {
    throw new Error('Lookup contact button not found in contact choice page');
  }
  
  // FIX: Wait for button to be attached (not visible, as it may be hidden but still clickable)
  try {
    await lookupButton.waitFor({ state: 'attached', timeout: 10000 });
    console.log('✅ [STEP 9] Lookup contact button is attached to DOM');
    
    // Try to scroll button into view
    try {
      await lookupButton.scrollIntoViewIfNeeded({ timeout: 2000 });
      console.log('✅ [STEP 9] Scrolled Lookup contact button into view');
    } catch (scrollErr) {
      console.log('⚠️ [STEP 9] Could not scroll Lookup contact button into view:', scrollErr.message);
    }
    
    // Check if button is visible
    const isVisible = await lookupButton.isVisible().catch(() => false);
    
    if (isVisible) {
      // Button is visible, click normally
      await lookupButton.click({ timeout: 5000 });
      console.log('✅ [STEP 9] Clicked Lookup contact button (visible)');
    } else {
      // Button is hidden, use force click (button exists in DOM and is clickable)
      console.log('⚠️ [STEP 9] Lookup contact button is hidden, using force click');
      await lookupButton.click({ force: true, timeout: 5000 });
      console.log('✅ [STEP 9] Clicked Lookup contact button (force)');
    }
  } catch (clickErr) {
    // Handle browser closure or other errors gracefully
    if (clickErr.message.includes('Target page, context or browser has been closed')) {
      console.log('⚠️ [STEP 9] Browser was closed during Lookup contact button click');
      throw new Error('Browser was closed - cannot proceed with Lookup contact button click');
    }
    // Re-throw other errors
    throw clickErr;
  }
  
  // WAIT FOR LOOKUP PAGE TO LOAD - 8 seconds
  console.log('⏳ [STEP 9] Waiting for contact lookup page to fully load...');
  await page.waitForTimeout(8000);
  
  // Take screenshot of contact lookup page
  await takeScreenshot(page, 'contact-lookup-page-loaded.png', screenshotsDir);
  
  // DETECT CORRECT IFRAME: Check for contactSelect_iframe first (the actual iframe for contact lookup in booking flow)
  console.log('🔍 [STEP 9] Looking for contact lookup iframe...');
  
  let iframe;
  let iframeId;
  const contactSelectIframeExists = await page.locator('#contactSelect_iframe').count() > 0;
  const contactLookupIframeExists = await page.locator('#contactLookup_iframe').count() > 0;
  const eventBookingIframeStillExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
  
  if (contactSelectIframeExists) {
    iframeId = '#contactSelect_iframe';
    iframe = page.frameLocator('#contactSelect_iframe');
    console.log('✅ [STEP 9] Found contactSelect_iframe, using it for contact search');
  } else if (contactLookupIframeExists) {
    iframeId = '#contactLookup_iframe';
    iframe = page.frameLocator('#contactLookup_iframe');
    console.log('✅ [STEP 9] Found contactLookup_iframe, using it for contact search');
  } else if (eventBookingIframeStillExists) {
    iframeId = '#eventNewBooking2_iframe';
    iframe = page.frameLocator('#eventNewBooking2_iframe');
    console.log('✅ [STEP 9] Using eventNewBooking2_iframe for contact search');
  } else {
    throw new Error('No contact lookup iframe found - contact lookup page may not have loaded');
  }
  
  // Wait for the iframe to load completely (same as findAndVerifyClient)
  console.log('⏳ [STEP 9] Waiting for iframe to load completely...');
  await page.waitForTimeout(5000);
  
  // Wait for the iframe content to be ready
  await page.waitForFunction((id) => {
    const iframe = document.querySelector(id);
    return iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete';
  }, iframeId, { timeout: 15000 });
  
  console.log('✅ [STEP 9] Iframe loaded, switching context...');
  
  // Debug: Check what's actually in the iframe
  console.log('🔍 [STEP 9] Debug: Checking iframe content...');
  const iframeText = await iframe.locator('body').textContent();
  console.log('🔍 [STEP 9] Iframe content preview:', iframeText ? iframeText.substring(0, 200) + '...' : 'No content');
  
  return { iframe, iframeId };
}
