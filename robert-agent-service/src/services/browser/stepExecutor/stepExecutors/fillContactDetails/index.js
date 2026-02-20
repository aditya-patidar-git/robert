/**
 * Fill Contact Details Step Executor
 * Main orchestrator for fill contact details step
 * Routes to existing or new client flow based on workflowType
 * Preserves all Playwright timing and state checks
 */

import { executeExistingClientFlow } from './existingClient.js';
import { executeNewClientFlow } from './newClient.js';

/**
 * Execute fillContactDetails step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
export async function executeFillContactDetails(page, args, sessionState, screenshotsDir, progressCallback = null) {
  progressCallback?.({ message: 'Opening the contact form.' });
  const workflowType = args.workflowType || sessionState?.workflowType || 'existing';
  
  if (workflowType === 'existing') {
    return await executeExistingClientFlow(page, args, sessionState, screenshotsDir, progressCallback);
  } else {
    return await executeNewClientFlow(page, args, sessionState, screenshotsDir, progressCallback);
  }
}
