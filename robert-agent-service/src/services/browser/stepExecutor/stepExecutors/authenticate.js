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
    password: process.env.CRM_PASSWORD
  };

  await commonSteps.loginToCRM(page, crmCredentials, screenshotsDir);

  return {
    success: true,
    authenticated: true,
    stepCompleted: 2, // Explicitly state which step is complete
    stepName: 'authenticate', // Explicit step name
    // Note: Step 3 is conversational (no tool) - AI must ask "Have you done training with us before?"
    // After getting the answer, proceed with workflowType: "existing" or "new" in subsequent steps
    message: `✅ STEP 2 COMPLETE: booking_step_authenticate has been successfully completed. CRM authentication successful. DO NOT RETRY THIS STEP. Now you MUST ask the caller conversationally: "Have you done training with us before?" Wait for their response.

STRICT NEXT STEPS (use ONLY these tool names; do not assume or invent any other step name):
- If they say YES (existing client): Call booking_step_navigate_contacts with courseType and workflowType: "existing". After it completes, call booking_step_search_client with courseType, workflowType: "existing", and either customerMobile or customerEmail (ask for phone or email if needed). There is NO tool named booking_step_existing_client.
- If they say NO (new client): Proceed with workflowType "new" and the next step will be booking_step_select_session (Step 4 for new).`
  };
}
