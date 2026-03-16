/**
 * Existing Client Flow
 * Handles filling contact details for existing clients
 * Preserves all Playwright timing and state checks
 * Applies UK format normalization for postcode, mobile, email, NI number, and driving licence when filling.
 */

import * as commonSteps from '../../../../commonBookingSteps/index.js';
import { cleanEmail } from '../../../../commonBookingSteps/utils.js';
import { normalizeUKMobile } from '../../../../mobileSearchService.js';
import { validateEmail } from './validators.js';
import { formatPostcode, formatNationalInsurance, formatDrivingLicenceNumber, validateNationalInsurance, validateDrivingLicenceNumber, validateDrivingLicenceFirstHalf, validateDrivingLicenceSecondHalf } from '../../../../../utils/britishFormatting.js';

/**
 * Get client email from various sources
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @returns {Promise<string|null>} Client email or null
 */
async function getClientEmail(args, sessionState) {
  let clientEmail = args.customerEmail || args.clientDetails?.email || sessionState?.clientDetails?.email;

  // FIX 1: Check conversation state for email (from clientVerification/search_client)
  if (!clientEmail) {
    // Extract callSid from sessionState to access conversation state
    let callSid = args.callSid || null;
    if (!callSid && sessionState?.browserSessionId) {
      const match = sessionState.browserSessionId.match(/^browser_(.+?)_\d+$/);
      if (match) {
        callSid = match[1];
      }
    }

    if (callSid) {
      const { conversations } = await import('../../../../../shared/state.js');
      const conversation = conversations[callSid];

      if (conversation?.clientDetails?.email) {
        clientEmail = conversation.clientDetails.email;
        console.log(`✅ [STEP 8] Using email from conversation state (clientVerification/search_client): ${clientEmail}`);
      }
    }
  }

  return clientEmail;
}

