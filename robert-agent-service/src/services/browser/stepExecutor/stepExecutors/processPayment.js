/**
 * Process Payment Step Executor
 * Handles payment processing with payment request strategy
 * Preserves all Playwright timing and state checks
 */

import { trackCRMBooking, buildBookingData } from '../../../bookingTrackingClient.js';

/**
 * Execute processPayment step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<Object>} Step execution result
 */
export async function executeProcessPayment(page, args, sessionState, screenshotsDir) {
  // Use the updated payment strategy: Select "Send a payment request" and use sendPaymentRequest
  const screenshots = [];

  // CRITICAL: If we're already on the payment request link page (e.g. after a prior call returned requiresPaymentMethod),
  // skip selectPaymentOption to avoid waiting for the dropdown in #eventNewBooking2_iframe (it's hidden on this page) and timeout/race.
  let onPaymentRequestPage = false;
  const paymentRequestIframeCount = await page.locator('#contactSend3DSecureRequest_iframe').count();
  if (paymentRequestIframeCount > 0) {
    try {
      const paymentRequestIframe = page.frameLocator('#contactSend3DSecureRequest_iframe');
      const testLocator = paymentRequestIframe.locator('body').first();
      await testLocator.waitFor({ state: 'attached', timeout: 2000 });
      onPaymentRequestPage = true;
      console.log('✅ [PAYMENT] Already on payment request link page - skipping selectPaymentOption');
    } catch (_) {
      // Iframe exists but not loaded yet; fall through to normal flow
    }
  }

  if (!onPaymentRequestPage) {
    // CRITICAL: Wait for page to fully transition from contact details to payment page
    console.log('⏳ [PAYMENT] Waiting for page transition from contact details to payment page...');
    await page.waitForTimeout(5000); // Increased wait time for page transition

    // Verify we're on the payment page before proceeding
    console.log('🔍 [PAYMENT] Verifying payment page is loaded...');
    const paymentPageIndicators = [
      page.locator('text=/Confirm and Pay/i').first(),
      page.locator('text=/4. Pay/i').first(),
      page.locator('text=/Payment/i').first(),
      page.locator('#eventNewBooking2_iframe').first()
    ];

    let pageReady = false;
    for (let i = 0; i < 5; i++) {
      for (const indicator of paymentPageIndicators) {
        const count = await indicator.count();
        if (count > 0) {
          pageReady = true;
          break;
        }
      }
      if (pageReady) break;
      if (i < 4) {
        console.log(`⏳ [PAYMENT] Payment page not ready yet, waiting (${i + 1}/5)...`);
        await page.waitForTimeout(2000);
      }
    }

    if (!pageReady) {
      console.log('⚠️ [PAYMENT] Payment page indicators not found, but continuing...');
    } else {
      console.log('✅ [PAYMENT] Payment page is ready');
    }

    // Step 1: Select "Send a payment request" option (updated strategy)
    const { selectPaymentOption } = await import('../../../commonBookingSteps/selectPaymentOption.js');
    await selectPaymentOption(page, screenshotsDir, 'request');
    screenshots.push(await (await import('../../../commonBookingSteps/utils.js')).takeScreenshot(page, 'payment-option-selected-request.png', screenshotsDir));

    // Verify page transition completed before proceeding
    console.log('🔍 [PAYMENT] Verifying page transition to payment request link page...');
    for (let i = 0; i < 5; i++) {
      const exists = await page.locator('#contactSend3DSecureRequest_iframe').count() > 0;
      if (exists) {
        try {
          const paymentRequestIframe = page.frameLocator('#contactSend3DSecureRequest_iframe');
          const testLocator = paymentRequestIframe.locator('body').first();
          await testLocator.waitFor({ state: 'attached', timeout: 2000 });
          console.log('✅ [PAYMENT] Confirmed: On payment request link page (contactSend3DSecureRequest_iframe)');
          onPaymentRequestPage = true;
          break;
        } catch (iframeError) {
          // Iframe exists but not loaded yet
        }
      }
      if (i < 4) {
        await page.waitForTimeout(2000);
        console.log(`⏳ [PAYMENT] Waiting for payment request page transition (${i + 1}/5)...`);
      }
    }

    if (!onPaymentRequestPage) {
      console.warn('⚠️ [PAYMENT] Page transition verification failed - may still be on payment page');
      console.warn('⚠️ [PAYMENT] sendPaymentRequest will attempt to detect correct page');
    }

    await page.waitForTimeout(2000); // Additional wait for page stability
  }

  // Step 2: Get client email/mobile from args or sessionState
  let clientEmail = args.clientEmail || args.customerEmail || null;
  let clientMobile = args.clientMobile || args.customerMobile || args.customerPhone || null;
  
  // Try to get from sessionState if not provided in args
  if (!clientEmail || !clientMobile) {
    // Extract callSid from sessionState to access conversation state
    let callSid = args.callSid || null;
    if (!callSid && sessionState?.browserSessionId) {
      const match = sessionState.browserSessionId.match(/^browser_(.+?)_\d+$/);
      if (match) {
        callSid = match[1];
      }
    }
    
    if (callSid) {
      const { conversations } = await import('../../../../shared/state.js');
      const conversation = conversations[callSid];
      
      if (conversation) {
        // Get from clientDetails
        if (!clientEmail && conversation.clientDetails?.email) {
          clientEmail = conversation.clientDetails.email;
        }
        if (!clientMobile && conversation.clientDetails?.telephoneNumber) {
          clientMobile = conversation.clientDetails.telephoneNumber;
        }
        
        // Fallback to KBA email
        if (!clientEmail && conversation.kba?.email) {
          clientEmail = conversation.kba.email;
        }
      }
    }
  }
  
  // Step 3: Determine delivery method - MUST be provided by agent (agent should ask client first)
  const deliveryMethod = args.deliveryMethod;
  if (!deliveryMethod || (deliveryMethod !== 'email' && deliveryMethod !== 'sms')) {
    return {
      success: false,
      paymentCompleted: false,
      error: 'deliveryMethod is required and must be "email" or "sms". The agent must ask the client "Would you like to receive the payment request via email or SMS?" before calling this tool.',
      requiresPaymentMethod: true,
      message: 'Would you like to receive the payment request via email or SMS?',
      instruction: 'CRITICAL: Do NOT call booking_step_process_payment again. Ask the caller: "Would you like to receive the payment request via email or SMS?" When they answer, call **booking_step_send_payment_request** with deliveryMethod: "email" or "sms" (and courseType, workflowType, and clientEmail or clientMobile as needed).'
    };
  }
  
  if (!clientEmail && !clientMobile) {
    return {
      success: false,
      paymentCompleted: false,
      error: 'Client email or mobile number is required for payment request. Please provide clientEmail or clientMobile in the tool arguments.'
    };
  }
  
  // Step 4: Terms acceptance - omit on first call to get termsText; pass true after caller accepts
  const termsAccepted = args.termsAccepted;
  if (termsAccepted === undefined) {
    console.log('📋 [PAYMENT] termsAccepted not provided - sendPaymentRequest will return termsText for agent to read to caller');
  }
  
  // Step 5: Use sendPaymentRequest (pass termsAccepted so we get terms back when undefined, or proceed when true)
  const { sendPaymentRequest } = await import('../../../commonBookingSteps/sendPaymentRequest.js');
  
  const paymentResult = await sendPaymentRequest(
    page,
    screenshotsDir,
    deliveryMethod,
    clientEmail,
    clientMobile,
    false, // confirmed
    termsAccepted // termsAcceptedBeforeSend: undefined = return terms; true = proceed
  );

  // When terms not yet accepted, return requiresTermsBeforeSend + termsText so agent can read terms and call again with termsAccepted: true
  if (paymentResult.success && paymentResult.requiresTermsBeforeSend) {
    return {
      success: true,
      paymentCompleted: false,
      requiresTermsBeforeSend: true,
      termsText: paymentResult.termsText,
      message: paymentResult.message,
      instruction: paymentResult.instruction || 'Read the terms to the caller and ask "Do you accept the terms and conditions?" When they say yes, call booking_step_process_payment again with the same courseType and workflowType plus termsAccepted: true.'
    };
  }

  if (paymentResult.success && paymentResult.paymentCompleted) {
    // After payment is confirmed, terms should be read before clicking "Make booking"
    // This is handled by acceptTermsAndMakeBooking which is called from sendPaymentRequest
    
    // Track the booking in the backend database
    try {
      const bookingData = buildBookingData({
        bookingArgs: args,
        callContext: { callSid: args.callSid },
        sessionDetails: sessionState?.sessionDetails || {},
        paymentCompleted: true,
        workflowType: sessionState?.workflowType || args.workflowType || 'new',
        serviceType: args.courseType || sessionState?.courseType || 'ITM'
      });
      
      const trackingResult = await trackCRMBooking(bookingData);
      if (trackingResult.success) {
        console.log(`✅ [PAYMENT] Booking tracked in database: ${trackingResult.bookingId}`);
      } else {
        console.warn(`⚠️ [PAYMENT] Booking tracking failed (non-critical): ${trackingResult.error}`);
      }
    } catch (trackingError) {
      // Don't fail the workflow if tracking fails
      console.warn(`⚠️ [PAYMENT] Booking tracking error (non-critical):`, trackingError.message);
    }
    
    return {
      success: true,
      paymentCompleted: true,
      bookingFinalized: true,
      paymentMethod: 'payment_request',
      message: paymentResult.message || `✅ SUCCESS: Payment request sent via ${deliveryMethod} and payment completed successfully. ${termsAccepted === undefined ? '⚠️ IMPORTANT: Please read terms and conditions to the client before proceeding with booking confirmation.' : 'Booking finalized and completed.'}`
    };
  }
  
  return {
    success: paymentResult.success,
    paymentCompleted: paymentResult.paymentCompleted || false,
    paymentMethod: 'payment_request',
    error: paymentResult.error,
    message: paymentResult.message
  };
}
