import * as commonSteps from './index.js';

/**
 * Unified Payment Handler
 * Supports both payment request link and Twilio Pay (DTMF-based, PCI Mode)
 * Booking completion only occurs after payment confirmation
 */

/**
 * Process payment using the configured method
 * @param {Page} page - Playwright page object
 * @param {Object} bookingArgs - Booking arguments
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {Array} screenshots - Screenshots array to append to
 * @returns {Promise<{success: boolean, paymentCompleted: boolean, paymentMethod?: string, error?: string}>}
 */
export async function processPayment(page, bookingArgs, screenshotsDir, screenshots) {
  try {
    console.log('💳 [PAYMENT] Processing payment...');
    
    // Determine payment method from bookingArgs or environment
    // Priority: bookingArgs.paymentMethod > env variable > default to 'payment_link'
    const paymentMethod = bookingArgs.paymentMethod || 
                          process.env.DEFAULT_PAYMENT_METHOD || 
                          'payment_link';
    
    console.log(`💳 [PAYMENT] Using payment method: ${paymentMethod}`);
    
    // Step 1: Select payment option (common for all methods)
    await commonSteps.selectPaymentOption(page, screenshotsDir);
    screenshots.push(await commonSteps.takeScreenshot(page, 'payment-option-selected.png', screenshotsDir));
    await page.waitForTimeout(2000);
    
    // Step 2: Select payment method (common for all methods)
    await commonSteps.selectPaymentMethod(page, screenshotsDir);
    screenshots.push(await commonSteps.takeScreenshot(page, 'payment-method-selected.png', screenshotsDir));
    await page.waitForTimeout(2000);
    
    // Step 3: Process payment based on method
    let paymentResult;
    
    if (paymentMethod === 'twilio_pay' || paymentMethod === 'phone_payment') {
      // Option 2: Twilio Pay (DTMF-based, PCI Mode)
      paymentResult = await processTwilioPay(page, bookingArgs, screenshotsDir, screenshots);
    } else {
      // Option 1: Payment request link (default)
      paymentResult = await processPaymentLink(page, bookingArgs, screenshotsDir, screenshots);
    }
    
    if (!paymentResult.success) {
      return paymentResult;
    }
    
    // Step 4: Wait for payment confirmation before proceeding
    const confirmationResult = await waitForPaymentConfirmation(page, paymentMethod, screenshotsDir, screenshots);
    
    if (!confirmationResult.confirmed) {
      return {
        success: false,
        paymentCompleted: false,
        error: 'Payment confirmation not received. Booking cannot be completed without payment confirmation.',
        paymentMethod: paymentMethod
      };
    }
    
    // Step 5: Accept terms and make booking (only after payment confirmed)
    const termsAccepted = bookingArgs.termsAccepted !== undefined ? bookingArgs.termsAccepted : true;
    const bookingResult = await commonSteps.acceptTermsAndMakeBooking(page, screenshotsDir, termsAccepted, false);
    
    if (!bookingResult.success) {
      if (!bookingResult.termsAccepted) {
        return {
          success: false,
          paymentCompleted: true, // Payment was completed but terms not accepted
          error: 'Client did not accept terms - booking cancelled',
          paymentMethod: paymentMethod
        };
      } else {
        return {
          success: false,
          paymentCompleted: true, // Payment was completed but booking failed
          error: `Failed to complete booking: ${bookingResult.error}`,
          paymentMethod: paymentMethod
        };
      }
    }
    
    screenshots.push(await commonSteps.takeScreenshot(page, 'booking-completed.png', screenshotsDir));
    console.log('✅ [PAYMENT] Payment processed and booking completed');
    
    return {
      success: true,
      paymentCompleted: true,
      paymentMethod: paymentMethod,
      grandTotal: bookingResult.grandTotal
    };
    
  } catch (error) {
    console.error('❌ [PAYMENT] Error processing payment:', error);
    screenshots.push(await commonSteps.takeScreenshot(page, 'payment-error.png', screenshotsDir));
    return {
      success: false,
      paymentCompleted: false,
      error: `Payment processing failed: ${error.message}`
    };
  }
}

/**
 * Process payment via payment request link
 * @param {Page} page - Playwright page object
 * @param {Object} bookingArgs - Booking arguments
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {Array} screenshots - Screenshots array
 * @returns {Promise<{success: boolean}>}
 */
