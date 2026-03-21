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
import sessionStateManager from '../../../sessionStateManager.js';

/** Keys merged from session draft + tool args (no callSid / abortSignal). */
const PERSISTABLE_NEW_CLIENT_CONTACT_KEYS = [
  'courseType',
  'workflowType',
  'customerName',
  'name',
  'firstNames',
  'surname',
  'title',
  'customerEmail',
  'customerMobile',
  'customerPhone',
  'postcode',
  'houseNumber',
  'licenceHeld',
  'nationalInsurance',
  'drivingLicenceFirstHalf',
  'drivingLicenceSecondHalf',
  'hearAboutUs',
  'ridingExperience',
  'marketingConsent',
  'dataSharing',
  'licenceFormat',
  'dateOfBirth',
  'correctedAddress'
];

function mergePendingContactArgs(persisted, incoming) {
  const base = persisted && typeof persisted === 'object' ? { ...persisted } : {};
  for (const [k, v] of Object.entries(incoming || {})) {
    if (v !== undefined) base[k] = v;
  }
  return base;
}

function toPersistableContactArgs(mergedArgs) {
  const out = {};
  for (const k of PERSISTABLE_NEW_CLIENT_CONTACT_KEYS) {
    if (mergedArgs[k] !== undefined) out[k] = mergedArgs[k];
  }
  return out;
}

function persistNewClientContactDraft(callSid, mergedArgs) {
  if (!callSid) return;
  const plain = toPersistableContactArgs(mergedArgs);
  if (Object.keys(plain).length === 0) return;
  sessionStateManager.setPendingNewClientContactArgs(callSid, plain);
}

function clearNewClientContactDraft(callSid) {
  if (!callSid) return;
  sessionStateManager.clearPendingNewClientContactArgs(callSid);
}

