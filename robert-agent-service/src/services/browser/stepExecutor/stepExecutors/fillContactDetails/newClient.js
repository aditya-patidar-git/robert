/**
 * New Client Flow
 * Handles filling contact details for new clients
 * Preserves all Playwright timing and state checks
 * Uses same required-fields check as existing client (only ask for configured must-details).
 * Applies UK format normalization for postcode, mobile, email, NI number, and driving licence before form fill.
 */

import * as commonSteps from '../../../../commonBookingSteps/index.js';
import { cleanEmail } from '../../../../commonBookingSteps/utils.js';
import { normalizeUKMobile } from '../../../../mobileSearchService.js';
import { formatPostcode, formatNationalInsurance, formatDrivingLicenceNumber, validateNationalInsurance, validateDrivingLicenceNumber, validateDrivingLicenceFirstHalf, validateDrivingLicenceSecondHalf } from '../../../../../utils/britishFormatting.js';

/**
 * Execute new client fill contact details flow
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
const REQUIRED_PARAM_NAMES = ['customerName', 'customerEmail', 'customerMobile', 'postcode', 'houseNumber', 'licenceHeld', 'nationalInsurance', 'drivingLicenceNumber'];
const FIELD_LABELS_SHORT = {
  customerName: 'full name',
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
    customerName: () => args.customerName || args.name,
    customerEmail: () => args.customerEmail,
    customerMobile: () => args.customerMobile || args.customerPhone,
    postcode: () => args.postcode,
    houseNumber: () => args.houseNumber,
    licenceHeld: () => args.licenceHeld,
    nationalInsurance: () => args.nationalInsurance,
    drivingLicenceNumber: () => args.drivingLicenceNumber || (args.drivingLicenceFirstHalf && args.drivingLicenceSecondHalf ? 'FROM_HALVES' : '')
  };
  const v = map[paramName] ? map[paramName]() : undefined;
  return (v != null && String(v).trim() !== '') ? String(v).trim() : '';
}

export async function executeNewClientFlow(page, args, sessionState, screenshotsDir, progressCallback = null) {
  progressCallback?.({ message: 'Filling in your details.' });
  const addressConfirmed = args.addressConfirmed || false;
  const correctedAddress = args.correctedAddress || null;

  // Driving licence: only first half provided — validate and ask for second half (no form fill, no double confirmation for full number)
  if (args.drivingLicenceFirstHalf && !args.drivingLicenceSecondHalf && !args.drivingLicenceNumber) {
    const r = validateDrivingLicenceFirstHalf(args.drivingLicenceFirstHalf);
    if (!r.valid) {
      console.log(`⚠️ [STEP 7] UK driving licence first half validation failed`);
      return { success: true, invalidFormat: true, invalidFields: { drivingLicenceFirstHalf: r.message }, instruction: 'Ask the caller for the first half of the driving licence again using the correct format, then call booking_step_fill_contact_details with drivingLicenceFirstHalf only.' };
    }
    const instruction = 'Ask for the second half of the driving licence (7 or 8 characters: 5 digits then 2 letters, or 3 digits then 5 letters/numbers; no spaces). Then call booking_step_fill_contact_details again with the same drivingLicenceFirstHalf and the new drivingLicenceSecondHalf. Do not ask the caller to repeat the full number.';
    console.log(`⚠️ [STEP 7] Driving licence first half valid — need second half`);
    return { success: true, requiresDrivingLicenceSecondHalf: true, drivingLicenceFirstHalf: r.formatted, instruction };
  }

  // Driving licence: both halves provided — validate both, concatenate, use as full number (no double confirmation)
  let effectiveDrivingLicenceNumber = undefined;
  if (args.drivingLicenceFirstHalf && args.drivingLicenceSecondHalf && !args.drivingLicenceNumber) {
    const r1 = validateDrivingLicenceFirstHalf(args.drivingLicenceFirstHalf);
    const r2 = validateDrivingLicenceSecondHalf(args.drivingLicenceSecondHalf);
    if (!r1.valid) {
      return { success: true, invalidFormat: true, invalidFields: { drivingLicenceFirstHalf: r1.message }, instruction: 'Ask for the first half again, then call with both drivingLicenceFirstHalf and drivingLicenceSecondHalf.' };
    }
    if (!r2.valid) {
      return { success: true, invalidFormat: true, invalidFields: { drivingLicenceSecondHalf: r2.message }, instruction: 'Ask for the second half again, then call with both drivingLicenceFirstHalf and drivingLicenceSecondHalf.' };
    }
    effectiveDrivingLicenceNumber = (r1.formatted || '') + (r2.formatted || '');
  }

  // Compute missing required fields from args BEFORE filling/clicking Next—only click Next when all required are present
  const missingFromArgs = REQUIRED_PARAM_NAMES.filter(p => !getArgValue(args, p));
  const skipNextClick = missingFromArgs.length > 0;

  // When we have NI or full driving licence (not halves), validate UK format before filling; return invalidFormat so agent re-asks with correct format
  if (!skipNextClick) {
    const invalidFields = {};
    if (getArgValue(args, 'nationalInsurance')) {
      const r = validateNationalInsurance(args.nationalInsurance);
      if (!r.valid) invalidFields.nationalInsurance = r.message;
    }
    if (getArgValue(args, 'drivingLicenceNumber') && effectiveDrivingLicenceNumber === undefined) {
      const r = validateDrivingLicenceNumber(args.drivingLicenceNumber);
      if (!r.valid) invalidFields.drivingLicenceNumber = r.message;
    }
    if (Object.keys(invalidFields).length > 0) {
      const instruction = 'One or more details were in the wrong UK format. Ask the caller to provide again the following, using the correct format (do not recite their value back). Then call booking_step_fill_contact_details again with the corrected values.';
      console.log(`⚠️ [STEP 7] UK format validation failed: ${Object.keys(invalidFields).join(', ')}`);
      return { success: true, invalidFormat: true, invalidFields, instruction };
    }
  }

  // Apply UK format normalization so the form receives valid values and avoids validation errors
  const rawMobile = args.customerMobile || args.customerPhone;
  const mobileNumber = rawMobile ? (normalizeUKMobile(rawMobile) || String(rawMobile).trim()) : undefined;
  const rawEmail = args.customerEmail;
  const email = rawEmail ? (cleanEmail(rawEmail) || String(rawEmail).trim()) : undefined;
  const postcode = args.postcode ? formatPostcode(args.postcode) : undefined;
  const nationalInsuranceNumber = args.nationalInsurance ? formatNationalInsurance(args.nationalInsurance) : undefined;
  const drivingLicenceNumber = effectiveDrivingLicenceNumber !== undefined ? effectiveDrivingLicenceNumber : (args.drivingLicenceNumber ? formatDrivingLicenceNumber(args.drivingLicenceNumber) : undefined);

  const contactDetails = {
    title: args.title,
    firstNames: args.firstNames || args.customerName?.split(' ')[0],
    surname: args.surname || args.customerName?.split(' ').slice(1).join(' '),
    mobileNumber,
    email,
    dateOfBirth: args.dateOfBirth,
    postcode,
    houseNumberOrName: args.houseNumber,
    licenceHeld: args.licenceHeld,
    nationalInsuranceNumber,
    drivingLicenceNumber,
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
    const instruction = `Collect ONLY these missing details from the caller. For each detail (except driving licence when collected in two halves): (1) ask for the detail and note it down; (2) your NEXT turn MUST be to ask the caller to repeat that same detail to cross-verify (e.g. "Could you please repeat that so I can confirm I have it correct?"). If the repeat MATCHES what you noted, use it and proceed to the next detail. If the repeat does NOT match, ask once more for that detail only (e.g. "Could you tell me that one more time?") and take that answer as the final value—do not ask for a second repeat; then proceed to the next detail. For driving licence number: you may ask for the FIRST half only (8 characters), call the tool with drivingLicenceFirstHalf; when the tool returns requiresDrivingLicenceSecondHalf, ask for the second half and call again with both drivingLicenceFirstHalf and drivingLicenceSecondHalf—you do NOT need to ask the caller to repeat the full number when collected in two halves. Do NOT move to the next question until the current one is either verified (match) or finalised (one re-ask). STRICTLY (GDPR): Never say the caller's postcode, address, name, phone number, email, NI number, or any other personal detail aloud. Do not say "X is confirmed" or recite the value to confirm—ask them to repeat it; do not recite it yourself. When you have confirmed or finalised values for all of: ${missingFromArgs.join(', ')}, call booking_step_fill_contact_details ONCE with ALL those parameters (or drivingLicenceFirstHalf then both halves for driving licence).`;
    console.log(`⚠️ [STEP 7] Missing required fields from args (${missingFromArgs.length}): ${missingFromArgs.join(', ')} — did not click Next`);
    return {
      success: true,
      missingFields: missingFromArgs,
      message,
      question: message,
      instruction
    };
  }

  // Check if address confirmation is required (fillResult from common step).
  // Pass through partialFill/skippedFields so coordinator can proceed without waiting when a field failed.
  if (fillResult && fillResult.requiresAddressConfirmation) {
    return {
      success: true,
      requiresAddressConfirmation: true,
      autoPopulatedAddress: fillResult.autoPopulatedAddress,
      townCity: fillResult.townCity,
      message: fillResult.message,
      partialFill: fillResult?.partialFill,
      skippedFields: fillResult?.skippedFields
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
    partialFill: fillResult?.partialFill,
    skippedFields: fillResult?.skippedFields,
    message: fillResult?.partialFill
      ? `Contact details step completed; some fields could not be filled (${(fillResult.skippedFields || []).join(', ')}). Proceeding to payment. DO NOT say "booking confirmed" or "you're all set". IMMEDIATELY call booking_step_process_payment.`
      : `✅ STEP 7 COMPLETE: booking_step_fill_contact_details has been successfully completed. Contact details form filled successfully. DO NOT RETRY THIS STEP. IMMEDIATELY proceed to STEP 8 by calling booking_step_process_payment tool.`
  };
}
