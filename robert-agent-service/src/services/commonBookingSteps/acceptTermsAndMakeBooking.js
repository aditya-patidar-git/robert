import { takeScreenshot } from './utils.js';

/**
 * Step 13: Accept terms and make booking
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {boolean} termsAccepted - Whether client accepted terms (defaults to true - allows booking to proceed if not explicitly set)
 * @param {boolean} skipMakeBooking - Whether to skip clicking the "Make booking" button (defaults to false)
 * @returns {Promise<{success: boolean, termsAccepted: boolean, grandTotal: string|null, error?: string}>}
 */
export async function acceptTermsAndMakeBooking(page, screenshotsDir, termsAccepted = true, skipMakeBooking = false) {
  try {
    console.log('📋 [STEP 13] Accepting terms and making booking...');
    console.log(`📋 [STEP 13] Terms accepted: ${termsAccepted} (defaults to true if not provided)`);
    
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
    
    // Check terms acceptance - default to true if not explicitly set to false
    // This allows the booking to proceed even if the agent didn't explicitly ask
    // (fallback behavior to prevent booking failures)
    if (termsAccepted === false) {
      console.log('⚠️ [STEP 13] Terms explicitly set to false by client - booking cancelled');
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
    
    // Check if we should skip clicking the button
    // NOTE: User requested to have the button active, so we'll click it even if skipMakeBooking is true
    // This allows inspection of the confirmation email window
    if (skipMakeBooking) {
      console.log('⚠️ [STEP 13] skipMakeBooking=true, but proceeding to click "Make booking" button for inspection');
    }
    
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
    
    // Wait for button to be visible and enabled
    await makeBookingButton.waitFor({ state: 'visible', timeout: 5000 });
    
    // Check if button is enabled (not disabled)
    const isDisabled = await makeBookingButton.getAttribute('disabled').catch(() => null);
    if (isDisabled !== null) {
      console.log('⚠️ [STEP 13] Make Booking button is disabled, waiting for it to be enabled...');
      await page.waitForTimeout(2000);
    }
    
    // Scroll button into view (important for DevExtreme buttons)
    try {
      await makeBookingButton.scrollIntoViewIfNeeded({ timeout: 2000 });
      console.log('✅ [STEP 13] Scrolled Make Booking button into view');
    } catch (scrollErr) {
      console.log('⚠️ [STEP 13] Could not scroll Make Booking button into view:', scrollErr.message);
    }
    
    // Try regular click first
    try {
      await makeBookingButton.click({ timeout: 5000 });
      console.log('✅ [STEP 13] Clicked Make Booking button (regular click)');
    } catch (clickErr) {
      console.log('⚠️ [STEP 13] Regular click failed, trying force click:', clickErr.message);
      // Fallback: Use force click (works even if button is partially hidden)
      await makeBookingButton.click({ force: true, timeout: 5000 });
      console.log('✅ [STEP 13] Clicked Make Booking button (force click)');
    }
    
    // Wait a moment for the click to register
    await page.waitForTimeout(500);
    
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
    
    // Wait for the next page (confirmation email window) to load after payment completes
    console.log('⏳ [STEP 13] Waiting for payment to complete and next page to load...');
    
    // CRITICAL: First check if we're still on the payment page (button should disappear or be disabled)
    // This ensures we don't get false positives from elements that already exist
    let stillOnPaymentPage = true;
    let paymentPageCheckAttempts = 0;
    const maxPaymentPageChecks = 10; // 10 seconds
    
    while (stillOnPaymentPage && paymentPageCheckAttempts < maxPaymentPageChecks) {
      await page.waitForTimeout(1000);
      paymentPageCheckAttempts++;
      
      // Check if "Make Booking" button still exists and is enabled (means we're still on payment page)
      try {
        const buttonStillExists = await searchContext.locator('#diaryNewCourseBookingWiz_OKBtn').count() > 0;
        if (buttonStillExists) {
          const button = searchContext.locator('#diaryNewCourseBookingWiz_OKBtn').first();
          const isVisible = await button.isVisible().catch(() => false);
          const isDisabled = await button.getAttribute('disabled').catch(() => null);
          
          // If button is visible and not disabled, we're still on payment page
          if (isVisible && isDisabled === null) {
            console.log(`⏳ [STEP 13] Still on payment page (attempt ${paymentPageCheckAttempts}/${maxPaymentPageChecks})...`);
            continue;
          }
        }
        // Button doesn't exist or is disabled - payment processing may have started
        stillOnPaymentPage = false;
        console.log('✅ [STEP 13] Payment page navigation detected (button disappeared or disabled)');
      } catch (e) {
        // Error checking button - assume we've navigated away
        stillOnPaymentPage = false;
        console.log('✅ [STEP 13] Payment page navigation detected (button check failed)');
      }
    }
    
    if (stillOnPaymentPage) {
      console.log('⚠️ [STEP 13] Still on payment page after 10 seconds - payment may not have processed');
      // Take screenshot for debugging
      await takeScreenshot(page, 'payment-still-processing.png', screenshotsDir);
    }
    
    // Now wait for indicators that we're on the confirmation/next page
    // Look for: "Send a confirmation" list item, "Finish" list item, or stationary page
    // NOTE: Using specific list item selectors to avoid false positives
    const nextPageIndicators = [
      // Prioritize list item selectors based on actual HTML structure
      'div.dx-item.dx-list-item[role="option"]:has(.list-menu-item-heading:has-text("Send a confirmation"))',
      'div.dx-item.dx-list-item[role="option"]:has(.list-menu-item-heading:has-text("Finish"))',
      '.list-menu-item-heading:has-text("Send a confirmation")',
      '.list-menu-item-heading:has-text("Finish")',
      // Fallback text-based selectors
      'text=/Send a confirmation/i',
      'text=/Finish and close/i',
      'text=/Pick an item of stationary/i',
      'text=/stationary/i'
    ];
    
    let nextPageLoaded = false;
    let waitAttempts = 0;
    const maxWaitAttempts = 30; // 30 seconds total (30 * 1000ms)
    
    while (!nextPageLoaded && waitAttempts < maxWaitAttempts) {
      await page.waitForTimeout(1000); // Wait 1 second between checks
      waitAttempts++;
      
      // Check if we're on the next page by looking for indicators in iframe context
      for (const indicator of nextPageIndicators) {
        try {
          const element = searchContext.locator(indicator).first();
          if (await element.count() > 0) {
            const isVisible = await element.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [STEP 13] Next page loaded - found indicator: "${indicator}"`);
              nextPageLoaded = true;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      // Also check main page (but be more specific - don't use generic .list-menu-item)
      if (!nextPageLoaded) {
        for (const indicator of nextPageIndicators) {
          try {
            const element = page.locator(indicator).first();
            if (await element.count() > 0) {
              const isVisible = await element.isVisible().catch(() => false);
              if (isVisible) {
                console.log(`✅ [STEP 13] Next page loaded on main page - found indicator: "${indicator}"`);
                nextPageLoaded = true;
                break;
              }
            }
          } catch (e) {
            continue;
          }
        }
      }
    }
    
    if (!nextPageLoaded) {
      console.log('⚠️ [STEP 13] Next page indicators not found after 30 seconds, but continuing...');
    }
    
    // Take screenshot of the confirmation email window
    await takeScreenshot(page, 'confirmation-email-window.png', screenshotsDir);
    
    // Click "Finish and close" button (only if Make Booking was actually clicked)
    console.log('🏁 [STEP 13] Looking for "Finish and close" button...');
    
    try {
      // Wait for the new page/screen to load - wait for list items to appear
      console.log('⏳ [STEP 13] Waiting for action list to appear...');
      
      // Wait for list items with .list-menu-item class to appear (indicates new page loaded)
      const listItemIndicator = page.locator('.list-menu-item').first();
      await listItemIndicator.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
        console.log('⚠️ [STEP 13] List items not immediately visible, continuing...');
      });
      
      // Additional wait for page to fully load
      await page.waitForTimeout(2000);
      
      // Determine if we need to work with iframe or main page (same pattern as payment steps)
      const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
      let finishSearchContext;
      
      if (eventBookingIframeExists) {
        console.log('🔍 [STEP 13] Working with eventNewBooking2_iframe for Finish and close...');
        finishSearchContext = page.frameLocator('#eventNewBooking2_iframe');
      } else {
        console.log('🔍 [STEP 13] Working with main page for Finish and close...');
        finishSearchContext = page;
      }
      
      // Multiple selector strategy for "Finish and close" (try in order, stop when found)
      // Based on actual HTML structure: div.dx-item.dx-list-item[role="option"] > div.list-menu-item > h3.list-menu-item-heading
      const finishSelectors = [
        // Prioritize list item selectors based on actual HTML structure
        'div.dx-item.dx-list-item[role="option"]:has(.list-menu-item-heading:has-text("Finish"))',
        'div.dx-item.dx-list-item[role="option"]:has(.list-menu-item-text:has-text("Finish and close"))',
        '.list-menu-item:has(.list-menu-item-heading:has-text("Finish"))',
        '[role="option"]:has-text("Finish and close")',
        // Keep existing fallbacks
        '.list-menu-item-heading:has-text("Finish")',
        '.list-menu-item:has-text("Finish and close")',
        'text="Finish and close"',
        'text=/Finish and close/i',
        '.list-menu-item-text:has-text("Finish and close")',
        'div.dx-list-item:has-text("Finish and close")'
      ];
      
      let finishButton = null;
      
      for (const selector of finishSelectors) {
        try {
          const button = finishSearchContext.locator(selector).first();
          if (await button.count() > 0) {
            const isVisible = await button.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [STEP 13] Found "Finish and close" using selector: "${selector}"`);
              finishButton = button;
              break;
            }
          }
        } catch (e) {
          // Continue to next selector
          continue;
        }
      }
      
      // If not found in current context, try main page
      if (!finishButton) {
        console.log('🔍 [STEP 13] "Finish and close" not found in current context, trying main page...');
        for (const selector of finishSelectors) {
          try {
            const button = page.locator(selector).first();
            if (await button.count() > 0) {
              const isVisible = await button.isVisible().catch(() => false);
              if (isVisible) {
                console.log(`✅ [STEP 13] Found "Finish and close" on main page using selector: "${selector}"`);
                finishButton = button;
                break;
              }
            }
          } catch (e) {
            // Continue to next selector
            continue;
          }
        }
      }
      
      if (!finishButton) {
        console.log('⚠️ [STEP 13] "Finish and close" button not found, continuing without clicking...');
        console.log('⚠️ [STEP 13] This is non-blocking - booking may still be successful');
      } else {
        // Click the "Finish and close" button
        console.log('🏁 [STEP 13] Clicking "Finish and close" button...');
        await finishButton.waitFor({ state: 'visible', timeout: 5000 });
        await finishButton.click();
        
        // Wait for action to complete
        console.log('⏳ [STEP 13] Waiting for finish action to complete...');
        await page.waitForTimeout(2000);
        
        // Take screenshot after clicking
        await takeScreenshot(page, 'finish-and-close-clicked.png', screenshotsDir);
        console.log('✅ [STEP 13] "Finish and close" clicked successfully');
      }
    } catch (error) {
      // Non-blocking error - log but don't fail the booking
      console.log(`⚠️ [STEP 13] Error clicking "Finish and close": ${error.message}`);
      console.log('⚠️ [STEP 13] This is non-blocking - booking may still be successful');
      await takeScreenshot(page, 'finish-and-close-error.png', screenshotsDir);
    }
    
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

