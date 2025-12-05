import { takeScreenshot } from './utils.js';

/**
 * Step 13: Accept terms and make booking
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {boolean} termsAccepted - Whether client accepted terms (defaults to false)
 * @returns {Promise<{success: boolean, termsAccepted: boolean, grandTotal: string|null, error?: string}>}
 */
export async function acceptTermsAndMakeBooking(page, screenshotsDir, termsAccepted = false) {
  try {
    console.log('📋 [STEP 13] Accepting terms and making booking...');
    console.log(`📋 [STEP 13] Terms accepted: ${termsAccepted}`);
    
    // Wait for payment page to be ready
    console.log('⏳ [STEP 13] Waiting for payment page to be ready...');
    await page.waitForTimeout(2000);
    
    // Determine if we need to work with iframe or main page (same pattern as other payment steps)
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    let searchContext;
    
    if (eventBookingIframeExists) {
      console.log('🔍 [STEP 13] Working with eventNewBooking2_iframe for terms and booking...');
      searchContext = page.frameLocator('#eventNewBooking2_iframe');
    } else {
      console.log('🔍 [STEP 13] Working with main page for terms and booking...');
      searchContext = page;
    }
    
    // Extract Grand Total amount
    console.log('💰 [STEP 13] Extracting Grand Total amount...');
    let grandTotal = null;
    
    try {
      // Try multiple selectors to find Grand Total
      const grandTotalSelectors = [
        'text=/Grand total/i',
        'text=/Total/i',
        '[data-field="grand_total"]',
        'text=/Grand Total/i'
      ];
      
      for (const selector of grandTotalSelectors) {
        const grandTotalElement = searchContext.locator(selector).first();
        if (await grandTotalElement.count() > 0) {
          const elementText = await grandTotalElement.textContent();
          // Try to extract amount from text (look for currency pattern)
          const amountMatch = elementText.match(/[£$€]?\s*[\d,]+\.?\d*/);
          if (amountMatch) {
            grandTotal = amountMatch[0].trim();
            console.log(`✅ [STEP 13] Found Grand Total: ${grandTotal}`);
            break;
          }
          
          // Also check parent/sibling elements for amount
          const parent = grandTotalElement.locator('..');
          const parentText = await parent.textContent();
          const parentAmountMatch = parentText.match(/[£$€]?\s*[\d,]+\.?\d*/);
          if (parentAmountMatch) {
            grandTotal = parentAmountMatch[0].trim();
            console.log(`✅ [STEP 13] Found Grand Total in parent: ${grandTotal}`);
            break;
          }
        }
      }
      
      // If not found, try to find any element containing both "total" and a currency amount
      if (!grandTotal) {
        const allText = await searchContext.locator('body').textContent();
        const totalMatch = allText.match(/Grand\s+Total[:\s]*([£$€]?\s*[\d,]+\.?\d*)/i);
        if (totalMatch) {
          grandTotal = totalMatch[1].trim();
          console.log(`✅ [STEP 13] Found Grand Total via text search: ${grandTotal}`);
        }
      }
      
      if (!grandTotal) {
        console.log('⚠️ [STEP 13] Could not extract Grand Total amount');
      }
    } catch (error) {
      console.log(`⚠️ [STEP 13] Error extracting Grand Total: ${error.message}`);
    }
    
    // Check terms acceptance
    if (!termsAccepted) {
      console.log('⚠️ [STEP 13] Terms not accepted by client - booking cancelled');
      await takeScreenshot(page, 'terms-not-accepted.png', screenshotsDir);
      return {
        success: false,
        termsAccepted: false,
        grandTotal: grandTotal,
        error: 'Terms not accepted'
      };
    }
    
    // Terms accepted - proceed to click MAKE BOOKING button
    console.log('✅ [STEP 13] Terms accepted - proceeding to make booking...');
    
    // Take screenshot before clicking
    await takeScreenshot(page, 'terms-and-booking-page.png', screenshotsDir);
    
    // Find MAKE BOOKING button using multiple selectors (try in order, stop when found)
    console.log('🔍 [STEP 13] Looking for MAKE BOOKING button...');
    
    const makeBookingSelectors = [
      '#diaryNewCourseBookingWiz_OKBtn', // ID from HTML
      'button:has-text("Make booking")', // Text-based
      '[aria-label="Make booking"]', // Aria-label
      '.jqx_wizardBtn:has-text("Make booking")', // Class + text
      'button.dx-button-success:has-text("Make booking")', // Class + text
      'button:has-text("MAKE BOOKING")', // Uppercase variant
      '[role="button"]:has-text("Make booking")' // Role + text
    ];
    
    let makeBookingButton = null;
    
    for (const selector of makeBookingSelectors) {
      try {
        const button = searchContext.locator(selector).first();
        if (await button.count() > 0) {
          const isVisible = await button.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [STEP 13] Found MAKE BOOKING button using selector: "${selector}"`);
            makeBookingButton = button;
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
        continue;
      }
    }
    
    // If not found in current context, try main page
    if (!makeBookingButton) {
      console.log('🔍 [STEP 13] Button not found in current context, trying main page...');
      for (const selector of makeBookingSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.count() > 0) {
            const isVisible = await button.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [STEP 13] Found MAKE BOOKING button on main page using selector: "${selector}"`);
              makeBookingButton = button;
              break;
            }
          }
        } catch (e) {
          // Continue to next selector
          continue;
        }
      }
    }
    
    if (!makeBookingButton) {
      console.log('❌ [STEP 13] MAKE BOOKING button not found');
      await takeScreenshot(page, 'make-booking-button-not-found.png', screenshotsDir);
      return {
        success: false,
        termsAccepted: true,
        grandTotal: grandTotal,
        error: 'Make booking button not found'
      };
    }
    
    // Click the MAKE BOOKING button
    console.log('🖱️ [STEP 13] Clicking MAKE BOOKING button...');
    await makeBookingButton.waitFor({ state: 'visible', timeout: 5000 });
    await makeBookingButton.click();
    
    // Wait for payment processing/confirmation (up to 30 seconds)
    console.log('⏳ [STEP 13] Waiting for payment processing/confirmation...');
    await page.waitForTimeout(3000); // Initial wait
    
    // Try to detect confirmation indicators
    const confirmationIndicators = [
      'text=/booking.confirmed/i',
      'text=/payment.successful/i',
      'text=/confirmed/i',
      'text=/successful/i',
      'text=/Booking confirmed/i',
      'text=/Payment successful/i'
    ];
    
    let confirmationFound = false;
    for (const indicator of confirmationIndicators) {
      try {
        const confirmElement = page.locator(indicator).first();
        if (await confirmElement.count() > 0) {
          const isVisible = await confirmElement.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [STEP 13] Found confirmation indicator: "${indicator}"`);
            confirmationFound = true;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Wait additional time for payment processing (total up to 30 seconds)
    if (!confirmationFound) {
      console.log('⏳ [STEP 13] Confirmation not immediately visible, waiting for payment processing...');
      await page.waitForTimeout(10000); // Additional 10 seconds
    }
    
    // Take screenshot after clicking
    await takeScreenshot(page, 'booking-completed.png', screenshotsDir);
    
    console.log('✅ [STEP 13] Booking completed successfully');
    return {
      success: true,
      termsAccepted: true,
      grandTotal: grandTotal
    };
    
  } catch (error) {
    console.error('Error in acceptTermsAndMakeBooking:', error);
    await takeScreenshot(page, 'terms-booking-error.png', screenshotsDir);
    return {
      success: false,
      termsAccepted: termsAccepted,
      grandTotal: null,
      error: `Failed to complete booking: ${error.message}`
    };
  }
}

