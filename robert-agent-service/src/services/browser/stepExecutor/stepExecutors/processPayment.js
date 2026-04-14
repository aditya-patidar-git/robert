/**
 * Process Payment Step Executor
 * Handles payment processing with payment request strategy
 * Preserves all Playwright timing and state checks
 */

import { trackCRMBooking, buildBookingData } from '../../../bookingTrackingClient.js';
import { CRM_STABILITY_DELAY_MS } from '../../../commonBookingSteps/utils.js';
import { getTermsText, validateTermsAcceptance } from '../../../commonBookingSteps/termsUtils.js';

/**
 * Execute processPayment step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
export async function executeProcessPayment(page, args, sessionState, screenshotsDir, progressCallback = null) {
  progressCallback?.({ message: 'Opening the payment page.' });
  // Use the updated payment strategy: Select "Send a payment request" and use sendPaymentRequest
  const screenshots = [];
  const requestedPaymentSource = normalizePaymentSource(args);

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
    progressCallback?.({ message: 'Loading the payment page.' });
    console.log('🔍 [PAYMENT] Waiting for payment page...');
    let paymentPageIndicator = null;
    try {
      paymentPageIndicator = await Promise.race([
        page.waitForSelector('text=/Confirm and Pay/i', { timeout: 10000 }).then(() => 'Confirm and Pay text'),
        page.waitForSelector('text=/4\\. Pay/i', { timeout: 10000 }).then(() => '4. Pay text'),
        page.waitForSelector('#eventNewBooking2_iframe', { state: 'attached', timeout: 10000 }).then(() => 'eventNewBooking2_iframe')
      ]);
    } catch (_) {
      // All selectors timed out
    }
    if (paymentPageIndicator) {
      console.log(`✅ [PAYMENT] Payment page ready (matched: ${paymentPageIndicator})`);
    } else {
      console.warn('⚠️ [PAYMENT] No payment page indicator found within 10s — proceeding cautiously');
    }

    // Balance-first branch: if CRM shows positive available balance and caller has not chosen yet,
    // ask whether to use balance or send a payment link.
    const balanceInfo = await detectAvailableBalance(page);

    // "No payment required" fast path: the CRM may display a banner such as
    // "There is no need to take a payment" when the client's balance/credit already covers the
    // booking fee.  In that case the payment dropdown does NOT exist on the page — there is
    // nothing to select.  We skip the balance-decision question and go straight to terms → Make Booking.
    const noPaymentRequired = await detectNoPaymentRequired(page);
    if (noPaymentRequired && requestedPaymentSource == null && args.deliveryMethod == null) {
      const effectiveBalance = balanceInfo.hasAvailableBalance ? balanceInfo.availableBalance : 0;
      console.log(`✅ [PAYMENT] CRM indicates no payment required (credit/balance: GBP ${effectiveBalance.toFixed(2)}) — skipping payment dropdown, proceeding to terms → Make Booking`);

      const termsValidation = validateTermsAcceptance(args.termsAccepted);
      if (termsValidation.requiresTermsBeforeSend) {
        const termsText = getTermsText();
        return {
          success: true,
          paymentCompleted: false,
          requiresTermsBeforeSend: true,
          makeBookingReady: true,
          paymentAlreadyCovered: true,
          noPaymentRequired: true,
          termsText,
          message: `The system shows there is no need to take a payment — the booking fee is already covered (for example, from a previous overpayment or account credit of GBP ${effectiveBalance.toFixed(2)}). Do NOT offer a payment request link. Before completing the booking, read the following terms and conditions word-for-word to the caller:\n\n${termsText}`,
          instruction: 'CRITICAL — MANDATORY TERMS STEP: Read the termsText field above word-for-word to the caller (do NOT summarise or paraphrase). After reading, ask exactly: "Do you agree with the statements that I have just made?" Wait for the caller\'s answer. If YES: call **booking_step_process_payment** again with courseType, workflowType, **termsAccepted: true**, and **useAvailableBalance: true**. If NO: handle as a terms decline — try to address concerns; if they still decline, offer transfer_call. Do NOT proceed to Make Booking until termsAccepted: true is confirmed.'
        };
      }
      if (termsValidation.termsNotAccepted) {
        return {
          success: false,
          paymentCompleted: false,
          termsNotAccepted: true,
          requiresRetry: true,
          paymentMethod: 'balance',
          message: 'The client did not agree with the terms. Try to answer their questions. If they still do not agree, offer transfer to a human agent.',
          instruction: 'Try to address the caller concerns. If they still do not agree, ask if they want to be transferred to a human agent. If yes, use transfer_call.'
        };
      }

      return finalizeBookingUsingCoveredPayment(
        page,
        args,
        sessionState,
        screenshots,
        screenshotsDir,
        progressCallback,
        `Booking completed. The CRM indicated no payment was required — the booking fee was already covered by the client's account credit/balance of GBP ${effectiveBalance.toFixed(2)}.`
      );
    }

    if (
      balanceInfo.hasAvailableBalance &&
      requestedPaymentSource == null &&
      args.deliveryMethod == null
    ) {
      return {
        success: true,
        paymentCompleted: false,
        requiresBalanceDecision: true,
        availableBalance: balanceInfo.availableBalance,
        message: `An available balance of GBP ${balanceInfo.availableBalance.toFixed(2)} was found. Would you like to use this balance for payment, or should I send a payment link by email/SMS?`,
        instruction: 'CRITICAL: Ask the caller in THIS response: "I can see an available balance of GBP ' + balanceInfo.availableBalance.toFixed(2) + '. Would you like to use this balance, or should I send a payment link via email or SMS?" If caller says use balance, call **booking_step_process_payment** again with useAvailableBalance: true (or paymentSource: "balance"). If caller says link/email/sms, call **booking_step_process_payment** again with useAvailableBalance: false (or paymentSource: "payment_request"), then follow normal email/SMS flow.'
      };
    }

    // Caller chose to use available balance: select "No payment required" and finalize booking.
    if (requestedPaymentSource === 'balance') {
      progressCallback?.({ message: 'Applying available balance.' });
      const termsAccepted = args.termsAccepted;

      // Enforce explicit terms confirmation in the balance path too (same policy as payment-link flow).
      const termsValidation = validateTermsAcceptance(termsAccepted);
      if (termsValidation.requiresTermsBeforeSend) {
        const termsText = getTermsText();
        return {
          success: true,
          paymentCompleted: false,
          requiresTermsBeforeSend: true,
          termsText,
          message: `Before I can proceed with completing the booking using your available balance, I must make you aware of the following terms and conditions:\n\n${termsText}`,
          instruction: 'CRITICAL — MANDATORY TERMS STEP: Read the termsText field above word-for-word to the caller (do NOT summarise or paraphrase). After reading, ask exactly: "Do you agree with the statements that I have just made?" Wait for response. If YES: call booking_step_process_payment again with the same parameters plus useAvailableBalance: true and termsAccepted: true. If NO: handle as a terms decline.'
        };
      }
      if (termsValidation.termsNotAccepted) {
        return {
          success: false,
          paymentCompleted: false,
          termsNotAccepted: true,
          requiresRetry: true,
          paymentMethod: 'balance',
          message: 'The client did not agree with the terms. Try to answer their questions. If they still do not agree, offer transfer to a human agent.',
          instruction: 'Try to address the caller concerns. If they still do not agree, ask if they want to be transferred to a human agent. If yes, use transfer_call.'
        };
      }

      return finalizeBookingUsingCoveredPayment(
        page,
        args,
        sessionState,
        screenshots,
        screenshotsDir,
        progressCallback,
        'Booking completed using available balance.'
      );
    }

    // Step 1: Select "Send a payment request" option (updated strategy)
    progressCallback?.({ message: 'Selecting payment option.' });
    const { selectPaymentOption } = await import('../../../commonBookingSteps/selectPaymentOption.js');
    const requestSelectionResult = await selectPaymentOption(page, screenshotsDir, 'request', progressCallback, args.abortSignal);
    if (!requestSelectionResult?.success) {
      // Payment dropdown could not be used — re-check if a real balance/credit exists before
      // assuming payment is covered.  The "Make Booking" button alone is NOT proof of payment;
      // it is always present on the "Confirm and Pay" page.
      const makeBookingVisible = await isMakeBookingButtonVisible(page);
      const reconfirmedBalance = await detectAvailableBalance(page);
      const noPaymentBanner = await detectNoPaymentRequired(page);

      if (makeBookingVisible && (reconfirmedBalance.hasAvailableBalance || noPaymentBanner)) {
        const effectiveBal = reconfirmedBalance.hasAvailableBalance ? reconfirmedBalance.availableBalance : 0;
        console.log(`ℹ️ [PAYMENT] Payment dropdown not available but payment covered (balance: GBP ${effectiveBal.toFixed(2)}, noPaymentBanner: ${noPaymentBanner}) — payment already satisfied`);
        const termsValidation = validateTermsAcceptance(args.termsAccepted);
        if (termsValidation.requiresTermsBeforeSend) {
          const termsText = getTermsText();
          return {
            success: true,
            paymentCompleted: false,
            requiresTermsBeforeSend: true,
            makeBookingReady: true,
            paymentAlreadyCovered: true,
            termsText,
            message:
              `The payment page shows no further payment is required — the booking fee appears already covered (for example, from a previous cancellation refund or account credit${effectiveBal > 0 ? ` of GBP ${effectiveBal.toFixed(2)}` : ''}). Do NOT offer a payment request link. Before completing the booking, read the following terms and conditions word-for-word to the caller:\n\n${termsText}`,
            instruction:
              'CRITICAL — MANDATORY TERMS STEP: Read the termsText field above word-for-word to the caller (do NOT summarise or paraphrase). After reading, ask exactly: "Do you agree with the statements that I have just made?" Wait for the caller\'s answer. If YES: call **booking_step_process_payment** again with courseType, workflowType, **termsAccepted: true**, and **useAvailableBalance: true**. If NO: handle as a terms decline — try to address concerns; if they still decline, offer transfer_call. Do NOT proceed to Make Booking until termsAccepted: true is confirmed.'
          };
        }
        if (termsValidation.termsNotAccepted) {
          return {
            success: false,
            paymentCompleted: false,
            termsNotAccepted: true,
            requiresRetry: true,
            paymentMethod: 'balance',
            message: 'The client did not agree with the terms. Try to answer their questions. If they still do not agree, offer transfer to a human agent.',
            instruction: 'Try to address the caller concerns. If they still do not agree, ask if they want to be transferred to a human agent. If yes, use transfer_call.'
          };
        }
        return finalizeBookingUsingCoveredPayment(
          page,
          args,
          sessionState,
          screenshots,
          screenshotsDir,
          progressCallback,
          'Booking completed. Payment was already satisfied on screen (for example from a previous cancellation refund or account credit); no payment link was required.'
        );
      }

      // No confirmed balance — do NOT assume payment is covered.
      // Return requiresPaymentMethod so the agent asks the caller about email/SMS payment link.
      console.log('⚠️ [PAYMENT] Payment dropdown not available and NO confirmed balance — returning requiresPaymentMethod');
      return {
        success: false,
        paymentCompleted: false,
        requiresPaymentMethod: true,
        canRetry: true,
        error: requestSelectionResult?.error || 'Unable to select payment option. No confirmed balance on account.',
        message: 'Would you like to receive the payment link via email or SMS?',
        instruction: 'CRITICAL: The payment dropdown could not be loaded but no balance/credit was found on the account. Ask the caller: "Would you like to receive the payment link via email or SMS?" When they answer, call **booking_step_send_payment_request** with deliveryMethod: "email" or "sms" (and courseType, workflowType). Do NOT call booking_step_process_payment again.'
      };
    }
    screenshots.push(await (await import('../../../commonBookingSteps/utils.js')).takeScreenshot(page, 'payment-option-selected-request.png', screenshotsDir));

    console.log('🔍 [PAYMENT] Waiting for payment request link page...');
    try {
      await page.waitForSelector('#contactSend3DSecureRequest_iframe', { state: 'attached', timeout: 10000 });
      const paymentRequestIframe = page.frameLocator('#contactSend3DSecureRequest_iframe');
      await paymentRequestIframe.locator('body').first().waitFor({ state: 'attached', timeout: 5000 });
      console.log('✅ [PAYMENT] On payment request link page');
      progressCallback?.({ message: 'Opening the payment request form.' });
      onPaymentRequestPage = true;
    } catch (e) {
      console.warn('⚠️ [PAYMENT] Payment request page not ready after selection - returning retriable error');
      return {
        success: false,
        paymentCompleted: false,
        canRetry: true,
        error: 'Payment request page did not load after selecting "Send a payment request".'
      };
    }
    await page.waitForTimeout(CRM_STABILITY_DELAY_MS);
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
    termsAccepted, // termsAcceptedBeforeSend: undefined = return terms; true = proceed
    progressCallback,
    args.abortSignal
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

/**
 * Complete booking when CRM already shows no further payment due (balance, credit, or prepaid/refund path).
 */
