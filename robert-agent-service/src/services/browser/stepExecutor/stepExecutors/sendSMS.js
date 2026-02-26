/**
 * Send SMS Step Executor
 * Handles SMS confirmation sending
 * Preserves all Playwright timing and state checks
 */

import * as commonSteps from '../../../commonBookingSteps/index.js';

/**
 * Execute sendSMS step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
export async function executeSendSMS(page, args, sessionState, screenshotsDir, progressCallback = null) {
  progressCallback?.({ message: 'Sending the SMS.' });
  const courseType = args.courseType || sessionState?.courseType;
  const clientMobile = args.customerMobile || args.clientMobile || sessionState?.customerMobile || null;

  // Map course type to SMS template type
  let smsCourseType = 'tfl-one-to-one';
  if (courseType === 'TfL Beyond CBT' || courseType === 'TfL - Beyond CBT - Skills for Delivery Riders') {
    smsCourseType = 'tfl-beyond-cbt';
  } else if (courseType === 'Full Licence Assessment' || courseType === 'Full Motorcycle Licence Assessment') {
    smsCourseType = 'full-licence';
  }
  
  const result = await commonSteps.sendSMSConfirmation(page, screenshotsDir, smsCourseType, clientMobile, progressCallback);

  if (result?.requiresClientMobile === true) {
    return {
      success: false,
      requiresClientMobile: true,
      message: result.message,
      instruction: result.instruction
    };
  }

  return {
    success: true,
    smsSent: true
  };
}
