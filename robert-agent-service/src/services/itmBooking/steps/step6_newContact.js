import * as commonSteps from '../../commonBookingSteps/index.js';

/**
 * Step 6: Click "New contact" button
 * For NEW CLIENT workflow only
 */
export async function step6NewContact(page, screenshotsDir, screenshots) {
  console.log('👤 Step 6: Creating new contact...');
  await commonSteps.createNewContact(page, screenshotsDir);
  screenshots.push(await commonSteps.takeScreenshot(page, 'step-6-new-contact-created.png', screenshotsDir));
  console.log('✅ Step 6 completed: New contact created');
  return { success: true };
}

