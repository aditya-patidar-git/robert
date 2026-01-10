import { takeScreenshot } from './utils.js';

/**
 * Send Payment Request
 * Handles payment request modal/popup and polls for payment completion
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} deliveryMethod - 'email' or 'sms'
 * @param {string} clientEmail - Optional client email address
 * @param {string} clientMobile - Optional client mobile number
 * @returns {Promise<{success: boolean, paymentCompleted: boolean, error?: string}>}
 */
export async function sendPaymentRequest(page, screenshotsDir, deliveryMethod, clientEmail = null, clientMobile = null) {
  try {
    console.log(`💳 [PAYMENT_REQUEST] Sending payment request via ${deliveryMethod}...`);
    
    // Wait for payment request modal/popup to appear
    console.log('⏳ [PAYMENT_REQUEST] Waiting for payment request modal (#sendForm) to appear...');
    
    // Give time for modal to appear after payment option selection
    await page.waitForTimeout(3000);
    
    // Determine if we need to work with iframe or main page with retry logic
    let eventBookingIframeExists = false;
    let searchContext;
    
    // Try to detect iframe with retry logic
    for (let i = 0; i < 5; i++) {
      eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
      if (eventBookingIframeExists) {
        // Verify iframe is actually loaded
        try {
          const iframe = page.frameLocator('#eventNewBooking2_iframe');
          const testLocator = iframe.locator('body').first();
          await testLocator.waitFor({ state: 'attached', timeout: 2000 });
          console.log('🔍 [PAYMENT_REQUEST] Working with eventNewBooking2_iframe for payment request modal...');
          searchContext = iframe;
          break;
        } catch (iframeError) {
          console.log(`⚠️ [PAYMENT_REQUEST] Iframe detected but not loaded yet, retrying (${i + 1}/5)...`);
          if (i < 4) await page.waitForTimeout(2000);
        }
      } else {
        if (i < 4) {
          console.log(`⏳ [PAYMENT_REQUEST] Iframe not found, retrying (${i + 1}/5)...`);
          await page.waitForTimeout(2000);
        }
      }
    }
    
    if (!eventBookingIframeExists || !searchContext) {
      console.log('🔍 [PAYMENT_REQUEST] Working with main page for payment request modal...');
      searchContext = page;
    }
    
    // Wait for payment request form to appear with retry logic
    let sendForm;
    let modalFound = false;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        sendForm = searchContext.locator('#sendForm').first();
        await sendForm.waitFor({ state: 'visible', timeout: 20000 }); // Increased from 15000 to 20000
        modalFound = true;
        console.log('✅ [PAYMENT_REQUEST] Payment request modal appeared');
        break;
      } catch (error) {
        if (attempt < 2) {
          console.log(`⚠️ [PAYMENT_REQUEST] Payment request modal not visible yet, retrying (${attempt + 1}/3)...`);
          await page.waitForTimeout(3000);
          // Try alternative selectors
          const altSelectors = [
            '#sendForm',
            'form#sendForm',
            '[id="sendForm"]',
            'form:has-text("Send")',
            '.jqx-window-content:has(#sendForm)'
          ];
          
          for (const selector of altSelectors) {
            try {
              const altForm = searchContext.locator(selector).first();
              if (await altForm.count() > 0) {
                const isVisible = await altForm.isVisible({ timeout: 2000 }).catch(() => false);
                if (isVisible) {
                  sendForm = altForm;
                  modalFound = true;
                  console.log(`✅ [PAYMENT_REQUEST] Found payment request modal using alternative selector: ${selector}`);
                  break;
                }
              }
            } catch (altError) {
              continue;
            }
          }
          
          if (modalFound) break;
        } else {
          throw error;
        }
      }
    }
    
    if (!modalFound || !sendForm) {
      throw new Error('Payment request modal (#sendForm) not found after multiple attempts');
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
    if (deliveryMethod === 'email' && clientEmail) {
      console.log(`📧 [PAYMENT_REQUEST] Filling email address: ${clientEmail}`);
      const emailInput = searchContext.locator('#cnt_email').first();
      await emailInput.waitFor({ state: 'visible', timeout: 5000 });
      await emailInput.fill(clientEmail);
      await page.waitForTimeout(500);
    } else if (deliveryMethod === 'sms' && clientMobile) {
      console.log(`📱 [PAYMENT_REQUEST] Filling mobile number: ${clientMobile}`);
      const mobileInput = searchContext.locator('#cnt_mobile_number').first();
      await mobileInput.waitFor({ state: 'visible', timeout: 5000 });
      await mobileInput.fill(clientMobile);
      await page.waitForTimeout(500);
    }
    
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
    console.log('⏳ [PAYMENT_REQUEST] Starting polling for payment completion (every 30 seconds, max 5 minutes)...');
    
    const POLL_INTERVAL = 30000; // 30 seconds
    const MAX_WAIT_TIME = 300000; // 5 minutes
    const MAX_ATTEMPTS = 10; // 5 minutes / 30 seconds = 10 attempts
    
    // Make booking button selectors (from acceptTermsAndMakeBooking.js)
    const makeBookingSelectors = [
      '#diaryNewCourseBookingWiz_OKBtn',
      'button:has-text("Make booking")',
      '[aria-label="Make booking"]',
      '.jqx_wizardBtn:has-text("Make booking")',
      'button.dx-button-success:has-text("Make booking")',
      'button:has-text("MAKE BOOKING")',
      '[role="button"]:has-text("Make booking")'
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
      
      // Check for "Make booking" button in both iframe and main page contexts
      for (const selector of makeBookingSelectors) {
        try {
          // Check in iframe context
          if (eventBookingIframeExists) {
            const iframeButton = searchContext.locator(selector).first();
            if (await iframeButton.count() > 0) {
              const isVisible = await iframeButton.isVisible().catch(() => false);
              if (isVisible) {
                console.log(`✅ [PAYMENT_REQUEST] Found "Make booking" button in iframe using selector: "${selector}"`);
                makeBookingButton = iframeButton;
                break;
              }
            }
          }
          
          // Check in main page context
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
          
          await takeScreenshot(page, 'payment-completed-make-booking-clicked.png', screenshotsDir);
          
          // Wait a moment for booking to process
          await page.waitForTimeout(2000);
          
          console.log('✅ [PAYMENT_REQUEST] ============================================');
          console.log('✅ [PAYMENT_REQUEST] SUCCESS: Booking finalized!');
          console.log('✅ [PAYMENT_REQUEST] Payment completed and "Make booking" button clicked.');
          console.log('✅ [PAYMENT_REQUEST] Booking is now complete.');
          console.log('✅ [PAYMENT_REQUEST] ============================================');
          
          return {
            success: true,
            paymentCompleted: true,
            bookingFinalized: true,
            message: '✅ SUCCESS: Payment request sent via ' + deliveryMethod + ' and payment completed successfully. "Make booking" button clicked. Booking finalized and completed.'
          };
        } catch (clickError) {
          console.error('❌ [PAYMENT_REQUEST] Error clicking "Make booking" button:', clickError);
          // Try force click
          try {
            await makeBookingButton.click({ force: true, timeout: 5000 });
            console.log('✅ [PAYMENT_REQUEST] "Make booking" button clicked with force');
            
            await page.waitForTimeout(2000);
            
            console.log('✅ [PAYMENT_REQUEST] ============================================');
            console.log('✅ [PAYMENT_REQUEST] SUCCESS: Booking finalized!');
            console.log('✅ [PAYMENT_REQUEST] Payment completed and "Make booking" button clicked.');
            console.log('✅ [PAYMENT_REQUEST] Booking is now complete.');
            console.log('✅ [PAYMENT_REQUEST] ============================================');
            
            return {
              success: true,
              paymentCompleted: true,
              bookingFinalized: true,
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
    
    // If we reach here, 5 minutes elapsed without finding the button
    console.error('❌ [PAYMENT_REQUEST] Payment not completed within 5 minutes - "Make booking" button not found');
    await takeScreenshot(page, 'payment-request-timeout.png', screenshotsDir);
    
    return {
      success: false,
      paymentCompleted: false,
      error: 'Payment not completed within 5 minutes. "Make booking" button did not appear.'
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

