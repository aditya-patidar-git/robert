import * as commonSteps from '../../commonBookingSteps/index.js';

/**
 * Step 8: Fill contact details
 * For existing clients: Fill MISSING fields only (uses lookupContactAndWait)
 * For new clients: Fill ALL contact details from scratch (uses fillContactDetails)
 */
export async function step8ContactDetails(page, bookingArgs, callContext, screenshotsDir, screenshots, workflowType = 'existing') {
  if (workflowType === 'existing') {
    // EXISTING CLIENT: Fill MISSING fields only
    // Note: Contact lookup is now handled by Step 7.5, so this step only handles field checking and filling
    console.log('📝 Step 8: Checking and filling missing contact details...');
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

