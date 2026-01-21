/**
 * New Client Flow
 * Handles filling contact details for new clients
 * Preserves all Playwright timing and state checks
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