/**
 * Execute new client fill contact details flow
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
const REQUIRED_PARAM_NAMES = [
  'customerName',
  'customerEmail',
  'customerMobile',
  'postcode',
  'houseNumber',
  'licenceHeld',
  'nationalInsurance',
  'drivingLicenceNumber',
  'hearAboutUs',
  'ridingExperience',
  'marketingConsent',
  'dataSharing'
];
const FIELD_LABELS_SHORT = {
  customerName: 'full name',
  customerEmail: 'email address',
  customerMobile: 'mobile number',
  postcode: 'postcode',
  houseNumber: 'house number or name',
  licenceHeld: 'licence held type',
  nationalInsurance: 'National Insurance number',
  drivingLicenceNumber: 'driving licence number',
  hearAboutUs: 'how you heard about us',
  ridingExperience: 'riding experience',
  marketingConsent: 'whether we may contact you about other courses (yes or no)',
  dataSharing: 'whether we may share your details with DVSA and partners (yes or no)'
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
    drivingLicenceNumber: () =>
      args.drivingLicenceFirstHalf && args.drivingLicenceSecondHalf && String(args.drivingLicenceFirstHalf).trim() && String(args.drivingLicenceSecondHalf).trim()
        ? 'FROM_HALVES'
        : '',
    hearAboutUs: () => args.hearAboutUs,
    ridingExperience: () => args.ridingExperience,
    marketingConsent: () => (args.marketingConsent === true || args.marketingConsent === false ? 'set' : ''),
    dataSharing: () => (args.dataSharing === true || args.dataSharing === false ? 'set' : '')
  };
  const v = map[paramName] ? map[paramName]() : undefined;
  return (v != null && String(v).trim() !== '') ? String(v).trim() : '';
}

export async function executeNewClientFlow(page, args, sessionState, screenshotsDir, progressCallback = null) {
  const callSid = args.callSid;
  const pending = callSid ? sessionStateManager.getPendingNewClientContactArgs(callSid) : null;
  const mergedArgs = mergePendingContactArgs(pending, args);

  progressCallback?.({ message: 'Filling in your details.' });
  const addressConfirmed = mergedArgs.addressConfirmed || false;
  const correctedAddress = mergedArgs.correctedAddress != null ? mergedArgs.correctedAddress : null;

  const INSTRUCTION_DL_TWO_STEP =
    'Do not pass drivingLicenceNumber as a single value. Collect the 16-character photocard number in two steps: (1) Ask for the first 8 characters, ask the caller to repeat to verify, then call with drivingLicenceFirstHalf only. (2) Ask for the second 8 characters, ask them to repeat to verify, then call with both drivingLicenceFirstHalf and drivingLicenceSecondHalf. The 2-digit issue number on the card is not part of the licence number.';

  const dlNumRaw = mergedArgs.drivingLicenceNumber && String(mergedArgs.drivingLicenceNumber).trim();
  const hasBothHalves =
    mergedArgs.drivingLicenceFirstHalf &&
    mergedArgs.drivingLicenceSecondHalf &&
    String(mergedArgs.drivingLicenceFirstHalf).trim() &&
    String(mergedArgs.drivingLicenceSecondHalf).trim();
  if (dlNumRaw && !hasBothHalves) {
    persistNewClientContactDraft(callSid, mergedArgs);
    return { success: true, requiresDrivingLicenceTwoStep: true, instruction: INSTRUCTION_DL_TWO_STEP };
  }

  // Driving licence: only first half provided — validate and ask for second half
  if (mergedArgs.drivingLicenceFirstHalf && !mergedArgs.drivingLicenceSecondHalf) {
    const r = validateDrivingLicenceFirstHalf(mergedArgs.drivingLicenceFirstHalf);
    if (!r.valid) {
      console.log(`⚠️ [STEP 7] UK driving licence first half validation failed`);
      persistNewClientContactDraft(callSid, mergedArgs);
      return { success: true, invalidFormat: true, invalidFields: { drivingLicenceFirstHalf: r.message }, instruction: 'Ask the caller for the first half of the driving licence again using the correct format, then call booking_step_fill_contact_details with drivingLicenceFirstHalf only.' };
    }
    const instruction =
      'Ask for the second 8 characters of the licence number (last 3 date digits, 2 initials, 3 security characters). Ask the caller to repeat to verify, then call booking_step_fill_contact_details again with the same drivingLicenceFirstHalf and drivingLicenceSecondHalf.';
    console.log(`⚠️ [STEP 7] Driving licence first half valid — need second half`);
    persistNewClientContactDraft(callSid, { ...mergedArgs, drivingLicenceFirstHalf: r.formatted });
    return { success: true, requiresDrivingLicenceSecondHalf: true, drivingLicenceFirstHalf: r.formatted, instruction };
  }

  // Driving licence: both halves provided — validate, concatenate, validate full photocard number
  let effectiveDrivingLicenceNumber = undefined;
  if (mergedArgs.drivingLicenceFirstHalf && mergedArgs.drivingLicenceSecondHalf) {
    const r1 = validateDrivingLicenceFirstHalf(mergedArgs.drivingLicenceFirstHalf);
    const r2 = validateDrivingLicenceSecondHalf(mergedArgs.drivingLicenceSecondHalf);
    if (!r1.valid) {
      persistNewClientContactDraft(callSid, mergedArgs);
      return { success: true, invalidFormat: true, invalidFields: { drivingLicenceFirstHalf: r1.message }, instruction: 'Ask for the first half again, then call with both drivingLicenceFirstHalf and drivingLicenceSecondHalf.' };
    }
    if (!r2.valid) {
      persistNewClientContactDraft(callSid, mergedArgs);
      return { success: true, invalidFormat: true, invalidFields: { drivingLicenceSecondHalf: r2.message }, instruction: 'Ask for the second half again, then call with both drivingLicenceFirstHalf and drivingLicenceSecondHalf.' };
    }
    const concatenated = (r1.formatted || '') + (r2.formatted || '');
    const fullR = validateDrivingLicenceNumber(concatenated);
    if (!fullR.valid) {
      persistNewClientContactDraft(callSid, mergedArgs);
      return {
        success: true,
        invalidFormat: true,
        invalidFields: { drivingLicenceNumber: fullR.message || 'Combined halves do not form a valid UK photocard licence number.' },
        instruction: 'The two halves must form a valid 16-character UK photocard licence number. Ask the caller to confirm each half again, then call with drivingLicenceFirstHalf and drivingLicenceSecondHalf.'
      };
    }
    effectiveDrivingLicenceNumber = fullR.formatted;
  }

  // Compute missing required fields from args BEFORE filling/clicking Next—only click Next when all required are present
  const missingFromArgs = REQUIRED_PARAM_NAMES.filter(p => !getArgValue(mergedArgs, p));
  const skipNextClick = missingFromArgs.length > 0;

  // When we have NI or driving licence (full or concatenated halves), validate UK format before filling; return invalidFormat so agent re-asks with correct format
  if (!skipNextClick) {
    const invalidFields = {};
    if (getArgValue(mergedArgs, 'nationalInsurance')) {
      const r = validateNationalInsurance(mergedArgs.nationalInsurance);
      if (!r.valid) invalidFields.nationalInsurance = r.message;
    }
    const dlCandidate = effectiveDrivingLicenceNumber !== undefined ? effectiveDrivingLicenceNumber : undefined;
    if (dlCandidate) {
      const r = validateDrivingLicenceNumber(dlCandidate);
      if (!r.valid) invalidFields.drivingLicenceNumber = r.message;
    }
    if (Object.keys(invalidFields).length > 0) {
      const instruction = 'One or more details were in the wrong UK format. Ask the caller to provide again the following, using the correct format (do not recite their value back). Then call booking_step_fill_contact_details again with the corrected values.';
      console.log(`⚠️ [STEP 7] UK format validation failed: ${Object.keys(invalidFields).join(', ')}`);
      persistNewClientContactDraft(callSid, mergedArgs);
      return { success: true, invalidFormat: true, invalidFields, instruction };
    }
  }

  // Apply UK format normalization so the form receives valid values and avoids validation errors
  const rawMobile = mergedArgs.customerMobile || mergedArgs.customerPhone;
  const mobileNumber = rawMobile ? (normalizeUKMobile(rawMobile) || String(rawMobile).trim()) : undefined;
  const rawEmail = mergedArgs.customerEmail;
  const email = rawEmail ? (cleanEmail(rawEmail) || String(rawEmail).trim()) : undefined;
  const postcode = mergedArgs.postcode ? formatPostcode(mergedArgs.postcode) : undefined;
  const nationalInsuranceNumber = mergedArgs.nationalInsurance ? formatNationalInsurance(mergedArgs.nationalInsurance) : undefined;
  const drivingLicenceNumber = effectiveDrivingLicenceNumber !== undefined ? effectiveDrivingLicenceNumber : undefined;

  const contactDetails = {
    title: mergedArgs.title,
    firstNames: mergedArgs.firstNames || mergedArgs.customerName?.split(' ')[0],
    surname: mergedArgs.surname || mergedArgs.customerName?.split(' ').slice(1).join(' '),
    mobileNumber,
    email,
    dateOfBirth: mergedArgs.dateOfBirth,
    postcode,
    houseNumberOrName: mergedArgs.houseNumber,
    licenceHeld: mergedArgs.licenceHeld,
    nationalInsuranceNumber,
    drivingLicenceNumber,
    licenceFormat: mergedArgs.licenceFormat || 'GB',
    hearAboutUs: mergedArgs.hearAboutUs,
    ridingExperience: mergedArgs.ridingExperience,
    marketingConsent: mergedArgs.marketingConsent,
    dataSharing: mergedArgs.dataSharing,
    correctedAddress: correctedAddress
  };

  const addressConfirmShortcut = addressConfirmed && !correctedAddress && !skipNextClick;
  const fillResult = await commonSteps.fillContactDetails(
    page,
    contactDetails,
    screenshotsDir,
    addressConfirmed,
    progressCallback,
    skipNextClick,
    addressConfirmShortcut
  );

  // If we skipped Next due to missing fields, return missing list (no navigation happened)
  if (skipNextClick) {
    const labelsList = missingFromArgs.map(p => FIELD_LABELS_SHORT[p] || p).join(', ');
    const message = `I need your ${labelsList}; could you please provide them?`;
    const instruction = `Collect ONLY these missing details from the caller. SINGLE-ASK (no repeat-verify): hearAboutUs, ridingExperience, marketingConsent, dataSharing — ask once each, accept their answer, pass exact CRM option text for the two dropdowns (or booleans for the two yes/no questions). For all OTHER missing fields including the driving licence use double confirmation: (1) ask and note the answer; (2) your NEXT turn MUST ask them to repeat for cross-check without YOU saying their value—e.g. "Please repeat that—I won't say it back." NEVER "confirm it is…" or read any digit/letter of their answer aloud. For the driving licence photocard number (16 characters, not the issue number): collect in two steps—first 8 characters, verify with repeat (no echo), call with drivingLicenceFirstHalf only; then second 8 characters, same, call with both halves. Do NOT pass drivingLicenceNumber as one string. Do NOT move on until each sensitive detail is verified or finalised. STRICTLY (GDPR): Never say the caller's postcode, address, name, phone number, email, NI number, or any other personal detail aloud. When you have values for all of: ${missingFromArgs.join(', ')}, call booking_step_fill_contact_details ONCE with ALL parameters (use two-step fields for driving licence as above).`;
    console.log(`⚠️ [STEP 7] Missing required fields from args (${missingFromArgs.length}): ${missingFromArgs.join(', ')} — did not click Next`);
    persistNewClientContactDraft(callSid, mergedArgs);
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
    persistNewClientContactDraft(callSid, mergedArgs);
    return {
      success: true,
      requiresAddressConfirmation: true,
      autoPopulatedAddress: fillResult.autoPopulatedAddress,
      townCity: fillResult.townCity,
      message: fillResult.message,
      instruction: fillResult.instruction,
      partialFill: fillResult?.partialFill,
      skippedFields: fillResult?.skippedFields
    };
  }

  clearNewClientContactDraft(callSid);
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
