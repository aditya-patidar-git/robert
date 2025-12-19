import * as commonSteps from '../../commonBookingSteps/index.js';

/**
 * Step 8: Fill contact details
 * For existing clients: Fill MISSING fields only (uses lookupContactAndWait)
 * For new clients: Fill ALL contact details from scratch (uses fillContactDetails)
 */
export async function step8ContactDetails(page, bookingArgs, callContext, screenshotsDir, screenshots, workflowType = 'existing') {
  if (workflowType === 'existing') {
    // EXISTING CLIENT: Fill MISSING fields only
    console.log('🔍 Step 8: Looking up contact and filling missing details...');
    const clientEmail = bookingArgs.customerEmail || callContext.clientDetails?.email || bookingArgs.clientDetails?.email;
    if (!clientEmail) {
      throw new Error('Client email is required for contact lookup');
    }
    // Pass postcode for verification when multiple matches appear
    const clientPostcode = bookingArgs.postcode || callContext.clientDetails?.postcode || bookingArgs.clientDetails?.postcode;
    await commonSteps.lookupContactAndWait(page, clientEmail, screenshotsDir, clientPostcode);
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-8-contact-details.png', screenshotsDir));
    console.log('✅ Step 8 completed: Contact details updated');
  } else {
    // NEW CLIENT: Fill ALL contact details from scratch
    console.log('📝 Step 8: Filling all contact details...');
    const contactDetails = {
      title: bookingArgs.title,
      firstNames: bookingArgs.firstNames,
      surname: bookingArgs.surname,
      mobileNumber: bookingArgs.customerPhone,
      email: bookingArgs.customerEmail,
      dateOfBirth: bookingArgs.dateOfBirth,
      postcode: bookingArgs.postcode,
      houseNumberOrName: bookingArgs.houseNumberOrName,
      licenceHeld: bookingArgs.licenceHeld,
      nationalInsuranceNumber: bookingArgs.nationalInsuranceNumber,
      drivingLicenceNumber: bookingArgs.drivingLicenceNumber,
      licenceFormat: bookingArgs.licenceFormat,
      hearAboutUs: bookingArgs.hearAboutUs,
      ridingExperience: bookingArgs.ridingExperience,
      marketingConsent: bookingArgs.marketingConsent,
      dataSharing: bookingArgs.dataSharing
    };
    await commonSteps.fillContactDetails(page, contactDetails, screenshotsDir);
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-8-contact-details-filled.png', screenshotsDir));
    console.log('✅ Step 8 completed: All contact details filled');
  }
  
  return { success: true };
}

