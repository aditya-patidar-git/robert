/**
 * Authenticate Step Executor
 * Handles CRM authentication
 * Preserves all Playwright timing and state checks
 */

import * as commonSteps from '../../../commonBookingSteps/index.js';

/**
 * Execute authenticate step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<Object>} Step execution result
 */
export async function executeAuthenticate(page, args, sessionState, screenshotsDir) {
  // Use existing loginToCRM logic
  const crmCredentials = {
    loginUrl: 'https://takeabyte.co.uk/InContact/Account/Login',
    loginName: process.env.CRM_LOGIN || 'universalmct',
    username: process.env.CRM_USERNAME || 'auagent',
    password: process.env.CRM_PASSWORD || 'Robert2025!'
  };

  await commonSteps.loginToCRM(page, crmCredentials, screenshotsDir);

  return {
    success: true,
    authenticated: true
  };
}
