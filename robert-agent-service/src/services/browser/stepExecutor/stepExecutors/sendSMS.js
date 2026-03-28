/**
 * Send SMS Step Executor
 * Handles SMS confirmation sending
 * Preserves all Playwright timing and state checks
 */

import * as commonSteps from '../../../commonBookingSteps/index.js';
import { conversations } from '../../../../shared/state.js';
import sessionStateManager from '../../sessionStateManager.js';

function resolveCallSid(args, sessionState) {
  if (args?.callSid) return args.callSid;
  if (sessionState?.browserSessionId) {
    const m = String(sessionState.browserSessionId).match(/^browser_(.+?)_\d+$/);
    if (m) return m[1];
  }
  return null;
}

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
  const courseTypeStr = args.courseType || sessionState?.courseType || 'ITM';
  const clientMobile = args.customerMobile || args.clientMobile || sessionState?.customerMobile || null;

  const callSid = resolveCallSid(args, sessionState);
  let sessionDetails = sessionState?.sessionDetails ?? null;
  if (!sessionDetails && callSid) {
    sessionDetails = sessionStateManager.getSessionDetails(callSid);
  }
  if (!sessionDetails && callSid && conversations[callSid]?.lastAvailabilityCheck) {
    const lac = conversations[callSid].lastAvailabilityCheck;
    sessionDetails = lac.sessionDetails || lac.selectedSlot || null;
  }

  const result = await commonSteps.sendSMSConfirmation(
    page,
    screenshotsDir,
    courseTypeStr,
    clientMobile,
    progressCallback,
    { sessionDetails, courseType: courseTypeStr }
  );

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