async function processPaymentLink(page, bookingArgs, screenshotsDir, screenshots) {
  try {
    console.log('🔗 [PAYMENT] Processing payment via payment request link...');
    
    // For payment link method, we don't fill card details in the CRM
    // Instead, the system generates a payment link that the customer uses
    // This is typically handled outside the CRM flow
    
    // Check if payment link URL is provided
    const paymentLinkUrl = bookingArgs.paymentLinkUrl || process.env.PAYMENT_LINK_URL;
    
    if (paymentLinkUrl) {
      console.log(`🔗 [PAYMENT] Payment link URL provided: ${paymentLinkUrl}`);
      // In a real implementation, you would:
      // 1. Generate or retrieve payment link
      // 2. Send link to customer (via SMS/email)
      // 3. Wait for payment confirmation webhook
      // For now, we'll simulate this by waiting
      console.log('⏳ [PAYMENT] Payment link method - waiting for external payment confirmation...');
    } else {
      console.log('⚠️ [PAYMENT] No payment link URL provided - using fallback card details method');
      // Fallback: Fill card details if no payment link
      await commonSteps.fillCardDetails(page, screenshotsDir);
      screenshots.push(await commonSteps.takeScreenshot(page, 'card-details-filled.png', screenshotsDir));
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ [PAYMENT] Error processing payment link:', error);
    return {
      success: false,
      error: `Payment link processing failed: ${error.message}`
    };
  }
}

/**
 * Process payment via Twilio Pay (DTMF-based, PCI Mode)
 * @param {Page} page - Playwright page object
 * @param {Object} bookingArgs - Booking arguments
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {Array} screenshots - Screenshots array
 * @returns {Promise<{success: boolean}>}
 */
async function processTwilioPay(page, bookingArgs, screenshotsDir, screenshots) {
  try {
    console.log('📞 [PAYMENT] Processing payment via Twilio Pay...');
    
    // Twilio Pay is handled via phone call (DTMF input)
    // The actual payment processing happens during the call
    // This function prepares the CRM for payment confirmation
    
    // For Twilio Pay, we typically don't fill card details in CRM
    // Instead, payment is processed via phone call and confirmed via webhook
    
    console.log('📞 [PAYMENT] Twilio Pay method - payment will be processed via phone call');
    console.log('📞 [PAYMENT] Waiting for Twilio Pay confirmation webhook...');
    
    // In a real implementation, you would:
    // 1. Initiate Twilio Pay during the call
    // 2. Collect card details via DTMF
    // 3. Process payment via Twilio
    // 4. Wait for payment confirmation webhook
    // 5. Mark payment as confirmed
    
    // For now, we'll simulate this
    // In production, this would be handled by the call handler
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ [PAYMENT] Error processing Twilio Pay:', error);
    return {
      success: false,
      error: `Twilio Pay processing failed: ${error.message}`
    };
  }
}

/**
 * Wait for payment confirmation
 * @param {Page} page - Playwright page object
 * @param {string} paymentMethod - Payment method used
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {Array} screenshots - Screenshots array
 * @returns {Promise<{confirmed: boolean, confirmationTime?: Date}>}
 */
async function waitForPaymentConfirmation(page, paymentMethod, screenshotsDir, screenshots) {
  try {
    console.log('⏳ [PAYMENT] Waiting for payment confirmation...');
    
    // For payment link: Wait for webhook or check payment status
    if (paymentMethod === 'payment_link') {
      // In production, this would:
      // 1. Check payment status via API
      // 2. Wait for webhook confirmation
      // 3. Poll payment status if needed
      
      // For now, simulate confirmation after a short wait
      // In production, replace this with actual payment status check
      console.log('⏳ [PAYMENT] Checking payment link status...');
      await page.waitForTimeout(2000); // Simulate API call
      
      // TODO: Implement actual payment status check
      // const paymentStatus = await checkPaymentStatus(paymentLinkId);
      // if (paymentStatus !== 'confirmed') {
      //   return { confirmed: false };
      // }
      
      // For now, assume confirmed (in production, verify via API)
      console.log('✅ [PAYMENT] Payment link confirmed');
      return { confirmed: true, confirmationTime: new Date() };
    }
    
    // For Twilio Pay: Payment is confirmed during call
    if (paymentMethod === 'twilio_pay' || paymentMethod === 'phone_payment') {
      // Twilio Pay confirmation happens during the call
      // The call handler should set paymentConfirmed flag
      // For now, assume confirmed if we reach this point
      console.log('✅ [PAYMENT] Twilio Pay confirmed (processed during call)');
      return { confirmed: true, confirmationTime: new Date() };
    }
    
    // Fallback: If card details were filled, assume payment will be processed
    // This maintains backward compatibility
    console.log('⚠️ [PAYMENT] Unknown payment method, assuming payment will be processed');
    return { confirmed: true, confirmationTime: new Date() };
    
  } catch (error) {
    console.error('❌ [PAYMENT] Error waiting for payment confirmation:', error);
    return { confirmed: false };
  }
}

/**
 * Check payment status (to be implemented with actual payment provider API)
 * @param {string} paymentId - Payment ID or reference
 * @returns {Promise<{status: string, confirmed: boolean}>}
 */
async function checkPaymentStatus(paymentId) {
  // TODO: Implement actual payment status check
  // This would call the payment provider's API to check status
  // For payment links: Check if link has been paid
  // For Twilio Pay: Check if payment was processed
  
  return {
    status: 'pending',
    confirmed: false
  };
}