async function finalizeBookingUsingCoveredPayment(
  page,
  args,
  sessionState,
  screenshots,
  screenshotsDir,
  progressCallback,
  completionMessage
) {
  const { selectPaymentOption } = await import('../../../commonBookingSteps/selectPaymentOption.js');
  const { acceptTermsAndMakeBooking } = await import('../../../commonBookingSteps/acceptTermsAndMakeBooking.js');
  const { takeScreenshot } = await import('../../../commonBookingSteps/utils.js');

  const paymentDropdownVisible = await isPaymentDropdownVisible(page);
  if (paymentDropdownVisible) {
    const selectionResult = await selectPaymentOption(page, screenshotsDir, 'none', progressCallback, args.abortSignal);
    if (!selectionResult?.success) {
      return {
        success: false,
        paymentCompleted: false,
        paymentMethod: 'balance',
        canRetry: true,
        error: selectionResult?.error || 'Unable to select "No payment required" on the payment page.'
      };
    }
    screenshots.push(await takeScreenshot(page, 'payment-option-selected-balance.png', screenshotsDir));
    await page.waitForTimeout(CRM_STABILITY_DELAY_MS);
  } else {
    console.log('ℹ️ [PAYMENT] Payment dropdown not visible in covered-payment path - proceeding directly to booking confirmation');
  }

  const bookingResult = await acceptTermsAndMakeBooking(page, screenshotsDir, true, false);
  if (!bookingResult.success) {
    return {
      success: false,
      paymentCompleted: false,
      paymentMethod: 'balance',
      error: bookingResult.error || 'Failed to complete booking using available balance.'
    };
  }

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
    if (!trackingResult.success) {
      console.warn(`⚠️ [PAYMENT] Booking tracking failed (non-critical): ${trackingResult.error}`);
    }
  } catch (trackingError) {
    console.warn(`⚠️ [PAYMENT] Booking tracking error (non-critical):`, trackingError.message);
  }

  return {
    success: true,
    paymentCompleted: true,
    bookingFinalized: true,
    paymentMethod: 'balance',
    message: completionMessage
  };
}

