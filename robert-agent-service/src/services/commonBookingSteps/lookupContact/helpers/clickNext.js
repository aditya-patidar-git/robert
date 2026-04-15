/**
 * Click Next Helper
 * Handles Next button clicking on Contact Details page
 * Preserves all Playwright timing and state checks
 */

import { takeScreenshot } from '../../utils.js';

/**
 * Detect a CRM error/alert dialog (shown when the page transition fails due
 * to validation issues), dismiss it by clicking OK, and return the error text.
 * Returns null when no dialog is found.
 */
async function detectAndDismissCrmErrorDialog(page) {
  const selectors = [
    '.dx-overlay-wrapper .dx-dialog-message',
    '.dx-popup-wrapper .dx-dialog-message',
    '.dx-overlay-wrapper .dx-popup-content',
    '.dx-dialog-wrapper .dx-popup-content',
    '[role="dialog"] .dx-popup-content',
  ];

  // Also check inside eventNewBooking2_iframe — CRM may render the dialog there
  const contexts = [page];
  try {
    const iframeEl = await page.$('#eventNewBooking2_iframe');
    if (iframeEl) {
      const frame = await iframeEl.contentFrame();
      if (frame) contexts.push(frame);
    }
  } catch (_) { /* iframe may not exist */ }

  for (const ctx of contexts) {
    for (const sel of selectors) {
      try {
        const el = ctx.locator ? ctx.locator(sel).first() : null;
        if (!el) continue;
        if (await el.count() === 0) continue;
        const visible = await el.isVisible().catch(() => false);
        if (!visible) continue;

        const dialogText = (await el.textContent().catch(() => '') || '').trim();
        console.log(`⚠️ [STEP 9] CRM error dialog detected: "${dialogText}"`);
        await takeScreenshot(ctx === page ? page : page, 'crm-error-dialog.png', undefined);

        // Dismiss: click OK / Close button
        const okSelectors = [
          '.dx-dialog-button .dx-button:has-text("OK")',
          '.dx-popup-bottom .dx-button:has-text("OK")',
          '[aria-label="OK"]',
          '.dx-dialog-button .dx-button',
          '.dx-popup-bottom .dx-button',
        ];
        for (const okSel of okSelectors) {
          try {
            const okBtn = ctx.locator ? ctx.locator(okSel).first() : null;
            if (!okBtn || await okBtn.count() === 0) continue;
            await okBtn.click({ timeout: 3000 });
            console.log(`✅ [STEP 9] Dismissed CRM error dialog via ${okSel}`);
            break;
          } catch (_) { /* try next selector */ }
        }

        return dialogText || 'Unknown CRM error';
      } catch (_) { /* try next selector */ }
    }
  }

  // Fallback: check for browser-native alert/confirm dialogs that may have already appeared
  // (Playwright auto-dismisses these but we can detect them via page events — not needed here
  // since CRM uses DevExpress overlay dialogs, not native alerts)

  return null;
}

/**
 * Click Next button on Contact Details page
 * @param {Object} page - Playwright page object
 * @param {Object} iframe - Iframe locator (may be null)
 * @param {string} iframeId - Iframe ID (may be null)
 * @param {string} screenshotsDir - Screenshots directory
 */
