import * as commonSteps from '../../commonBookingSteps/index.js';

/**
 * Step 8: Lookup existing client contact
 * For EXISTING CLIENT workflow only
 * Silent step with periodic updates
 */
export async function step7_5LookupContact(page, bookingArgs, callContext, screenshotsDir, screenshots) {
  console.log('🔍 Step 8: Looking up existing contact...');
  
  const clientEmail = bookingArgs.customerEmail || callContext.clientDetails?.email || bookingArgs.clientDetails?.email;
  if (!clientEmail) {
    throw new Error('Client email is required for contact lookup');
  }
  
  // Pass postcode for verification when multiple matches appear
  const clientPostcode = bookingArgs.postcode || callContext.clientDetails?.postcode || bookingArgs.clientDetails?.postcode;
  
  await commonSteps.lookupContactAndWait(page, clientEmail, 'email', screenshotsDir, clientPostcode);
  screenshots.push(await commonSteps.takeScreenshot(page, 'step-7-5-contact-looked-up.png', screenshotsDir));
  console.log('✅ Step 8 completed: Contact looked up');
  
  return { success: true };
}
