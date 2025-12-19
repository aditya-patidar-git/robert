import * as commonSteps from '../../commonBookingSteps/index.js';

/**
 * Step 4: Navigate to Diaries and select session
 * For NEW CLIENT workflow only
 */
export async function step4SelectSession(page, sessionDetails, screenshotsDir, screenshots) {
  console.log('📅 Step 4: Navigating to Diaries and selecting session...');
  await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, screenshotsDir);
  screenshots.push(await commonSteps.takeScreenshot(page, 'step-4-session-selected.png', screenshotsDir));
  console.log('✅ Step 4 completed: Session selected');
  return { success: true };
}

