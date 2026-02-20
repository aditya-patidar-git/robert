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
 * @returns {Promise<Object>} Step execution result
 */
export async function executeCreateNewContact(page, args, sessionState, screenshotsDir) {
  // Use existing createNewContact logic
  await commonSteps.createNewContact(page, screenshotsDir);

  return {
    success: true,
    newContactCreated: true,
    nextTool: 'booking_step_fill_contact_details',
    instruction: 'Successfully navigated to the contact details page. You MUST now call booking_step_fill_contact_details with the customer name, email address, and mobile number to save these details to the new contact profile.'
  };
}