/**
 * Execute existing client fill contact details flow
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
export async function executeExistingClientFlow(page, args, sessionState, screenshotsDir, progressCallback = null) {
  progressCallback?.({ message: 'Filling in your details.' });
  // Existing client: use lookupContactAndWait to fill missing fields
  let clientEmail = await getClientEmail(args, sessionState);

  // CRITICAL: Validate email - reject example/test emails
  if (clientEmail) {
    validateEmail(clientEmail);
  }

  if (!clientEmail) {
    throw new Error('Client email is required for contact lookup (existing client workflow). Email must come from booking_step_search_client result or be provided by the caller.');
  }

  const addressConfirmed = args.addressConfirmed || false;
  const correctedAddress = args.correctedAddress || null;
  const clientPostcode = args.postcode || args.clientDetails?.postcode || sessionState?.clientDetails?.postcode;

  // If address is already confirmed, skip lookup and just click Next
  if (addressConfirmed) {
    // Client is already selected, just handle address correction if needed and click Next
    const eventBookingIframe = page.frameLocator('#eventNewBooking2_iframe');
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;

    if (eventBookingIframeExists && correctedAddress) {
      // Update address if corrected
      console.log(`📝 [STEP 8] Updating Address 1 with corrected address: ${correctedAddress}`);
      let address1Field = eventBookingIframe.getByLabel('Address 1');
      if (await address1Field.count() === 0) {
        address1Field = eventBookingIframe.locator('#cmp_address_1 .dx-texteditor-input');
      }
      if (await address1Field.count() > 0) {
        await address1Field.fill(correctedAddress);
        await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);
      }
    }

    // Click Next button (lookupContactAndWait will detect we're already on the page and just click Next)
    await commonSteps.lookupContactAndWait(page, clientEmail, 'email', screenshotsDir, clientPostcode, false);
  } else {
    // FIX 3: First call lookupContactAndWait to get to the client details page (skip Next click)
    // The Contact choice page should be traversed automatically without any questions
    await commonSteps.lookupContactAndWait(page, clientEmail, 'email', screenshotsDir, clientPostcode, true);

    await page.waitForSelector('#eventNewBooking2_iframe', { state: 'attached', timeout: 10000 });
    const eventBookingIframe = page.frameLocator('#eventNewBooking2_iframe');
    await eventBookingIframe.locator('text=First Names, text=Surname, text=Contact e-mail').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;

    // CRITICAL: Verify we're on client details page (not Contact choice page)
    // Check for specific indicators that we're on the client details page
    let isOnClientDetailsPage = false;
    if (eventBookingIframeExists) {
      try {
        // Check for client details page indicators
        const clientDetailsIndicators = [
          'text=First Names',
          'text=Surname',
          'text=Contact e-mail',
          'text=Contact mobile number',
          'text=Post Code',
          'text=House number or name'
        ];

        for (const indicator of clientDetailsIndicators) {
          const element = eventBookingIframe.locator(indicator).first();
          if (await element.count() > 0) {
            const isVisible = await element.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [STEP 8] Confirmed on client details page - found indicator: ${indicator}`);
              isOnClientDetailsPage = true;
              break;
            }
          }
        }

        // Also check if we're still on Contact choice page (should NOT be)
        const contactChoiceIndicators = [
          'text=Contact choice',
          'text=Choose one of these options',
          '#btnBookExisting' // Lookup contact button
        ];

        let stillOnContactChoicePage = false;
        for (const indicator of contactChoiceIndicators) {
          const element = eventBookingIframe.locator(indicator).first();
          if (await element.count() > 0) {
            const isVisible = await element.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`⚠️ [STEP 8] Still on Contact choice page - found indicator: ${indicator}`);
              stillOnContactChoicePage = true;
              break;
            }
          }
        }

        if (stillOnContactChoicePage) {
          console.log('⚠️ [STEP 8] Still on Contact choice page - cannot check for missing fields yet');
          // Don't check for missing fields - we're not on the client details page yet
          // The Contact choice page should be traversed automatically based on workflowType
          // Just proceed to click Next or continue the flow
          await commonSteps.lookupContactAndWait(page, clientEmail, 'email', screenshotsDir, clientPostcode, false);
          await eventBookingIframe.locator('text=First Names, text=Surname').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);
          // Re-check if we're on client details page now
          isOnClientDetailsPage = false;
          for (const indicator of clientDetailsIndicators) {
            const element = eventBookingIframe.locator(indicator).first();
            if (await element.count() > 0) {
              const isVisible = await element.isVisible().catch(() => false);
              if (isVisible) {
                isOnClientDetailsPage = true;
                break;
              }
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ [STEP 8] Error checking page state:`, error.message);
        // If we can't determine the page, assume we're on client details page and proceed
        isOnClientDetailsPage = true;
      }
    }

    if (isOnClientDetailsPage && eventBookingIframeExists) {
      await page.waitForTimeout(200); // CRM stability before field checks
      // Required fields to check and request when missing (no extra fields beyond this list).
      const REQUIRED_PARAM_NAMES = ['customerEmail', 'customerMobile', 'postcode', 'houseNumber', 'licenceHeld', 'nationalInsurance', 'drivingLicenceNumber'];

      const fieldOrder = [
        { label: 'Contact e-mail', id: 'cnt_email', name: 'email', paramName: 'customerEmail', labelShort: 'email address' },
        { label: 'Contact mobile number', id: 'cnt_mobile_number', name: 'mobileNumber', paramName: 'customerMobile', labelShort: 'mobile number' },
        { label: 'Post Code', id: 'cmp_post_code', name: 'postcode', paramName: 'postcode', labelShort: 'postcode' },
        { label: 'House number or name', id: 'cmp_buildingnumber', name: 'houseNumber', paramName: 'houseNumber', labelShort: 'house number or name' },
        { label: 'Licence held', id: 'xid_29019', name: 'licenceHeld', paramName: 'licenceHeld', labelShort: 'licence held type' },
        { label: 'National Insurance number', id: 'cnt_NI_number', name: 'nationalInsuranceNumber', paramName: 'nationalInsurance', labelShort: 'National Insurance number' },
        { label: 'Driving licence number', id: 'cnt_driving_licence_no', name: 'drivingLicenceNumber', paramName: 'drivingLicenceNumber', labelShort: 'driving licence number' }
      ];

      // Fill all provided args first (so one tool call with all params fills everything, then we re-scan)
      // Apply UK normalization so the form receives valid values (same as new client flow).

      // Fill email if provided (normalized)
      if (args.customerEmail) {
        const emailFormatted = cleanEmail(args.customerEmail) || String(args.customerEmail).trim();
        if (emailFormatted) {
          const emailField = eventBookingIframe.getByLabel('Contact e-mail');
          if (await emailField.count() > 0) {
            const currentEmail = await emailField.inputValue().catch(() => '');
            if (!currentEmail || currentEmail.trim() === '') {
              console.log(`📝 [STEP 8] Filling Contact e-mail: ${emailFormatted}`);
              await emailField.fill(emailFormatted);
              await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);
            }
          }
        }
      }

      // Fill mobile number if provided (UK format: 07 + 9 digits)
      if (args.customerMobile) {
        const mobileFormatted = normalizeUKMobile(args.customerMobile) || String(args.customerMobile).trim();
        if (mobileFormatted) {
          const mobileField = eventBookingIframe.getByLabel('Contact mobile number');
          if (await mobileField.count() === 0) {
            const mobileFieldAlt = eventBookingIframe.locator('#cnt_mobile_number .dx-texteditor-input');
            if (await mobileFieldAlt.count() > 0) {
              const currentMobile = await mobileFieldAlt.inputValue().catch(() => '');
              if (!currentMobile || currentMobile.trim() === '') {
                console.log(`📝 [STEP 8] Filling Contact mobile number: ${mobileFormatted}`);
                await mobileFieldAlt.fill(mobileFormatted);
                await page.waitForTimeout(200); // CRM input stability
              }
            }
          } else {
            const currentMobile = await mobileField.inputValue().catch(() => '');
            if (!currentMobile || currentMobile.trim() === '') {
              console.log(`📝 [STEP 8] Filling Contact mobile number: ${mobileFormatted}`);
              await mobileField.fill(mobileFormatted);
              await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);
            }
          }
        }
      }

      // Fill postcode if provided (UK format: space before last 3 chars)
      if (args.postcode) {
        const postcodeFormatted = formatPostcode(args.postcode);
        if (postcodeFormatted) {
          const postcodeField = eventBookingIframe.getByLabel('Post Code');
          if (await postcodeField.count() > 0) {
            const currentPostcode = await postcodeField.inputValue().catch(() => '');
            if (!currentPostcode || currentPostcode.trim() === '') {
              console.log(`📝 [STEP 8] Filling Post Code: ${postcodeFormatted}`);
              await postcodeField.fill(postcodeFormatted);
              await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);
            }
          }
        }
      }

      // Fill house number and handle address confirmation
      const houseNumber = args.houseNumber || args.houseNumberOrName;
      let houseNumberField = eventBookingIframe.getByLabel('House number or name');
      if (await houseNumberField.count() === 0) {
        houseNumberField = eventBookingIframe.locator('#cmp_buildingnumber .dx-texteditor-input');
      }
      if (await houseNumberField.count() === 0) {
        houseNumberField = eventBookingIframe.locator('#cmp_buildingnumber');
      }

      if (await houseNumberField.count() > 0) {
        const houseNumberValue = await houseNumberField.inputValue().catch(() => '');
        if (!houseNumberValue || houseNumberValue.trim() === '') {
          if (houseNumber) {
            console.log(`📝 [STEP 8] Filling House number or name: ${houseNumber}`);
            await houseNumberField.fill(houseNumber);
            await houseNumberField.press('Tab');
            await eventBookingIframe.locator('#cmp_address_1 .dx-texteditor-input, [id*="address"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);

            // Check for auto-populated address
            let address1Field = eventBookingIframe.getByLabel('Address 1');
            if (await address1Field.count() === 0) {
              address1Field = eventBookingIframe.locator('#cmp_address_1 .dx-texteditor-input');
            }

            if (await address1Field.count() > 0) {
              const autoPopulatedAddress = await address1Field.inputValue();
              if (autoPopulatedAddress && autoPopulatedAddress.trim() !== '') {
                // Return requiresAddressConfirmation to verify address with client
                return {
                  success: true,
                  requiresAddressConfirmation: true,
                  autoPopulatedAddress: autoPopulatedAddress,
                  message: 'Can you confirm the first line of your address is correct?',
                  instruction: 'Ask the caller to confirm the first line of their address is correct. Do NOT say or read the address aloud (GDPR). If they say yes, call booking_step_fill_contact_details again with addressConfirmed: true. If no, ask them to tell you the correct first line, then call the tool again with correctedAddress set to what they said.'
                };
              }
            }
          }
        }
      }

      // Driving licence: only first half provided — validate and ask for second half
      if (args.drivingLicenceFirstHalf && !args.drivingLicenceSecondHalf && !args.drivingLicenceNumber) {
        const r = validateDrivingLicenceFirstHalf(args.drivingLicenceFirstHalf);
        if (!r.valid) {
          return { success: true, invalidFormat: true, invalidFields: { drivingLicenceFirstHalf: r.message }, instruction: 'Ask for the first half again, then call with drivingLicenceFirstHalf only.' };
        }
        const instruction = 'Ask for the second half of the driving licence (7 or 8 characters; no spaces). Then call booking_step_fill_contact_details again with the same drivingLicenceFirstHalf and the new drivingLicenceSecondHalf. Do not ask the caller to repeat the full number.';
        console.log(`⚠️ [STEP 8] Driving licence first half valid — need second half`);
        return { success: true, requiresDrivingLicenceSecondHalf: true, drivingLicenceFirstHalf: r.formatted, instruction };
      }

      // Driving licence: both halves provided — validate both, concatenate
      let effectiveDrivingLicenceNumber = undefined;
      if (args.drivingLicenceFirstHalf && args.drivingLicenceSecondHalf && !args.drivingLicenceNumber) {
        const r1 = validateDrivingLicenceFirstHalf(args.drivingLicenceFirstHalf);
        const r2 = validateDrivingLicenceSecondHalf(args.drivingLicenceSecondHalf);
        if (!r1.valid) {
          return { success: true, invalidFormat: true, invalidFields: { drivingLicenceFirstHalf: r1.message }, instruction: 'Ask for the first half again, then call with both halves.' };
        }
        if (!r2.valid) {
          return { success: true, invalidFormat: true, invalidFields: { drivingLicenceSecondHalf: r2.message }, instruction: 'Ask for the second half again, then call with both halves.' };
        }
        effectiveDrivingLicenceNumber = (r1.formatted || '') + (r2.formatted || '');
      }

      // Validate UK format for NI and full driving licence before filling; return invalidFormat so agent re-asks with correct format
      const invalidFields = {};
      if (args.nationalInsurance) {
        const r = validateNationalInsurance(args.nationalInsurance);
        if (!r.valid) invalidFields.nationalInsurance = r.message;
      }
      if (args.drivingLicenceNumber && effectiveDrivingLicenceNumber === undefined) {
        const r = validateDrivingLicenceNumber(args.drivingLicenceNumber);
        if (!r.valid) invalidFields.drivingLicenceNumber = r.message;
      }
      if (Object.keys(invalidFields).length > 0) {
        const instruction = 'One or more details were in the wrong UK format. Ask the caller to provide again the following, using the correct format (do not recite their value back). Then call booking_step_fill_contact_details again with the corrected values.';
        console.log(`⚠️ [STEP 8] UK format validation failed: ${Object.keys(invalidFields).join(', ')}`);
        return { success: true, invalidFormat: true, invalidFields, instruction };
      }

      // Fill National Insurance if provided (optional; never asked as missing). UK format: 2 letters, 6 digits, 1 letter.
      if (args.nationalInsurance) {
        const niFormatted = formatNationalInsurance(args.nationalInsurance);
        let niField = eventBookingIframe.getByLabel('National Insurance number');
        if (await niField.count() === 0) niField = eventBookingIframe.locator('#cnt_NI_number .dx-texteditor-input');
        if (await niField.count() === 0) niField = eventBookingIframe.locator('#cnt_NI_number');
        if (await niField.count() > 0) {
          const currentNI = await niField.inputValue().catch(() => '');
          if (!currentNI || currentNI.trim() === '') {
            console.log(`📝 [STEP 8] Filling National Insurance number: ${niFormatted}`);
            await niField.fill(niFormatted);
            await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);
          }
        }
      }

      // Fill Driving Licence Number if provided (from full number or from two validated halves). UK format: no spaces.
      const dlToFill = effectiveDrivingLicenceNumber !== undefined ? effectiveDrivingLicenceNumber : args.drivingLicenceNumber;
      if (dlToFill) {
        const dlFormatted = formatDrivingLicenceNumber(dlToFill);
        let dlField = eventBookingIframe.getByLabel('Driving licence number');
        if (await dlField.count() === 0) dlField = eventBookingIframe.locator('#cnt_driving_licence_no .dx-texteditor-input');
        if (await dlField.count() === 0) dlField = eventBookingIframe.locator('#cnt_driving_licence_no');
        if (await dlField.count() > 0) {
          const currentDL = await dlField.inputValue().catch(() => '');
          if (!currentDL || currentDL.trim() === '') {
            console.log(`📝 [STEP 8] Filling Driving licence number: ${dlFormatted}`);
            await dlField.fill(dlFormatted);
            await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);
          }
        }
      }

      // Fill Licence Held if provided (dropdown)
      if (args.licenceHeld) {
        await commonSteps.fillContactDetails(page, { licenceHeld: args.licenceHeld }, screenshotsDir, true);
        await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);
      }

      if (args.hearAboutUs) {
        console.log(`📝 [STEP 8] Selecting Hear about us?: ${args.hearAboutUs}`);
        await commonSteps.fillContactDetails(page, { hearAboutUs: args.hearAboutUs }, screenshotsDir, true);
        await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);
      }

      if (args.ridingExperience) {
        console.log(`📝 [STEP 8] Selecting riding experience: ${args.ridingExperience}`);
        await commonSteps.fillContactDetails(page, { ridingExperience: args.ridingExperience }, screenshotsDir, true);
        await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);
      }

      if (args.marketingConsent !== undefined) {
        console.log(`📝 [STEP 8] Selecting Marketing consent: ${args.marketingConsent}`);
        await commonSteps.fillContactDetails(page, { marketingConsent: args.marketingConsent }, screenshotsDir, true);
        await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);
      }

      if (args.dataSharing !== undefined) {
        console.log(`📝 [STEP 8] Selecting Data sharing: ${args.dataSharing}`);
        await commonSteps.fillContactDetails(page, { dataSharing: args.dataSharing }, screenshotsDir, true);
        await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);
      }

      // Build missing list only for must-details (REQUIRED_PARAM_NAMES); never ask for optional fields
      const missingFields = [];
      for (const field of fieldOrder) {
        if (!REQUIRED_PARAM_NAMES.includes(field.paramName)) continue;
        try {
          let fieldLocator = eventBookingIframe.getByLabel(field.label);
          if (await fieldLocator.count() === 0) {
            fieldLocator = eventBookingIframe.locator(`#${field.id} .dx-texteditor-input`);
          }
          if (await fieldLocator.count() === 0) {
            fieldLocator = eventBookingIframe.locator(`#${field.id}`);
          }
          if (await fieldLocator.count() > 0) {
            let currentValue = '';
            if (['licenceHeld', 'hearAboutUs', 'ridingExperience', 'marketingConsent', 'dataSharing'].includes(field.name)) {
              // DevExpress dropdowns: displayed value is in .dx-texteditor-input; read from inner input first
              const inputLocator = eventBookingIframe.locator(`#${field.id} .dx-texteditor-input`);
              if (await inputLocator.count() > 0) {
                currentValue = await inputLocator.inputValue().catch(() => '');
              }
              if (!currentValue || currentValue.trim() === '') {
                currentValue = await fieldLocator.evaluate(el => {
                  if (el.tagName === 'SELECT') return el.value || '';
                  const input = el.querySelector && el.querySelector('.dx-texteditor-input');
                  if (input && input.value) return input.value.trim();
                  const text = el.textContent?.trim() || '';
                  if (text === 'Select...' || text === '') return '';
                  return text;
                }).catch(() => '');
              }
            } else {
              currentValue = await fieldLocator.inputValue().catch(() => '');
            }
            if (!currentValue || currentValue.trim() === '') {
              missingFields.push(field);
            }
          }
        } catch (error) {
          console.warn(`⚠️ [STEP 8] Could not check ${field.label}:`, error.message);
        }
      }

      // If "Licence held" is "No licence", driving licence number is optional (DVLA check on the day).
      // If "Licence held" is blank, require both licence type and driving licence number.
      let licenceHeldValue = '';
      try {
        const licenceHeldInput = eventBookingIframe.locator('#xid_29019 .dx-texteditor-input');
        if (await licenceHeldInput.count() > 0) {
          licenceHeldValue = (await licenceHeldInput.inputValue().catch(() => '') || '').trim();
        }
        if (!licenceHeldValue) {
          licenceHeldValue = await eventBookingIframe.locator('#xid_29019').evaluate(el => {
            const input = el.querySelector && el.querySelector('.dx-texteditor-input');
            if (input && input.value) return input.value.trim();
            const text = el.textContent?.trim() || '';
            return (text === 'Select...' || text === '') ? '' : text;
          }).catch(() => '');
        }
      } catch (_) {}
      const isNoLicence = /no\s*licen[sc]e/i.test(licenceHeldValue || '');
      if (isNoLicence) {
        const drivingLicenceIndex = missingFields.findIndex(f => f.paramName === 'drivingLicenceNumber');
        if (drivingLicenceIndex !== -1) {
          missingFields.splice(drivingLicenceIndex, 1);
          console.log('📝 [STEP 8] Licence held is "No licence" – driving licence number not required');
        }
      }

      if (missingFields.length > 0) {
        const paramNames = missingFields.map(f => f.paramName);
        const labelsList = missingFields.map(f => f.labelShort).join(', ');
        const message = `I need your ${labelsList}; could you please provide them?`;
        const instruction = `Collect ONLY these missing details from the caller. For each detail use a two-step pattern: (1) ask for the detail; (2) when the caller gives it, your NEXT turn MUST be to ask them to repeat that same detail to cross-verify (e.g. "Could you please repeat that so I can confirm I have it correct?"). Only after they repeat, ask for the next detail. Exception: for driving licence number you may collect in two halves—ask for the first half only (8 characters), call with drivingLicenceFirstHalf; when the tool returns requiresDrivingLicenceSecondHalf, ask for the second half and call again with both drivingLicenceFirstHalf and drivingLicenceSecondHalf; you do NOT need to ask the caller to repeat the full number when collected in two halves. Do NOT move to the next question until the current one has been repeated and verified. STRICTLY (GDPR): Never say the caller's postcode, address, name, phone number, email, NI number, or any other personal detail aloud. Do not say "X is confirmed" or recite the value to confirm—ask them to repeat it; do not recite it yourself. When you have confirmed values for all of: ${paramNames.join(', ')}, call booking_step_fill_contact_details ONCE with those parameters (or drivingLicenceFirstHalf then both halves for driving licence).`;
        console.log(`⚠️ [STEP 8] Missing required fields (${missingFields.length}): ${paramNames.join(', ')}`);
        return {
          success: true,
          missingFields: paramNames,
          message,
          question: message,
          instruction
        };
      }
    } else {
      // Not on client details page yet - just proceed without checking missing fields
      console.log('⚠️ [STEP 8] Not on client details page yet - skipping missing fields check');
    }

    // After handling missing fields (if any were provided), click Next
    progressCallback?.({ message: 'Saving your details.' });
    await commonSteps.lookupContactAndWait(page, clientEmail, 'email', screenshotsDir, clientPostcode, false, true, progressCallback);

    await page.waitForSelector('#contactSend3DSecureRequest_iframe, #eventNewBooking2_iframe', { state: 'attached', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);

    // Check if we're on payment page
    const paymentPageIndicators = [
      '#contactSend3DSecureRequest_iframe', // Payment request page
      'text=Payment', // Payment page header
      'text=Send a payment request', // Payment option
      '[aria-label*="payment" i]' // Payment-related elements
    ];

    let onPaymentPage = false;
    for (const indicator of paymentPageIndicators) {
      try {
        const element = page.locator(indicator).first();
        if (await element.count() > 0) {
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [STEP 8] Detected payment page: ${indicator}`);
            onPaymentPage = true;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    // Also check if we're still on client details page (Next button might be hidden)
    const stillOnClientDetailsPage = await page.locator('#eventNewBooking2_iframe').count() > 0;
    const nextButtonStillVisible = stillOnClientDetailsPage ? await page.frameLocator('#eventNewBooking2_iframe').locator('#diaryNewCourseBookingWiz_nextBtn').isVisible().catch(() => false) : false;

    if (onPaymentPage) {
      return {
        success: true,
        contactDetailsFilled: true,
        clientFound: true,
        clientSelected: true,
        clientDetailsPageLoaded: true,
        nextButtonClicked: true,
        onPaymentPage: true, // NEW: Indicate we're on payment page
        stepCompleted: 8,
        stepName: 'fill_contact_details',
        nextStep: 'booking_step_process_payment',
        nextStepNumber: 9,
        doNotRetry: true, // CRITICAL: Prevent retries
        message: `✅ STEP 8 COMPLETE: We are now on the payment page. Proceed to STEP 9 by calling booking_step_process_payment tool.`
      };
    } else if (!stillOnClientDetailsPage || !nextButtonStillVisible) {
      // We've navigated away from client details page
      return {
        success: true,
        contactDetailsFilled: true,
        clientFound: true,
        clientSelected: true,
        clientDetailsPageLoaded: true,
        nextButtonClicked: true,
        stepCompleted: 8,
        stepName: 'fill_contact_details',
        nextStep: 'booking_step_process_payment',
        nextStepNumber: 9,
        doNotRetry: true, // CRITICAL: Prevent retries
        message: `✅ STEP 8 COMPLETE: Client details page completed and navigated to next step. Proceed to STEP 9 by calling booking_step_process_payment tool.`
      };
    }
  }

  return {
    success: true,
    contactDetailsFilled: true,
    clientFound: true,
    clientSelected: true,
    clientDetailsPageLoaded: true,
    nextButtonClicked: true,
    stepCompleted: 8,
    stepName: 'fill_contact_details',
    nextStep: 'booking_step_process_payment',
    nextStepNumber: 9,
    doNotRetry: true, // CRITICAL: Prevent retries
    message: `✅ STEP 8 COMPLETE: booking_step_fill_contact_details has been successfully completed. Client ${clientEmail} was found, selected, and Next button clicked. Proceed to STEP 9 by calling booking_step_process_payment tool.`
  };
}
