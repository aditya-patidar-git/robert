/**
 * Send Terms Step Executor
 * Handles terms and conditions email sending
 * Preserves all Playwright timing and state checks
 */

import * as commonSteps from '../../../commonBookingSteps/index.js';

/**
 * Execute sendTerms step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
export async function executeSendTerms(page, args, sessionState, screenshotsDir, progressCallback = null) {
  progressCallback?.({ message: 'Sending the terms.' });
  // Use existing sendTermsAndConditionsEmail logic
  await commonSteps.sendTermsAndConditionsEmail(page, screenshotsDir, progressCallback);

  return {
    success: true,
    termsSent: true
  };
}
