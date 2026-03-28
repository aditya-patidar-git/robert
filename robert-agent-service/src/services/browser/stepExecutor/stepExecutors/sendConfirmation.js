/**
 * Send Confirmation Step Executor
 * Handles booking confirmation email sending
 * Preserves all Playwright timing and state checks
 */

import * as commonSteps from '../../../commonBookingSteps/index.js';

/**
 * Execute sendConfirmation step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
export async function executeSendConfirmation(page, args, sessionState, screenshotsDir, progressCallback = null) {
  progressCallback?.({ message: 'Sending your confirmation.' });
  const courseType = args.courseType || sessionState?.courseType || 'Introduction to Motorcycling';
  const location = sessionState?.sessionDetails?.location || args.location || null;

  console.log(`📧 [SEND-CONFIRMATION] courseType="${courseType}", location="${location || 'none'}"`);

  await commonSteps.sendBookingConfirmationEmail(page, screenshotsDir, courseType, progressCallback, location);

  return {
    success: true,
    confirmationSent: true
  };
}
