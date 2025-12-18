import * as commonSteps from '../../commonBookingSteps/index.js';

/**
 * Step 9: Payment processing
 * Handles payment option selection, payment method, card details, and booking completion
 */
export async function step9Payment(page, bookingArgs, screenshotsDir, screenshots) {
  console.log('💳 Step 9: Processing payment...');
  
  await commonSteps.selectPaymentOption(page, screenshotsDir);
  screenshots.push(await commonSteps.takeScreenshot(page, 'step-9-payment-option-selected.png', screenshotsDir));
  await page.waitForTimeout(2000);
  
  await commonSteps.selectPaymentMethod(page, screenshotsDir);
  screenshots.push(await commonSteps.takeScreenshot(page, 'step-9-payment-method-selected.png', screenshotsDir));
  await page.waitForTimeout(2000);
  
  await commonSteps.fillCardDetails(page, screenshotsDir);
  screenshots.push(await commonSteps.takeScreenshot(page, 'step-9-card-details-filled.png', screenshotsDir));
  
  // Default to true if not provided - allows booking to proceed if agent didn't explicitly ask
  const termsAccepted = bookingArgs.termsAccepted !== undefined ? bookingArgs.termsAccepted : true;
  const bookingResult = await commonSteps.acceptTermsAndMakeBooking(page, screenshotsDir, termsAccepted, false);
  
  if (!bookingResult.success) {
    if (!bookingResult.termsAccepted) {
      throw new Error('Client did not accept terms - booking cancelled');
    } else {
      throw new Error(`Failed to complete booking: ${bookingResult.error}`);
    }
  }
  
  screenshots.push(await commonSteps.takeScreenshot(page, 'step-9-booking-completed.png', screenshotsDir));
  console.log('✅ Step 9 completed: Payment processed and booking made');
  
  return { success: true, paymentCompleted: true };
}

