/**
 * Create New Contact Step Executor
 * Handles new contact creation
 * Preserves all Playwright timing and state checks
 */

import * as commonSteps from '../../../commonBookingSteps/index.js';

/**
 * Execute createNewContact step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
export async function executeCreateNewContact(page, args, sessionState, screenshotsDir, progressCallback = null) {
  progressCallback?.({ message: 'Creating a new contact.' });
  // Use existing createNewContact logic
  await commonSteps.createNewContact(page, screenshotsDir, progressCallback);

  return {
    success: true,
    newContactCreated: true,
    nextTool: 'booking_step_fill_contact_details',
    instruction: 'Successfully navigated to the contact details page. In this same response call booking_step_fill_contact_details immediately with only courseType and workflowType (no contact parameters). Do NOT say you will check which details are needed; call the tool first. Do NOT ask for name, email, or phone before calling. The tool will return missingFields; then collect ONLY those missing fields (including name, email, phone if listed), each with double confirmation (ask → repeat to verify; if no match, ask once more and take as final). Then call booking_step_fill_contact_details ONCE with ALL parameters.'
  };
}
