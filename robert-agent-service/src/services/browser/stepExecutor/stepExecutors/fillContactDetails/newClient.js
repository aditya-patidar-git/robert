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
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
const REQUIRED_PARAM_NAMES = ['customerEmail', 'customerMobile', 'postcode', 'houseNumber', 'licenceHeld', 'nationalInsurance', 'drivingLicenceNumber'];
const FIELD_LABELS_SHORT = {
  customerEmail: 'email address',
  customerMobile: 'mobile number',
  postcode: 'postcode',
  houseNumber: 'house number or name',
  licenceHeld: 'licence held type',
  nationalInsurance: 'National Insurance number',
  drivingLicenceNumber: 'driving licence number'
};

function getArgValue(args, paramName) {
  const map = {
    customerEmail: () => args.customerEmail,
    customerMobile: () => args.customerMobile || args.customerPhone,
    postcode: () => args.postcode,
    houseNumber: () => args.houseNumber,
    licenceHeld: () => args.licenceHeld,
    nationalInsurance: () => args.nationalInsurance,
    drivingLicenceNumber: () => args.drivingLicenceNumber
  };
  const v = map[paramName] ? map[paramName]() : undefined;
  return (v != null && String(v).trim() !== '') ? String(v).trim() : '';
}

export async function executeNewClientFlow(page, args, sessionState, screenshotsDir, progressCallback = null) {
  progressCallback?.({ message: 'Filling in your details.' });
  const addressConfirmed = args.addressConfirmed || false;
  const correctedAddress = args.correctedAddress || null;

  // Compute missing required fields from args BEFORE filling/clicking Next—only click Next when all required are present
  const missingFromArgs = REQUIRED_PARAM_NAMES.filter(p => !getArgValue(args, p));
  const skipNextClick = missingFromArgs.length > 0;

  const contactDetails = {
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
  };

  const fillResult = await commonSteps.fillContactDetails(page, contactDetails, screenshotsDir, addressConfirmed, progressCallback, skipNextClick);

  // If we skipped Next due to missing fields, return missing list (no navigation happened)
  if (skipNextClick) {
    const labelsList = missingFromArgs.map(p => FIELD_LABELS_SHORT[p] || p).join(', ');
    const message = `I need your ${labelsList}; could you please provide them?`;
    const instruction = `Collect ONLY these missing details from the caller. Ask the caller to REPEAT each missing detail so you can confirm you have it correct before calling the tool again. Do NOT read back or repeat the caller's personal details on the call (GDPR). When you have confirmed values for all of: ${missingFromArgs.join(', ')}, call booking_step_fill_contact_details ONCE with those parameters.`;
    console.log(`⚠️ [STEP 7] Missing required fields from args (${missingFromArgs.length}): ${missingFromArgs.join(', ')} — did not click Next`);
    return {
      success: true,
      missingFields: missingFromArgs,
      message,
      question: message,
      instruction
    };
  }

  // Check if address confirmation is required (fillResult from common step)
  if (fillResult && fillResult.requiresAddressConfirmation) {
    return {
      success: true,
      requiresAddressConfirmation: true,
      autoPopulatedAddress: fillResult.autoPopulatedAddress,
      townCity: fillResult.townCity,
      message: fillResult.message
    };
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
