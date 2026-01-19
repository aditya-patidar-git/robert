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
 * @returns {Promise<Object>} Step execution result
 */
export async function executeSendConfirmation(page, args, sessionState, screenshotsDir) {
  const courseType = args.courseType || sessionState?.courseType;
  
  // Map course type to email template type
  let emailCourseType = 'tfl';
  if (courseType === 'Full Licence Assessment' || courseType === 'Full Motorcycle Licence Assessment') {
    emailCourseType = 'full-licence';
  }
  
  // Use existing sendBookingConfirmationEmail logic
  await commonSteps.sendBookingConfirmationEmail(page, screenshotsDir, emailCourseType);

  return {
    success: true,
    confirmationSent: true
  };
}