export async function clickNext(page, iframe, iframeId, screenshotsDir) {
  // Click Next button to proceed to next step
  // Need to check both contactSelect_iframe AND eventNewBooking2_iframe
  console.log('👆 [STEP 9] Clicking Next button on Contact Details page...');
  
  let nextButton = null;
  
  // Strategy 1: Try eventNewBooking2_iframe first (most likely location after client selection)
  const eventBookingIframeForNext = page.frameLocator('#eventNewBooking2_iframe');
  const eventBookingIframeForNextExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
  
  if (eventBookingIframeForNextExists) {
    console.log('🔍 [STEP 9] Checking eventNewBooking2_iframe for Next button...');
    nextButton = eventBookingIframeForNext.locator('#diaryNewCourseBookingWiz_nextBtn').first();
    
    if (await nextButton.count() === 0) {
      nextButton = eventBookingIframeForNext.locator('[aria-label="Next"], [aria-label="next"]').first();
    }
    
    if (await nextButton.count() === 0) {
      nextButton = eventBookingIframeForNext.locator('button:has-text("Next"), button:has-text("next")').first();
    }
    
    if (await nextButton.count() === 0) {
      nextButton = eventBookingIframeForNext.locator('.jqx_wizardBtn, .dx-button:has-text("Next"), .jqx_button:has-text("Next")').first();
    }
    
    if (await nextButton.count() > 0) {
      console.log('✅ [STEP 9] Found Next button in eventNewBooking2_iframe!');
    }
  }
  
  // Strategy 2: If not found, try the current iframe context (contactSelect_iframe)
  if ((!nextButton || await nextButton.count() === 0) && iframe) {
    console.log('🔍 [STEP 9] Checking current iframe context for Next button...');
    nextButton = iframe.locator('#diaryNewCourseBookingWiz_nextBtn').first();
    
    if (await nextButton.count() === 0) {
      nextButton = iframe.locator('[aria-label="Next"], [aria-label="next"]').first();
    }
    
    if (await nextButton.count() === 0) {
      nextButton = iframe.locator('button:has-text("Next"), button:has-text("next")').first();
    }
    
    if (await nextButton.count() === 0) {
      nextButton = iframe.locator('.jqx_wizardBtn, .dx-button:has-text("Next"), .jqx_button:has-text("Next")').first();
    }
    
    if (await nextButton.count() > 0) {
      console.log('✅ [STEP 9] Found Next button in current iframe context!');
    }
  }
  
  // Strategy 3: Try main page as last resort
  if (!nextButton || await nextButton.count() === 0) {
    console.log('🔍 [STEP 9] Trying main page for Next button...');
    nextButton = page.locator('#diaryNewCourseBookingWiz_nextBtn, [aria-label="Next"], button:has-text("Next")').first();
  }
  
  if (!nextButton || await nextButton.count() === 0) {
    // Take a screenshot for debugging
    await takeScreenshot(page, 'next-button-not-found.png', screenshotsDir);
    throw new Error('Next button not found on Contact Details page - checked eventNewBooking2_iframe, current iframe, and main page');
  }
  
  // Wait for button to be attached (not visible, as it may be hidden)
  try {
    await nextButton.waitFor({ state: 'attached', timeout: 10000 });
    console.log('✅ [STEP 9] Next button is attached to DOM');
    
    // CRITICAL: Use JavaScript click (same approach as early check) - works even if button is not visible
    // This ensures reliable clicking and immediate return after success
    console.log('👆 [STEP 9] Clicking Next button using JavaScript (bypasses visibility checks)...');
    
    // Determine which iframe to use for JavaScript evaluation
    let targetFrame = null;
    if (eventBookingIframeForNextExists) {
      try {
        const frameElement = await page.$('#eventNewBooking2_iframe');
        if (frameElement) {
          targetFrame = await frameElement.contentFrame();
        }
      } catch (e) {
        console.log(`⚠️ [STEP 9] Could not get eventNewBooking2_iframe for evaluation: ${e.message}`);
      }
    }
    
    if (!targetFrame && iframe) {
      try {
        const frameElement = await page.$(iframeId);
        if (frameElement) {
          targetFrame = await frameElement.contentFrame();
        }
      } catch (e) {
        console.log(`⚠️ [STEP 9] Could not get iframe for evaluation: ${e.message}`);
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
          const altBtn = document.querySelector('[aria-label="Next"], [aria-label="next"]');
          if (altBtn) {
            altBtn.click();
            return true;
          }
          return false;
        });
        
        if (clickSuccess) {
          // Wait briefly for CRM to process the click and potentially show error dialogs
          await page.waitForTimeout(1500);

          // Check for CRM error dialog (e.g. validation failure on Contact → Pay transition)
          const crmError = await detectAndDismissCrmErrorDialog(page);
          if (crmError) {
            throw new Error(`CRM rejected the page transition: "${crmError}". A required field may be missing or invalid on the contact details page.`);
          }

          console.log('✅ [STEP 9] ============================================');
          console.log('✅ [STEP 9] SUCCESS: Next button clicked successfully!');
          console.log('✅ [STEP 9] Contact details step completed.');
          console.log('✅ [STEP 9] IMMEDIATELY proceeding to payment step.');
          console.log('✅ [STEP 9] ============================================');
          
          return;
        }
      } catch (jsErr) {
        if (jsErr.message && jsErr.message.includes('CRM rejected the page transition')) {
          throw jsErr;
        }
        console.log(`⚠️ [STEP 9] JavaScript click failed: ${jsErr.message}, trying Playwright click as fallback...`);
      }
    }
    
    // Fallback to Playwright click only if JavaScript fails or frame not available
    const isVisible = await nextButton.isVisible().catch(() => false);
    
    if (isVisible) {
      await nextButton.click({ timeout: 5000 });
      console.log('✅ [STEP 9] Clicked Next button (Playwright fallback - visible)');
    } else {
      console.log('⚠️ [STEP 9] Next button is hidden, using force click');
      await nextButton.click({ force: true, timeout: 5000 });
      console.log('✅ [STEP 9] Clicked Next button (Playwright fallback - force)');
    }

    await page.waitForTimeout(1500);

    const crmErrorFallback = await detectAndDismissCrmErrorDialog(page);
    if (crmErrorFallback) {
      throw new Error(`CRM rejected the page transition: "${crmErrorFallback}". A required field may be missing or invalid on the contact details page.`);
    }
    
    console.log('✅ [STEP 9] ============================================');
    console.log('✅ [STEP 9] SUCCESS: Next button clicked successfully!');
    console.log('✅ [STEP 9] Contact details step completed.');
    console.log('✅ [STEP 9] Ready to proceed to payment step.');
    console.log('✅ [STEP 9] ============================================');
    
    return;
  } catch (clickErr) {
    // Handle browser closure or other errors gracefully
    if (clickErr.message.includes('Target page, context or browser has been closed')) {
      console.log('⚠️ [STEP 9] Browser was closed during Next button click');
      throw new Error('Browser was closed - cannot proceed with Next button click');
    }
    throw clickErr;
  }
}
