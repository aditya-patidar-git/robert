/**
 * Check Already On Page Helper
 * Checks if already on client details page and handles early return
 * Preserves all Playwright timing and state checks
 */

import { takeScreenshot, CRM_STABILITY_DELAY_MS } from '../../utils.js';

/**
 * Check if already on client details page
 * @param {Object} page - Playwright page object
 * @param {string} identifier - Optional email for DOM check (empty when search was by mobile)
 * @param {string} screenshotsDir - Screenshots directory
 * @param {boolean} skipNextClick - If true, skip clicking Next button
 * @param {boolean} [allowSkipIfAlreadyOnPage=true] - If false, never skip (run full lookup). Use when we have not yet completed this step.
 * @returns {Promise<boolean>} True if already on page and handled, false otherwise
 */
export async function checkAlreadyOnPage(page, identifier, screenshotsDir, skipNextClick, allowSkipIfAlreadyOnPage = true) {
  if (!allowSkipIfAlreadyOnPage) {
    console.log('🔍 [STEP 9] Skipping "already on page" check (allowSkipIfAlreadyOnPage=false) - running full lookup.');
    return false;
  }
  console.log('🔍 [STEP 9] Checking if already on client details page...');
  await page.waitForSelector('#eventNewBooking2_iframe, #contactSelect_iframe', { state: 'attached', timeout: 5000 }).catch(() => {});

  const eventBookingIframeExistsEarly = await page.locator('#eventNewBooking2_iframe').count() > 0;
  const contactSelectIframeExistsEarly = await page.locator('#contactSelect_iframe').count() > 0;

  if (eventBookingIframeExistsEarly || contactSelectIframeExistsEarly) {
    const eventBookingIframe = page.frameLocator('#eventNewBooking2_iframe');
    const contactSelectIframe = contactSelectIframeExistsEarly ? page.frameLocator('#contactSelect_iframe') : null;

    const hasFormFields =
      (await eventBookingIframe.locator('text=First Names').count() > 0) ||
      (await eventBookingIframe.locator('text=Surname').count() > 0) ||
      (await eventBookingIframe.locator('text=Contact e-mail').count() > 0);
    const hasIdentifierInDom = identifier ? (await eventBookingIframe.locator(`text=${identifier}`).count() > 0) : false;
    const alreadyOnClientDetails =
      hasFormFields ||
      hasIdentifierInDom ||
      (contactSelectIframe && await contactSelectIframe.locator('text=First Names').count() > 0) ||
      (contactSelectIframe && await contactSelectIframe.locator('text=Surname').count() > 0);
    
    if (alreadyOnClientDetails) {
      console.log('✅ [STEP 9] ============================================');
      console.log('✅ [STEP 9] ALREADY ON CLIENT DETAILS PAGE!');
      if (identifier) console.log(`✅ [STEP 9] Client (${identifier}) was previously selected successfully.`);
      console.log('✅ [STEP 9] Client details page is already loaded.');
      
      // CRITICAL FIX: Respect skipNextClick parameter
      if (skipNextClick) {
        console.log('⏸️ [STEP 9] Skipping Next button click (skipNextClick=true) - house number may need to be filled first');
        console.log('✅ [STEP 9] ============================================');
        await takeScreenshot(page, 'client-already-selected.png', screenshotsDir);
        return true; // Return early without clicking Next
      }
      
      // Also check if house number field is empty - if so, don't click Next yet
      // This allows fillContactDetails to fill the house number first
      try {
        const eventBookingIframe = page.frameLocator('#eventNewBooking2_iframe');
        const houseNumberField = eventBookingIframe.locator('#cmp_buildingnumber .dx-texteditor-input');
        
        if (await houseNumberField.count() > 0) {
          const houseNumberValue = await houseNumberField.inputValue().catch(() => '');
          if (!houseNumberValue || houseNumberValue.trim() === '') {
            console.log('⏸️ [STEP 9] House number field is empty - skipping Next button click to allow fillContactDetails to fill it first');
            console.log('✅ [STEP 9] ============================================');
            await takeScreenshot(page, 'client-already-selected.png', screenshotsDir);
            return true; // Return early without clicking Next - let fillContactDetails handle house number first
          }
        }
      } catch (checkError) {
        // If we can't check the house number field, continue with Next button click
        console.log(`⚠️ [STEP 9] Could not check house number field: ${checkError.message}, proceeding with Next button click`);
      }
      
      console.log('✅ [STEP 9] Skipping lookup flow and proceeding directly to Next button...');
      console.log('✅ [STEP 9] ============================================');
      
      await takeScreenshot(page, 'client-already-selected.png', screenshotsDir);
      
      // Proceed directly to Next button click (skip entire lookup flow)
      // Use the iframe that exists
      const iframeForNext = eventBookingIframeExistsEarly ? eventBookingIframe : contactSelectIframe;
      const iframeIdForNext = eventBookingIframeExistsEarly ? '#eventNewBooking2_iframe' : '#contactSelect_iframe';
      
      await iframeForNext.locator('#diaryNewCourseBookingWiz_nextBtn, text=First Names').first().waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(CRM_STABILITY_DELAY_MS);

      // Click Next button
      console.log('👆 [STEP 9] Clicking Next button on Contact Details page...');
      
      let nextButton = iframeForNext.locator('#diaryNewCourseBookingWiz_nextBtn').first();
      
      if (await nextButton.count() === 0) {
        nextButton = iframeForNext.locator('[aria-label="Next"], [aria-label="next"]').first();
      }
      
      if (await nextButton.count() === 0) {
        nextButton = iframeForNext.locator('button:has-text("Next"), button:has-text("next")').first();
      }
      
      if (await nextButton.count() === 0) {
        nextButton = iframeForNext.locator('.jqx_wizardBtn, .dx-button:has-text("Next"), .jqx_button:has-text("Next")').first();
      }
      
      if (await nextButton.count() === 0) {
        // Try main page as fallback
        nextButton = page.locator('#diaryNewCourseBookingWiz_nextBtn, [aria-label="Next"], button:has-text("Next")').first();
      }
      
      if (await nextButton.count() === 0) {
        await takeScreenshot(page, 'next-button-not-found-skip.png', screenshotsDir);
        throw new Error('Next button not found on Contact Details page');
      }
      
      await nextButton.waitFor({ state: 'attached', timeout: 10000 });
      console.log('✅ [STEP 9] Next button is attached to DOM');
      
      // CRITICAL: Use JavaScript click (same approach as normal flow) - works even if button is not visible
      // This ensures reliable clicking and immediate return after success
      console.log('👆 [STEP 9] Clicking Next button using JavaScript (bypasses visibility checks)...');
      
      // Determine which iframe to use for JavaScript evaluation (same pattern as normal flow)
      let targetFrame = null;
      if (eventBookingIframeExistsEarly) {
        try {
          const frameElement = await page.$('#eventNewBooking2_iframe');
          if (frameElement) {
            targetFrame = await frameElement.contentFrame();
          }
        } catch (e) {
          console.log(`⚠️ [STEP 9] Could not get eventNewBooking2_iframe for evaluation: ${e.message}`);
        }
      }
      
      if (!targetFrame && contactSelectIframeExistsEarly) {
        try {
          const frameElement = await page.$('#contactSelect_iframe');
          if (frameElement) {
            targetFrame = await frameElement.contentFrame();
          }
        } catch (e) {
          console.log(`⚠️ [STEP 9] Could not get contactSelect_iframe for evaluation: ${e.message}`);
        }
      }
      
      if (targetFrame) {
        try {
          const clickSuccess = await targetFrame.evaluate(() => {
            const btn = document.querySelector('#diaryNewCourseBookingWiz_nextBtn');
            if (btn) {
              btn.click();
              return true;
            }
            // Try alternative selectors
            const altBtn = document.querySelector('[aria-label="Next"], [aria-label="next"]');
            if (altBtn) {
              altBtn.click();
              return true;
            }
            return false;
          });
          
          if (clickSuccess) {
            console.log('✅ [STEP 9] ============================================');
            console.log('✅ [STEP 9] SUCCESS: Next button clicked successfully!');
            console.log(`✅ [STEP 9] Client: ${identifier || 'contact'}`);
            console.log('✅ [STEP 9] Contact details step completed.');
            console.log('✅ [STEP 9] IMMEDIATELY proceeding to payment step.');
            console.log('✅ [STEP 9] ============================================');
            
            // CRITICAL: Return immediately after successful click - no delays, no screenshots, no further checks
            return true; // Early return - skip all lookup flow and any further processing
          }
        } catch (jsErr) {
          console.log(`⚠️ [STEP 9] JavaScript click failed: ${jsErr.message}, trying Playwright click as fallback...`);
        }
      }
      
      // Fallback to Playwright click only if JavaScript fails or frame not available
      const isVisible = await nextButton.isVisible().catch(() => false);
      if (isVisible) {
        await nextButton.click({ timeout: 5000 });
        console.log('✅ [STEP 9] Clicked Next button (Playwright fallback - visible)');
      } else {
        await nextButton.click({ force: true, timeout: 5000 });
        console.log('✅ [STEP 9] Clicked Next button (Playwright fallback - force)');
      }
      
      console.log('✅ [STEP 9] ============================================');
      console.log('✅ [STEP 9] SUCCESS: Contact details step completed!');
      console.log(`✅ [STEP 9] Client: ${identifier || 'contact'}`);
      console.log('✅ [STEP 9] Next button clicked successfully.');
      console.log('✅ [STEP 9] Ready to proceed to payment step.');
      console.log('✅ [STEP 9] ============================================');
      
      // Return immediately after successful click
      return true; // Early return - skip all lookup flow
    }
  }
  
  return false; // Not already on page, continue with lookup flow
}
