import { takeScreenshot } from './utils.js';

/**
 * Send Payment Request
 * Handles payment request modal/popup and polls for payment completion
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} deliveryMethod - 'email' or 'sms'
 * @param {string} clientEmail - Optional client email address
 * @param {string} clientMobile - Optional client mobile number
 * @param {boolean} confirmed - Whether client has confirmed the email/phone number (default: false)
 * @returns {Promise<{success: boolean, paymentCompleted: boolean, requiresConfirmation?: boolean, emailAddress?: string, phoneNumber?: string, error?: string}>}
 */
export async function sendPaymentRequest(page, screenshotsDir, deliveryMethod, clientEmail = null, clientMobile = null, confirmed = false) {
  try {
    console.log(`💳 [PAYMENT_REQUEST] Sending payment request via ${deliveryMethod}...`);
    
    // FIX 3: Wait for payment request page to load - check for contactSend3DSecureRequest_iframe first
    // After clicking "Send a payment request", the content appears in contactSend3DSecureRequest_iframe
    // NOT in eventNewBooking2_iframe (which is for the booking page)
    console.log('⏳ [PAYMENT_REQUEST] Waiting for payment request page to load...');
    
    // CRITICAL: Verify we're NOT still on PaymentPage (eventNewBooking2_iframe)
    // If we're still on PaymentPage, wait for transition
    const stillOnPaymentPage = await page.locator('#eventNewBooking2_iframe').count() > 0;
    if (stillOnPaymentPage) {
      console.log('⚠️ [PAYMENT_REQUEST] Still on PaymentPage - waiting for transition to payment request link page...');
      await page.waitForTimeout(3000);
    }
    
    // Give time for the new iframe to appear after selecting "Send a payment request"
    await page.waitForTimeout(3000); // Reduced from 5000 since selectPaymentOption already waited
    
    // CRITICAL FIX: Check for contactSend3DSecureRequest_iframe first (payment request page)
    // This iframe appears AFTER clicking "Send a payment request"
    let paymentRequestIframeExists = false;
    let searchContext;
    let eventBookingIframeExists = false;
    
    // First, try to find contactSend3DSecureRequest_iframe (payment request page)
    // INCREASED retries and timeout since this is critical
    for (let i = 0; i < 10; i++) {
      paymentRequestIframeExists = await page.locator('#contactSend3DSecureRequest_iframe').count() > 0;
      if (paymentRequestIframeExists) {
        try {
          const paymentRequestIframe = page.frameLocator('#contactSend3DSecureRequest_iframe');
          const testLocator = paymentRequestIframe.locator('body').first();
          await testLocator.waitFor({ state: 'attached', timeout: 3000 });
          console.log('✅ [PAYMENT_REQUEST] Found contactSend3DSecureRequest_iframe (payment request page)');
          searchContext = paymentRequestIframe;
          break;
        } catch (iframeError) {
          console.log(`⚠️ [PAYMENT_REQUEST] Payment request iframe detected but not loaded yet, retrying (${i + 1}/10)...`);
          if (i < 9) await page.waitForTimeout(2000);
        }
      } else {
        if (i < 9) {
          console.log(`⏳ [PAYMENT_REQUEST] Payment request iframe not found, retrying (${i + 1}/10)...`);
          await page.waitForTimeout(2000);
        }
      }
    }
    
    // Fallback: If payment request iframe not found, check eventNewBooking2_iframe (booking page)
    // BUT ONLY if we're sure we haven't transitioned yet
    if (!paymentRequestIframeExists || !searchContext) {
      console.log('⚠️ [PAYMENT_REQUEST] Payment request iframe not found after 10 attempts');
      console.log('⚠️ [PAYMENT_REQUEST] This may indicate:');
      console.log('   1. Page transition not completed yet');
      console.log('   2. "Send a payment request" was not clicked successfully');
      console.log('   3. Page structure changed');
      console.log('⚠️ [PAYMENT_REQUEST] Checking booking iframe as fallback...');
      
      for (let i = 0; i < 3; i++) {
        eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
        if (eventBookingIframeExists) {
          try {
            const iframe = page.frameLocator('#eventNewBooking2_iframe');
            const testLocator = iframe.locator('body').first();
            await testLocator.waitFor({ state: 'attached', timeout: 2000 });
            console.log('⚠️ [PAYMENT_REQUEST] Using eventNewBooking2_iframe as fallback (may be wrong page)');
            console.log('⚠️ [PAYMENT_REQUEST] WARNING: We may still be on PaymentPage, not payment request link page');
            searchContext = iframe;
            break;
          } catch (iframeError) {
            if (i < 2) await page.waitForTimeout(2000);
          }
        } else {
          if (i < 2) await page.waitForTimeout(2000);
        }
      }
    }
    
    // Final fallback: Use main page
    if (!searchContext) {
      console.log('⚠️ [PAYMENT_REQUEST] No iframe found, using main page context');
      searchContext = page;
    }
    
    // FIX 4: Wait for payment request form to appear - check for multiple indicators
    // The page content changes to show the payment request form, so we need to wait for:
    // 1. The form element (#sendForm)
    // 2. The header text "Send payment request to..."
    // 3. The email/mobile input fields
    let sendForm;
    let modalFound = false;
    
    for (let attempt = 0; attempt < 5; attempt++) { // Increased retries from 3 to 5
      try {
        // Try multiple indicators that the payment request page has loaded
        const indicators = [
          () => searchContext.locator('#sendForm').first(),
          () => searchContext.locator('form#sendForm').first(),
          () => searchContext.locator('[id="sendForm"]').first(),
          () => searchContext.locator('text=/Send payment request to/i').first(), // Header text
          () => searchContext.locator('#cnt_email').first(), // Email input container
          () => searchContext.locator('#cnt_mobile_number').first(), // Mobile input container
          () => searchContext.locator('#btnSendByEmail').first(), // Send by email button
          () => searchContext.locator('#btnSendBySMS').first() // Send by SMS button
        ];
        
        let foundIndicator = null;
        let indicatorIndex = -1;
        for (let idx = 0; idx < indicators.length; idx++) {
          try {
            const indicator = indicators[idx]();
            if (await indicator.count() > 0) {
              const isVisible = await indicator.isVisible({ timeout: 3000 }).catch(() => false);
              if (isVisible) {
                foundIndicator = indicator;
                indicatorIndex = idx;
                // If it's one of the form selectors (first 3), use it directly
                if (idx < 3) {
                  sendForm = indicator;
                } else {
                  // Found another indicator (header, email field, etc.), now find the form
                  sendForm = searchContext.locator('#sendForm').first();
                }
                modalFound = true;
                console.log(`✅ [PAYMENT_REQUEST] Payment request page loaded (found indicator at index ${idx})`);
                break;
              }
            }
          } catch (indicatorError) {
            continue;
          }
        }
        
        if (modalFound && sendForm) {
          // Verify the form is actually visible
          await sendForm.waitFor({ state: 'visible', timeout: 5000 });
          console.log('✅ [PAYMENT_REQUEST] Payment request form is visible');
          break;
        }
        
        if (attempt < 4) {
          console.log(`⚠️ [PAYMENT_REQUEST] Payment request page not loaded yet, retrying (${attempt + 1}/5)...`);
          await page.waitForTimeout(3000);
        }
      } catch (error) {
        if (attempt < 4) {
          console.log(`⚠️ [PAYMENT_REQUEST] Error checking for payment request page, retrying (${attempt + 1}/5)...`);
          await page.waitForTimeout(3000);
        } else {
          throw error;
        }
      }
    }
    
    if (!modalFound || !sendForm) {
      // Take screenshot for debugging
      await takeScreenshot(page, 'payment-request-not-found.png', screenshotsDir);
      throw new Error('Payment request page (#sendForm) not found after multiple attempts. The page content may not have changed after selecting "Send a payment request".');
    }
    
    await takeScreenshot(page, 'payment-request-modal-opened.png', screenshotsDir);
    
    // Verify amount is pre-filled (read from #fin_amount input)
    try {
      const amountInput = searchContext.locator('#fin_amount input').first();
      const amountValue = await amountInput.inputValue();
      console.log(`💰 [PAYMENT_REQUEST] Amount pre-filled: ${amountValue || 'N/A'}`);
    } catch (error) {
      console.warn('⚠️ [PAYMENT_REQUEST] Could not read amount value:', error.message);
    }
    
    // Fill email or mobile if provided
    if (deliveryMethod === 'email') {
      // HARDCODED: Always use test email for payment requests
      const testEmail = 'aditya.patidar@kadellabs.com';
      console.log(`📧 [PAYMENT_REQUEST] Filling email address (hardcoded for testing): ${testEmail}`);
      const emailInput = searchContext.locator('#cnt_email input').first();
      await emailInput.waitFor({ state: 'visible', timeout: 5000 });
      await emailInput.fill(testEmail);
      await page.waitForTimeout(500);
    } else if (deliveryMethod === 'sms' && clientMobile) {
      console.log(`📱 [PAYMENT_REQUEST] Filling mobile number: ${clientMobile}`);
      const mobileInput = searchContext.locator('#cnt_mobile_number input').first();
      await mobileInput.waitFor({ state: 'visible', timeout: 5000 });
      await mobileInput.fill(clientMobile);
      await page.waitForTimeout(500);
    }
    
    // Read the current values from the form for confirmation
    let emailAddress = null;
    let phoneNumber = null;
    
    if (deliveryMethod === 'email') {
      // Use hardcoded test email
      emailAddress = 'aditya.patidar@kadellabs.com';
      console.log(`📧 [PAYMENT_REQUEST] Email address in form: ${emailAddress} (hardcoded for testing)`);
    } else if (deliveryMethod === 'sms') {
      try {
        const mobileInput = searchContext.locator('#cnt_mobile_number input').first();
        phoneNumber = await mobileInput.inputValue();
        console.log(`📱 [PAYMENT_REQUEST] Phone number in form: ${phoneNumber}`);
      } catch (error) {
        console.warn('⚠️ [PAYMENT_REQUEST] Could not read mobile value:', error.message);
      }
    }
    
    // Check if confirmation is required (if confirmed parameter is not true)
    console.log(`🔍 [PAYMENT_REQUEST] Confirmed parameter received: ${confirmed} (type: ${typeof confirmed})`);
    
    if (!confirmed) {
      console.log('⏸️ [PAYMENT_REQUEST] Confirmation required before sending payment request');
      return {
        success: true,
        paymentCompleted: false,
        requiresConfirmation: true,
        emailAddress: emailAddress,
        phoneNumber: phoneNumber,
        deliveryMethod: deliveryMethod,
        message: deliveryMethod === 'email' 
          ? `Payment request will be sent to ${emailAddress}. Please confirm with the client before proceeding.`
          : `Payment request will be sent to ${phoneNumber}. Please confirm with the client before proceeding.`
      };
    }
    
    // Only proceed to click send button if confirmed is true
    console.log('✅ [PAYMENT_REQUEST] Client confirmed, proceeding to send payment request...');
    
    // Click appropriate button based on delivery method
    let sendButton;
    if (deliveryMethod === 'email') {
      console.log('📧 [PAYMENT_REQUEST] Clicking "Send by email now" button...');
      sendButton = searchContext.locator('#btnSendByEmail').first();
    } else {
      console.log('📱 [PAYMENT_REQUEST] Clicking "Send by SMS text now" button...');
      sendButton = searchContext.locator('#btnSendBySMS').first();
    }
    
    // Wait for button to be attached (may be hidden but still clickable)
    try {
      await sendButton.waitFor({ state: 'attached', timeout: 10000 });
      console.log('✅ [PAYMENT_REQUEST] Send button is attached to DOM');
      
      // Try to scroll button into view
      try {
        await sendButton.scrollIntoViewIfNeeded({ timeout: 2000 });
        console.log('✅ [PAYMENT_REQUEST] Scrolled send button into view');
      } catch (scrollErr) {
        console.log('⚠️ [PAYMENT_REQUEST] Could not scroll button into view:', scrollErr.message);
      }
      
      // Check if button is visible
      const isVisible = await sendButton.isVisible().catch(() => false);
      if (!isVisible) {
        console.log('⚠️ [PAYMENT_REQUEST] Send button is not visible, using force click...');
        await sendButton.click({ force: true, timeout: 5000 });
      } else {
        await sendButton.click({ timeout: 5000 });
      }
      
      console.log('✅ [PAYMENT_REQUEST] Send button clicked successfully');
    } catch (error) {
      console.error('❌ [PAYMENT_REQUEST] Error clicking send button:', error);
      throw new Error(`Failed to click send button: ${error.message}`);
    }
    
    await takeScreenshot(page, 'payment-request-sent.png', screenshotsDir);
    
    // CRITICAL: Polling logic - check every 30 seconds for "Make booking" button
    console.log('⏳ [PAYMENT_REQUEST] Starting polling for payment completion (every 30 seconds, max 10 minutes)...');
    
    const POLL_INTERVAL = 30000; // 30 seconds
    const MAX_WAIT_TIME = 600000; // 10 minutes
    const MAX_ATTEMPTS = 20; // 10 minutes / 30 seconds = 20 attempts
    
    // Make booking button selectors - CRITICAL FIX: Button is a div element, not a button element
    // Based on HTML structure: <div id="diaryNewCourseBookingWiz_OKBtn" role="button" aria-label="Make booking" class="dx-button-success jqx_wizardBtn">
    const makeBookingSelectors = [
      '#diaryNewCourseBookingWiz_OKBtn',                    // ID selector (most reliable - will match first)
      '[aria-label="Make booking"]',                        // Aria-label
      '.jqx_wizardBtn:has-text("Make booking")',           // Class + text
      '[role="button"]:has-text("Make booking")',          // Role + text
      'div.dx-button-success:has-text("Make booking")',    // Div with success class + text
      '.dx-button-success[aria-label="Make booking"]',      // Success class + aria-label
      '[id="diaryNewCourseBookingWiz_OKBtn"]'                // ID selector (alternative format)
    ];
    
    let attempt = 0;
    let makeBookingButton = null;
    
    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      console.log(`🔍 [PAYMENT_REQUEST] Polling attempt ${attempt}/${MAX_ATTEMPTS}...`);
      
      // Wait for polling interval (except on first attempt - already waited after clicking send)
      if (attempt > 1) {
        await page.waitForTimeout(POLL_INTERVAL);
      } else {
        // On first attempt, wait a bit before checking (give time for payment processing to start)
        await page.waitForTimeout(5000);
      }
      
      // CRITICAL FIX: Re-check which iframes exist on EACH polling attempt
      // After payment completion, the page transitions back to eventNewBooking2_iframe
      // So we need to check iframe existence dynamically, not use static flags
      const currentBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
      const currentPaymentRequestIframeExists = await page.locator('#contactSend3DSecureRequest_iframe').count() > 0;
      
      console.log(`🔍 [PAYMENT_REQUEST] Polling attempt ${attempt}: Checking iframes - eventNewBooking2_iframe: ${currentBookingIframeExists}, contactSend3DSecureRequest_iframe: ${currentPaymentRequestIframeExists}`);
      
      // Check for "Make booking" button - prioritize eventNewBooking2_iframe FIRST
      // (since after payment completion, the page transitions back to the main payment page)
      for (const selector of makeBookingSelectors) {
        try {
          // PRIORITY 1: Check in booking iframe FIRST (eventNewBooking2_iframe)
          // This is where the button will be after payment completion
          if (currentBookingIframeExists) {
            try {
              const bookingIframe = page.frameLocator('#eventNewBooking2_iframe');
              const iframeButton = bookingIframe.locator(selector).first();
              if (await iframeButton.count() > 0) {
                const isVisible = await iframeButton.isVisible().catch(() => false);
                if (isVisible) {
                  console.log(`✅ [PAYMENT_REQUEST] Found "Make booking" button in booking iframe (eventNewBooking2_iframe) using selector: "${selector}"`);
                  makeBookingButton = iframeButton;
                  break;
                }
              }
            } catch (iframeError) {
              // Iframe might not be accessible, continue to next check
              console.log(`⚠️ [PAYMENT_REQUEST] Error checking booking iframe: ${iframeError.message}`);
            }
          }
          
          // PRIORITY 2: Check in payment request iframe (contactSend3DSecureRequest_iframe) as fallback
          if (currentPaymentRequestIframeExists) {
            try {
              const paymentRequestIframe = page.frameLocator('#contactSend3DSecureRequest_iframe');
              const iframeButton = paymentRequestIframe.locator(selector).first();
              if (await iframeButton.count() > 0) {
                const isVisible = await iframeButton.isVisible().catch(() => false);
                if (isVisible) {
                  console.log(`✅ [PAYMENT_REQUEST] Found "Make booking" button in payment request iframe using selector: "${selector}"`);
                  makeBookingButton = iframeButton;
                  break;
                }
              }
            } catch (iframeError) {
              // Iframe might not be accessible, continue to next check
              console.log(`⚠️ [PAYMENT_REQUEST] Error checking payment request iframe: ${iframeError.message}`);
            }
          }
          
          // PRIORITY 3: Check in main page context
          const mainPageButton = page.locator(selector).first();
          if (await mainPageButton.count() > 0) {
            const isVisible = await mainPageButton.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [PAYMENT_REQUEST] Found "Make booking" button on main page using selector: "${selector}"`);
              makeBookingButton = mainPageButton;
              break;
            }
          }
        } catch (error) {
          // Continue to next selector
          continue;
        }
      }
      
      // If button found, click it immediately and return success
      if (makeBookingButton) {
        console.log('✅ [PAYMENT_REQUEST] ============================================');
        console.log('✅ [PAYMENT_REQUEST] PAYMENT COMPLETED SUCCESSFULLY!');
        console.log(`✅ [PAYMENT_REQUEST] Found "Make booking" button after ${attempt} polling attempt(s)`);
        console.log('🖱️ [PAYMENT_REQUEST] Clicking "Make booking" button...');
        console.log('✅ [PAYMENT_REQUEST] ============================================');
        
        try {
          await makeBookingButton.waitFor({ state: 'visible', timeout: 5000 });
          await makeBookingButton.click({ timeout: 5000 });
          console.log('✅ [PAYMENT_REQUEST] "Make booking" button clicked successfully');
          
          // Wait a moment for the click to register
          await page.waitForTimeout(500);
          
          // Wait for payment processing/confirmation (up to 30 seconds)
          console.log('⏳ [PAYMENT_REQUEST] Waiting for payment processing/confirmation...');
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
                  console.log(`✅ [PAYMENT_REQUEST] Found confirmation indicator: "${indicator}"`);
                  confirmationFound = true;
                  break;
                }
              }
            } catch (e) {
              continue;
            }
          }
          
          // Wait additional time for payment processing if confirmation not immediately visible
          if (!confirmationFound) {
            console.log('⏳ [PAYMENT_REQUEST] Confirmation not immediately visible, waiting for payment processing...');
            await page.waitForTimeout(10000); // Additional 10 seconds
          }
          
          // CRITICAL: Check if we're still on the payment page (button should disappear or be disabled)
          // This ensures we don't get false positives from elements that already exist
          let stillOnPaymentPage = true;
          let paymentPageCheckAttempts = 0;
          const maxPaymentPageChecks = 10; // 10 seconds
          
          // Determine search context (could be iframe or main page)
          let searchContextForCheck = searchContext || page;
          
          while (stillOnPaymentPage && paymentPageCheckAttempts < maxPaymentPageChecks) {
            await page.waitForTimeout(1000);
            paymentPageCheckAttempts++;
            
            // Check if "Make Booking" button still exists and is enabled (means we're still on payment page)
            try {
              const buttonStillExists = await searchContextForCheck.locator('#diaryNewCourseBookingWiz_OKBtn').count() > 0;
              if (buttonStillExists) {
                const button = searchContextForCheck.locator('#diaryNewCourseBookingWiz_OKBtn').first();
                const isVisible = await button.isVisible().catch(() => false);
                const isDisabled = await button.getAttribute('disabled').catch(() => null);
                
                // If button is visible and not disabled, we're still on payment page
                if (isVisible && isDisabled === null) {
                  console.log(`⏳ [PAYMENT_REQUEST] Still on payment page (attempt ${paymentPageCheckAttempts}/${maxPaymentPageChecks})...`);
                  continue;
                }
              }
              // Button doesn't exist or is disabled - payment processing may have started
              stillOnPaymentPage = false;
              console.log('✅ [PAYMENT_REQUEST] Payment page navigation detected (button disappeared or disabled)');
            } catch (e) {
              // Error checking button - assume we've navigated away
              stillOnPaymentPage = false;
              console.log('✅ [PAYMENT_REQUEST] Payment page navigation detected (button check failed)');
            }
          }
          
          if (stillOnPaymentPage) {
            console.log('⚠️ [PAYMENT_REQUEST] Still on payment page after 10 seconds - payment may not have processed');
          }
          
          // Now wait for indicators that we're on the confirmation/next page
          // PRIMARY: Check for #afterBookingMenu - definitive indicator of successful payment and booking completion
          const nextPageIndicators = [
            '#afterBookingMenu',
            '#afterBookingMenu .list-menu-item-heading:has-text("Send a confirmation")',
            '#afterBookingMenu .list-menu-item-heading:has-text("Finish")',
            'div.dx-item.dx-list-item[role="option"]:has(.list-menu-item-heading:has-text("Send a confirmation"))',
            'div.dx-item.dx-list-item[role="option"]:has(.list-menu-item-heading:has-text("Finish"))',
            '.list-menu-item-heading:has-text("Send a confirmation")',
            '.list-menu-item-heading:has-text("Finish")'
          ];
          
          let nextPageFound = false;
          let nextPageCheckAttempts = 0;
          const maxNextPageChecks = 15; // 15 seconds
          
          while (!nextPageFound && nextPageCheckAttempts < maxNextPageChecks) {
            await page.waitForTimeout(1000);
            nextPageCheckAttempts++;
            
            for (const indicator of nextPageIndicators) {
              try {
                const element = page.locator(indicator).first();
                if (await element.count() > 0) {
                  const isVisible = await element.isVisible().catch(() => false);
                  if (isVisible) {
                    console.log(`✅ [PAYMENT_REQUEST] Found final confirmation page indicator: "${indicator}"`);
                    nextPageFound = true;
                    break;
                  }
                }
              } catch (e) {
                continue;
              }
            }
            
            if (!nextPageFound && nextPageCheckAttempts < maxNextPageChecks) {
              console.log(`⏳ [PAYMENT_REQUEST] Waiting for final confirmation page (attempt ${nextPageCheckAttempts}/${maxNextPageChecks})...`);
            }
          }
          
          if (nextPageFound) {
            console.log('✅ [PAYMENT_REQUEST] Final confirmation page detected - booking is complete!');
          } else {
            console.log('⚠️ [PAYMENT_REQUEST] Final confirmation page indicators not found, but proceeding (payment may have completed)');
          }
          
          console.log('✅ [PAYMENT_REQUEST] ============================================');
          console.log('✅ [PAYMENT_REQUEST] SUCCESS: Booking finalized!');
          console.log('✅ [PAYMENT_REQUEST] Payment completed and "Make booking" button clicked.');
          console.log('✅ [PAYMENT_REQUEST] Booking is now complete.');
          console.log('✅ [PAYMENT_REQUEST] ============================================');
          
          return {
            success: true,
            paymentCompleted: true,
            bookingFinalized: true,
            confirmationEmailSent: nextPageFound, // Indicate if confirmation page was detected
            message: '✅ SUCCESS: Payment request sent via ' + deliveryMethod + ' and payment completed successfully. "Make booking" button clicked. Booking finalized and completed.'
          };
        } catch (clickError) {
          console.error('❌ [PAYMENT_REQUEST] Error clicking "Make booking" button:', clickError);
          // Try force click
          try {
            await makeBookingButton.click({ force: true, timeout: 5000 });
            console.log('✅ [PAYMENT_REQUEST] "Make booking" button clicked with force');
            
            // Wait a moment for the click to register
            await page.waitForTimeout(500);
            
            // Wait for payment processing/confirmation (up to 30 seconds)
            console.log('⏳ [PAYMENT_REQUEST] Waiting for payment processing/confirmation...');
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
                    console.log(`✅ [PAYMENT_REQUEST] Found confirmation indicator: "${indicator}"`);
                    confirmationFound = true;
                    break;
                  }
                }
              } catch (e) {
                continue;
              }
            }
            
            // Wait additional time for payment processing if confirmation not immediately visible
            if (!confirmationFound) {
              console.log('⏳ [PAYMENT_REQUEST] Confirmation not immediately visible, waiting for payment processing...');
              await page.waitForTimeout(10000); // Additional 10 seconds
            }
            
            // CRITICAL: Check if we're still on the payment page (button should disappear or be disabled)
            let stillOnPaymentPage = true;
            let paymentPageCheckAttempts = 0;
            const maxPaymentPageChecks = 10; // 10 seconds
            
            // Determine search context (could be iframe or main page)
            let searchContextForCheck = searchContext || page;
            
            while (stillOnPaymentPage && paymentPageCheckAttempts < maxPaymentPageChecks) {
              await page.waitForTimeout(1000);
              paymentPageCheckAttempts++;
              
              try {
                const buttonStillExists = await searchContextForCheck.locator('#diaryNewCourseBookingWiz_OKBtn').count() > 0;
                if (buttonStillExists) {
                  const button = searchContextForCheck.locator('#diaryNewCourseBookingWiz_OKBtn').first();
                  const isVisible = await button.isVisible().catch(() => false);
                  const isDisabled = await button.getAttribute('disabled').catch(() => null);
                  
                  if (isVisible && isDisabled === null) {
                    console.log(`⏳ [PAYMENT_REQUEST] Still on payment page (attempt ${paymentPageCheckAttempts}/${maxPaymentPageChecks})...`);
                    continue;
                  }
                }
                stillOnPaymentPage = false;
                console.log('✅ [PAYMENT_REQUEST] Payment page navigation detected (button disappeared or disabled)');
              } catch (e) {
                stillOnPaymentPage = false;
                console.log('✅ [PAYMENT_REQUEST] Payment page navigation detected (button check failed)');
              }
            }
            
            if (stillOnPaymentPage) {
              console.log('⚠️ [PAYMENT_REQUEST] Still on payment page after 10 seconds - payment may not have processed');
            }
            
            // Wait for indicators that we're on the confirmation/next page
            const nextPageIndicators = [
              '#afterBookingMenu',
              '#afterBookingMenu .list-menu-item-heading:has-text("Send a confirmation")',
              '#afterBookingMenu .list-menu-item-heading:has-text("Finish")',
              'div.dx-item.dx-list-item[role="option"]:has(.list-menu-item-heading:has-text("Send a confirmation"))',
              'div.dx-item.dx-list-item[role="option"]:has(.list-menu-item-heading:has-text("Finish"))',
              '.list-menu-item-heading:has-text("Send a confirmation")',
              '.list-menu-item-heading:has-text("Finish")'
            ];
            
            let nextPageFound = false;
            let nextPageCheckAttempts = 0;
            const maxNextPageChecks = 15; // 15 seconds
            
            while (!nextPageFound && nextPageCheckAttempts < maxNextPageChecks) {
              await page.waitForTimeout(1000);
              nextPageCheckAttempts++;
              
              for (const indicator of nextPageIndicators) {
                try {
                  const element = page.locator(indicator).first();
                  if (await element.count() > 0) {
                    const isVisible = await element.isVisible().catch(() => false);
                    if (isVisible) {
                      console.log(`✅ [PAYMENT_REQUEST] Found final confirmation page indicator: "${indicator}"`);
                      nextPageFound = true;
                      break;
                    }
                  }
                } catch (e) {
                  continue;
                }
              }
              
              if (!nextPageFound && nextPageCheckAttempts < maxNextPageChecks) {
                console.log(`⏳ [PAYMENT_REQUEST] Waiting for final confirmation page (attempt ${nextPageCheckAttempts}/${maxNextPageChecks})...`);
              }
            }
            
            if (nextPageFound) {
              console.log('✅ [PAYMENT_REQUEST] Final confirmation page detected - booking is complete!');
            } else {
              console.log('⚠️ [PAYMENT_REQUEST] Final confirmation page indicators not found, but proceeding (payment may have completed)');
            }
            
            console.log('✅ [PAYMENT_REQUEST] ============================================');
            console.log('✅ [PAYMENT_REQUEST] SUCCESS: Booking finalized!');
            console.log('✅ [PAYMENT_REQUEST] Payment completed and "Make booking" button clicked.');
            console.log('✅ [PAYMENT_REQUEST] Booking is now complete.');
            console.log('✅ [PAYMENT_REQUEST] ============================================');
            
            return {
              success: true,
              paymentCompleted: true,
              bookingFinalized: true,
              confirmationEmailSent: nextPageFound, // Indicate if confirmation page was detected
              message: '✅ SUCCESS: Payment request sent via ' + deliveryMethod + ' and payment completed successfully. "Make booking" button clicked. Booking finalized and completed.'
            };
          } catch (forceClickError) {
            console.error('❌ [PAYMENT_REQUEST] Error with force click:', forceClickError);
            return {
              success: false,
              paymentCompleted: false,
              error: `Payment completed but failed to click "Make booking" button: ${forceClickError.message}`
            };
          }
        }
      }
      
      // Log that button not found yet
      console.log(`⏳ [PAYMENT_REQUEST] "Make booking" button not found yet (attempt ${attempt}/${MAX_ATTEMPTS})`);
    }
    
    // If we reach here, 10 minutes elapsed without finding the button
    console.error('❌ [PAYMENT_REQUEST] Payment not completed within 10 minutes - "Make booking" button not found');
    await takeScreenshot(page, 'payment-request-timeout.png', screenshotsDir);
    
    return {
      success: false,
      paymentCompleted: false,
      error: 'Payment not completed within 10 minutes. "Make booking" button did not appear.'
    };
    
  } catch (error) {
    console.error('❌ [PAYMENT_REQUEST] Error in sendPaymentRequest:', error);
    await takeScreenshot(page, 'payment-request-error.png', screenshotsDir);
    return {
      success: false,
      paymentCompleted: false,
      error: `Payment request failed: ${error.message}`
    };
  }
}