function normalizePaymentSource(args) {
  if (!args || typeof args !== 'object') return null;
  if (args.useAvailableBalance === true) return 'balance';
  if (args.useAvailableBalance === false) return 'payment_request';
  if (typeof args.paymentSource === 'string') {
    const value = args.paymentSource.trim().toLowerCase();
    if (value === 'balance') return 'balance';
    if (value === 'payment_request' || value === 'payment-link' || value === 'payment_link' || value === 'link') return 'payment_request';
  }
  return null;
}

async function isMakeBookingButtonVisible(page) {
  const selectors = [
    '#diaryNewCourseBookingWiz_OKBtn',
    '[aria-label="Make booking"]',
    '[role="button"]:has-text("Make booking")'
  ];
  const contexts = [page, page.frameLocator('#eventNewBooking2_iframe')];
  for (const ctx of contexts) {
    for (const sel of selectors) {
      try {
        const btn = ctx.locator(sel).first();
        if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
          return true;
        }
      } catch (_) { /* ignore */ }
    }
  }
  return false;
}

async function isPaymentDropdownVisible(page) {
  const contexts = [
    page,
    page.frameLocator('#eventNewBooking2_iframe')
  ];
  for (const ctx of contexts) {
    try {
      const dropdown = ctx.locator('[data-onchange="jqx_chgPayWhen"]').first();
      if (await dropdown.count() > 0) {
        const isVisible = await dropdown.isVisible().catch(() => false);
        if (isVisible) return true;
      }
    } catch (_) {
      // ignore and continue
    }
  }
  return false;
}

