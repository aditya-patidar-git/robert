/**
 * New Client Flow
 * Handles filling contact details for new clients
 * Preserves all Playwright timing and state checks
 * Uses same required-fields check as existing client (only ask for configured must-details).
 */

import * as commonSteps from '../../../../commonBookingSteps/index.js';

/**
 * Execute new client fill contact details flow
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<Object>} Step execution result
 */
export async function executeNewClientFlow(page, args, sessionState, screenshotsDir) {
  // New client: fill all fields from scratch
  const addressConfirmed = args.addressConfirmed || false;
  const correctedAddress = args.correctedAddress || null;

  const fillResult = await commonSteps.fillContactDetails(page, {
    title: args.title,
    firstNames: args.firstNames || args.customerName?.split(' ')[0],
    surname: args.surname || args.customerName?.split(' ').slice(1).join(' '),
    mobileNumber: args.customerMobile || args.customerPhone,
    email: args.customerEmail,
    dateOfBirth: args.dateOfBirth,
    postcode: args.postcode,
    houseNumberOrName: args.houseNumber,
    licenceHeld: args.licenceHeld,
    nationalInsuranceNumber: args.nationalInsurance,
    drivingLicenceNumber: args.drivingLicenceNumber,
    licenceFormat: args.licenceFormat || 'GB',
    hearAboutUs: args.hearAboutUs,
    ridingExperience: args.ridingExperience,
    marketingConsent: args.marketingConsent,
    dataSharing: args.dataSharing,
    correctedAddress: correctedAddress
  }, screenshotsDir, addressConfirmed);

  // Check if address confirmation is required
  if (fillResult && fillResult.requiresAddressConfirmation) {
    return {
      success: true,
      requiresAddressConfirmation: true,
      autoPopulatedAddress: fillResult.autoPopulatedAddress,
      townCity: fillResult.townCity,
      message: fillResult.message
    };
  }

  // Same required-fields check as existing client: only check/request configured must-details
  const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
  if (eventBookingIframeExists) {
    await page.waitForTimeout(2000);

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

    const eventBookingIframe = page.frameLocator('#eventNewBooking2_iframe');
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
        console.warn(`⚠️ [STEP 7] Could not check ${field.label}:`, error.message);
      }
    }

    if (missingFields.length > 0) {
      const paramNames = missingFields.map(f => f.paramName);
      const labelsList = missingFields.map(f => f.labelShort).join(', ');
      const message = `I need your ${labelsList}; could you please provide them?`;
      const instruction = `Collect ONLY these missing details from the caller. Ask the caller to REPEAT each missing detail so you can confirm you have it correct before calling the tool again. Do NOT read back or repeat the caller's personal details on the call (GDPR). When you have confirmed values for all of: ${paramNames.join(', ')}, call booking_step_fill_contact_details ONCE with those parameters.`;
      console.log(`⚠️ [STEP 7] Missing required fields (${missingFields.length}): ${paramNames.join(', ')}`);
      return {
        success: true,
        missingFields: paramNames,
        message,
        question: message,
        instruction
      };
    }
  }

  return {
    success: true,
    contactDetailsFilled: true,
    stepCompleted: 7, // Explicitly state which step is complete (for new clients, this is Step 7)
    stepName: 'fill_contact_details', // Explicit step name
    nextStep: 'booking_step_process_payment', // Explicitly state next step tool to call
    nextStepNumber: 8, // Explicitly state next step number (for new clients, payment is Step 8)
    doNotRetry: true, // Explicitly prevent retry
    message: `✅ STEP 7 COMPLETE: booking_step_fill_contact_details has been successfully completed. Contact details form filled successfully. DO NOT RETRY THIS STEP. IMMEDIATELY proceed to STEP 8 by calling booking_step_process_payment tool.`
  };
}
