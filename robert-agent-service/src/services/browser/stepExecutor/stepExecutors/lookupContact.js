/**
 * Lookup Contact Step Executor
 * Handles existing contact lookup
 * Preserves all Playwright timing and state checks
 */

import * as commonSteps from '../../../commonBookingSteps/index.js';

/**
 * Execute lookupContact step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<Object>} Step execution result
 */
export async function executeLookupContact(page, args, sessionState, screenshotsDir) {
  // Get email from args or session state
  const email = args.customerEmail || sessionState.customerEmail || sessionState.clientDetails?.email;
  if (!email) {
    throw new Error('Client email is required for contact lookup');
  }

  // Get postcode for verification when multiple matches appear
  const postcode = args.postcode || sessionState.postcode || sessionState.clientDetails?.postcode;

  // Use existing lookupContactAndWait logic
  await commonSteps.lookupContactAndWait(page, email, screenshotsDir, postcode);

  return {
    success: true,
    contactLookedUp: true
  };
}