export function extractAvailableBalanceFromText(text) {
  if (!text || typeof text !== 'string') {
    return { hasAvailableBalance: false, availableBalance: 0, evidenceLine: null };
  }

  // --- TARGETED extraction for CRM "Balance £X in credit" pattern ---
  // This runs FIRST because the CRM financial summary may appear as a single
  // concatenated line (no newlines).  The generic scan would pick the first £
  // amount on the line (e.g. "Money owed £839") instead of the correct one
  // ("Balance £170 in credit").  The targeted regex captures the amount
  // immediately preceding "in credit".
  const inCreditMatch = text.match(/balance\s+(£\s*\d+(?:,\d{3})*(?:\.\d{1,2})?)\s+in\s+credit/i);
  if (inCreditMatch) {
    const raw = inCreditMatch[1].replace(/[^\d.]/g, '');
    const value = Number.parseFloat(raw);
    if (Number.isFinite(value) && value > 0) {
      return { hasAvailableBalance: true, availableBalance: value, evidenceLine: inCreditMatch[0] };
    }
  }

  // --- Generic line-by-line scan for other credit patterns ---
  const positiveCreditRegex = /(?:available\s+balance|account\s+credit|credit\s+balance|credit\s+on\s+account|unapplied\s+credit|customer\s+credit|wallet\s+credit|credit\s+available|available\s+credit|overpayment\s+credit|on\s+account\s+credit)/i;
  const nonCreditBalanceRegex = /(?:balance\s+due|amount\s+due|to\s+pay|payable|grand\s+total|sub\s*total|total\s+due|cost\s+per\s+space|money\s+owed|money\s+paid)/i;
  const amountRegex = /(£\s*-?\d+(?:,\d{3})*(?:\.\d{1,2})?)|(-?\d+(?:,\d{3})*(?:\.\d{1,2})?\s*£)/i;

  if (!positiveCreditRegex.test(text)) {
    return { hasAvailableBalance: false, availableBalance: 0, evidenceLine: null };
  }

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!positiveCreditRegex.test(line)) continue;
    if (nonCreditBalanceRegex.test(line)) continue;

    const amountLineCandidates = [line, lines[i + 1] || ''];
    for (const amountLine of amountLineCandidates) {
      if (nonCreditBalanceRegex.test(amountLine)) continue;
      const amountMatch = amountLine.match(amountRegex);
      if (!amountMatch) continue;
      const raw = (amountMatch[1] || amountMatch[2] || '').replace(/[^\d.-]/g, '');
      const value = Number.parseFloat(raw);
      if (Number.isFinite(value) && value > 0) {
        return { hasAvailableBalance: true, availableBalance: value, evidenceLine: line };
      }
    }
  }

  return { hasAvailableBalance: false, availableBalance: 0, evidenceLine: null };
}

