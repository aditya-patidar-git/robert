import { selectBookingOptions } from '../selectBookingOptions.js';
import * as commonSteps from '../../commonBookingSteps/index.js';

/**
 * Step 5: Select booking options (for NEW CLIENT workflow only)
 * NOTE: For existing clients, Step 7 handles this after Step 6
 */
export async function step5BookingOptions(page, bookingArgs, sessionDetails, screenshotsDir, screenshots) {
  console.log('⚙️ Step 5: Selecting ITM booking options (NEW CLIENT workflow)...');
  console.log(`📋 Step 5: bookingArgs passed to selectBookingOptions:`, {
    bikeType: bookingArgs.bikeType || '(not provided)',
    hasBikeType: !!bookingArgs.bikeType,
    allKeys: Object.keys(bookingArgs)
  });
  
  const bookingOptionsResult = await selectBookingOptions(page, bookingArgs, screenshotsDir);
  
  console.log(`📋 Step 5: selectBookingOptions returned:`, {
    hasResult: !!bookingOptionsResult,
    requiresPreferences: bookingOptionsResult?.requiresPreferences || false,
    missingPreferences: bookingOptionsResult?.missingPreferences || [],
    message: bookingOptionsResult?.message || '(no message)',
    error: bookingOptionsResult?.error || '(no error)'
  });
  
  // Check if preferences are required
  if (bookingOptionsResult && bookingOptionsResult.requiresPreferences) {
    console.log(`🔄 Step 5: Returning requiresPreferences to voice agent`);
    console.log(`🔄 Step 5: Marking resume point - next continuation call should resume from Step 7`);
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
        workflowType: 'new' // Remember we're in new client workflow
      }
    };
  }
  
  console.log(`✅ Step 5: No preferences required, continuing with booking...`);
  screenshots.push(await commonSteps.takeScreenshot(page, 'step-5-options-selected.png', screenshotsDir));
  console.log('✅ Step 5 completed: Booking options selected');
  
  return { success: true };
}

