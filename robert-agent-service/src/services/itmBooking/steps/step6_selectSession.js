import * as commonSteps from '../../commonBookingSteps/index.js';

/**
 * Step 6: Navigate to Diaries and select session
 * For existing client workflow
 */
export async function step6SelectSession(page, sessionDetails, screenshotsDir, screenshots) {
  console.log('📅 Step 6: Navigating to Diaries and selecting session...');
  await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, screenshotsDir);
  screenshots.push(await commonSteps.takeScreenshot(page, 'step-6-session-selected.png', screenshotsDir));
  console.log('✅ Step 6 completed: Session selected');
  return { success: true };
}