async function detectAvailableBalance(page) {
  // Only scan the main page and the booking iframe.  Do NOT scan contactEdit_iframe
  // because it shows the client's overall profile and may contain stale financial
  // data from before the current booking was added (e.g. "Balance £170 in credit"
  // when the booking iframe already shows "Balance £35" owed).
  const candidates = [
    page,
    page.frameLocator('#eventNewBooking2_iframe')
  ];
  const scopeNames = ['main_page', 'eventNewBooking2_iframe'];
  const scannedSnippets = [];

  for (let idx = 0; idx < candidates.length; idx += 1) {
    const scope = candidates[idx];
    try {
      const body = scope.locator('body').first();
      await body.waitFor({ state: 'attached', timeout: 1200 });
      const text = await body.innerText({ timeout: 1200 });
      const snippet = (text || '').substring(0, 300).replace(/\s+/g, ' ').trim();
      scannedSnippets.push(`[${scopeNames[idx]}] ${snippet}`);
      const parsed = extractAvailableBalanceFromText(text);
      if (parsed.hasAvailableBalance) {
        console.log(`✅ [PAYMENT] Available balance detected in ${scopeNames[idx]}: GBP ${parsed.availableBalance.toFixed(2)}; evidence="${parsed.evidenceLine}"`);
        return { hasAvailableBalance: true, availableBalance: parsed.availableBalance };
      }
    } catch (_) {
      scannedSnippets.push(`[${scopeNames[idx]}] (not attached / timed out)`);
    }
  }

  console.log(`ℹ️ [PAYMENT] No available balance/credit detected. Scanned text snippets:\n${scannedSnippets.join('\n')}`);
  return { hasAvailableBalance: false, availableBalance: 0 };
}

/**
 * Detect the CRM "no payment required" banner.
 * When a client has sufficient credit/balance the CRM hides the payment dropdown
 * entirely and shows a green info banner reading "There is no need to take a payment".
 * Returns true if that banner text is found in any accessible frame.
 */
async function detectNoPaymentRequired(page) {
  const noPaymentPatterns = [
    /no\s+need\s+to\s+take\s+a\s+payment/i,
    /no\s+payment\s+required/i,
    /no\s+payment\s+is\s+required/i,
    /payment\s+is\s+not\s+required/i
  ];

  const scopes = [
    page,
    page.frameLocator('#eventNewBooking2_iframe')
  ];
  const scopeNames = ['main_page', 'eventNewBooking2_iframe'];

  for (let idx = 0; idx < scopes.length; idx += 1) {
    try {
      const body = scopes[idx].locator('body').first();
      await body.waitFor({ state: 'attached', timeout: 1500 });
      const text = await body.innerText({ timeout: 2000 });
      if (!text) continue;
      for (const pattern of noPaymentPatterns) {
        if (pattern.test(text)) {
          console.log(`✅ [PAYMENT] "No payment required" banner detected in ${scopeNames[idx]} (matched: ${pattern})`);
          return true;
        }
      }
    } catch (_) {
      // scope not accessible — skip
    }
  }
  return false;
}
