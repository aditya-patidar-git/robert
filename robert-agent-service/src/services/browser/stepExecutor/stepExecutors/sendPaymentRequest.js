/**
 * Send Payment Request Step Executor
 * Handles payment request sending
 * Preserves all Playwright timing and state checks
 */

import { conversations } from '../../../../shared/state.js';

/**
 * Execute sendPaymentRequest step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
export async function executeSendPaymentRequest(page, args, sessionState, screenshotsDir, progressCallback = null) {
  // Use sendPaymentRequest from commonBookingSteps
  const { sendPaymentRequest } = await import('../../../commonBookingSteps/sendPaymentRequest.js');
  
  // CRITICAL FIX: Check if we're still on PaymentPage (need to select "Send a payment request" first)
  // After ClientDetailsPage, we first land on PaymentPage, not paymentRequestLink page
  // We must select "Send a payment request" from dropdown before we can access paymentRequestLink page
  console.log('🔍 [SEND_PAYMENT_REQUEST] Checking current page state...');
  progressCallback?.({ message: 'Checking the payment page.' });

  const isOnPaymentPage = await page.locator('#eventNewBooking2_iframe').count() > 0;
  const isOnPaymentRequestPage = await page.locator('#contactSend3DSecureRequest_iframe').count() > 0;
  
  if (isOnPaymentPage && !isOnPaymentRequestPage) {
    console.log('⚠️ [SEND_PAYMENT_REQUEST] Still on PaymentPage - need to select "Send a payment request" first');
    progressCallback?.({ message: 'Opening the payment request form.' });
    console.log('📋 [SEND_PAYMENT_REQUEST] Calling selectPaymentOption to select "Send a payment request"...');
    
    // Step 1: Select "Send a payment request" option
    const { selectPaymentOption } = await import('../../../commonBookingSteps/selectPaymentOption.js');
    await selectPaymentOption(page, screenshotsDir, 'request', progressCallback);
    
    // Step 2: Wait for page transition to paymentRequestLink page
    console.log('⏳ [SEND_PAYMENT_REQUEST] Waiting for page transition to payment request link page...');
    let transitionComplete = false;
    for (let i = 0; i < 10; i++) {
      const paymentRequestIframeExists = await page.locator('#contactSend3DSecureRequest_iframe').count() > 0;
      if (paymentRequestIframeExists) {
        try {
          const paymentRequestIframe = page.frameLocator('#contactSend3DSecureRequest_iframe');
          const testLocator = paymentRequestIframe.locator('body').first();
          await testLocator.waitFor({ state: 'attached', timeout: 2000 });
          console.log('✅ [SEND_PAYMENT_REQUEST] Page transition complete - now on payment request link page');
          transitionComplete = true;
          break;
        } catch (iframeError) {
          // Iframe exists but not loaded yet
        }
      }
      if (i < 9) {
        await page.waitForTimeout(2000);
      }
    }
    
    if (!transitionComplete) {
      console.warn('⚠️ [SEND_PAYMENT_REQUEST] Page transition may not have completed, but proceeding...');
    }
  } else if (isOnPaymentRequestPage) {
    console.log('✅ [SEND_PAYMENT_REQUEST] Already on payment request link page');
    progressCallback?.({ message: 'Payment form is ready.' });
  } else {
    console.warn('⚠️ [SEND_PAYMENT_REQUEST] Could not determine current page state, proceeding...');
  }
  
  const deliveryMethod = args.deliveryMethod; // 'email' or 'sms' (required)
  if (!deliveryMethod || (deliveryMethod !== 'email' && deliveryMethod !== 'sms')) {
    return {
      success: false,
      paymentCompleted: false,
      error: 'deliveryMethod is required and must be "email" or "sms". The agent must ask the client "Would you like to receive the payment request via email or SMS?" before calling this tool.',
      requiresPaymentMethod: true,
      message: 'Would you like to receive the payment request via email or SMS?'
    };
  }
  
  const clientEmail = args.clientEmail || null;
  const clientMobile = args.clientMobile || null;
  
  // FIX: Explicitly check for true boolean value, not just truthy
  // Handle both boolean true and string "true" (in case it comes as string from JSON)
  // Also accept confirmedByClient and confirmationReceived (model sometimes sends these instead of confirmed)
  const confirmed = args.confirmed === true || args.confirmed === 'true' ||
    args.confirmedByClient === true || args.confirmedByClient === 'true' ||
    args.confirmationReceived === true || args.confirmationReceived === 'true';
  
  // Extract termsAcceptedBeforeSend parameter (MANDATORY check)
  let termsAcceptedBeforeSend = args.termsAcceptedBeforeSend === true ? true : (args.termsAcceptedBeforeSend === false ? false : undefined);

  // ROBUST FIX (confirmation loop): When the caller is confirming email/phone (confirmed === true), they already accepted terms in a prior turn. The model often omits termsAcceptedBeforeSend when calling with confirmed: true (e.g. via booking_step_confirm_payment_request alias). Treat terms as accepted so we proceed to tap Send and do not re-ask for terms. If the user explicitly rejected terms (false), we do not override—existing flow handles transfer/terminate.
  if (confirmed && termsAcceptedBeforeSend !== false) {
    termsAcceptedBeforeSend = true;
    console.log('🔍 [SEND_PAYMENT_REQUEST] Confirmation step: treating terms as accepted (proceeding to send payment link)');
  }

  // CRITICAL: Break confirmation loop — if we already returned requiresConfirmation once and the tool is invoked again with same email/phone and terms accepted, treat as confirmed (model often omits confirmed: true).
  const callSid = args.callSid || null;
  let effectiveConfirmed = confirmed;
  if (!effectiveConfirmed && callSid && termsAcceptedBeforeSend && (clientEmail || clientMobile)) {
    if (conversations[callSid]?.paymentRequestConfirmationRequested) {
      effectiveConfirmed = true;
      delete conversations[callSid].paymentRequestConfirmationRequested;
      console.log('🔍 [SEND_PAYMENT_REQUEST] Re-invocation after requiresConfirmation: treating as confirmed (breaking loop)');
    }
  }

  // Debug logging to trace parameter passing
  console.log(`🔍 [SEND_PAYMENT_REQUEST] All args keys:`, Object.keys(args));
  console.log(`🔍 [SEND_PAYMENT_REQUEST] Confirmed parameter: confirmed=${args.confirmed}, confirmedByClient=${args.confirmedByClient}, confirmationReceived=${args.confirmationReceived}, evaluated as: ${confirmed}, effectiveConfirmed: ${effectiveConfirmed}`);
  console.log(`🔍 [SEND_PAYMENT_REQUEST] TermsAcceptedBeforeSend parameter: ${args.termsAcceptedBeforeSend} (type: ${typeof args.termsAcceptedBeforeSend}), evaluated as: ${termsAcceptedBeforeSend}`);
  
  const result = await sendPaymentRequest(
    page,
    screenshotsDir,
    deliveryMethod,
    clientEmail,
    clientMobile,
    effectiveConfirmed,
    termsAcceptedBeforeSend,
    progressCallback
  );

  if (result.requiresConfirmation && callSid) {
    if (!conversations[callSid]) conversations[callSid] = {};
    conversations[callSid].paymentRequestConfirmationRequested = true;
  }
  
  // CRITICAL: Handle terms-related results FIRST (before any other processing)
  // Terms check is MANDATORY and must be handled before email/mobile confirmation
  if (result.requiresTermsBeforeSend) {
    return {
      success: true,
      paymentCompleted: false,
      requiresTermsBeforeSend: true,
      termsText: result.termsText,
      message: result.message,
      instruction: result.instruction
    };
  }
  
  if (result.termsNotAccepted) {
    return {
      success: false,
      paymentCompleted: false,
      termsNotAccepted: true,
      requiresRetry: result.requiresRetry,
      message: result.message,
      instruction: result.instruction
    };
  }
  
  // If email is required from caller (form and clientEmail both empty), return early
  if (result.requiresClientEmail) {
    return {
      success: true,
      paymentCompleted: false,
      requiresClientEmail: true,
      deliveryMethod: result.deliveryMethod ?? deliveryMethod,
      message: result.message,
      instruction: result.instruction
    };
  }

  if (result.requiresClientMobile) {
    return {
      success: true,
      paymentCompleted: false,
      requiresClientMobile: true,
      deliveryMethod: result.deliveryMethod ?? deliveryMethod,
      message: result.message,
      instruction: result.instruction
    };
  }
  
  // If confirmation is required, return early
  if (result.requiresConfirmation) {
    return {
      success: true,
      paymentCompleted: false,
      requiresConfirmation: true,
      emailAddress: result.emailAddress,
      phoneNumber: result.phoneNumber,
      deliveryMethod: deliveryMethod,
      message: result.message
    };
  }
  
  // Return result with enhanced message if successful
  if (result.success && result.paymentCompleted) {
    return {
      success: true,
      paymentCompleted: true,
      bookingFinalized: true,
      message: result.message || `✅ SUCCESS: Payment request sent via ${deliveryMethod} and payment completed successfully. Booking finalized and completed.`
    };
  }
  
  return {
    success: result.success,
    paymentCompleted: result.paymentCompleted || false,
    error: result.error,
    message: result.message
  };
}
