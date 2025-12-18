import { selectBookingOptions } from '../selectBookingOptions.js';
import * as commonSteps from '../../commonBookingSteps/index.js';

/**
 * Step 7: Select booking options (for EXISTING CLIENT workflow)
 * Also used for Step 5 in NEW CLIENT workflow
 */
export async function step7BookingOptions(page, bookingArgs, sessionDetails, screenshotsDir, screenshots, workflowType = 'existing') {
  console.log(`⚙️ Step 7: Selecting ITM booking options (${workflowType.toUpperCase()} CLIENT workflow)...`);
  console.log(`📋 Step 7: bookingArgs passed to selectBookingOptions:`, {
    bikeType: bookingArgs.bikeType || '(not provided)',
    hasBikeType: !!bookingArgs.bikeType,
    allKeys: Object.keys(bookingArgs)
  });
  
  const bookingOptionsResult = await selectBookingOptions(page, bookingArgs, screenshotsDir);
  
  console.log(`📋 Step 7: selectBookingOptions returned:`, {
    hasResult: !!bookingOptionsResult,
    requiresPreferences: bookingOptionsResult?.requiresPreferences || false,
    missingPreferences: bookingOptionsResult?.missingPreferences || [],
    message: bookingOptionsResult?.message || '(no message)',
    error: bookingOptionsResult?.error || '(no error)'
  });
  
  // Check if preferences are required
  if (bookingOptionsResult && bookingOptionsResult.requiresPreferences) {
    console.log(`🔄 Step 7: Returning requiresPreferences to voice agent`);
    console.log(`🔄 Step 7: Marking resume point - next continuation call should resume from Step 7`);
    return {
      success: false,
      requiresPreferences: true,
      missingPreferences: bookingOptionsResult.missingPreferences,
      message: bookingOptionsResult.message,
      validOptions: bookingOptionsResult.validOptions,
      sessionDetails,
      screenshots,
      clientEmail: bookingArgs.customerEmail,
      resumeFromStep: 7,
      resumeContext: {
        step: 7,
        stepName: 'selectBookingOptions',
        requiredPreferences: bookingOptionsResult.missingPreferences || ['bikeType'],
        workflowType: workflowType // Remember we're in existing or new client workflow
      }
    };
  }
  
  console.log(`✅ Step 7: No preferences required, continuing with booking...`);
  screenshots.push(await commonSteps.takeScreenshot(page, 'step-7-options-selected.png', screenshotsDir));
  console.log('✅ Step 7 completed: Booking options selected');
  
  return { success: true };
}

