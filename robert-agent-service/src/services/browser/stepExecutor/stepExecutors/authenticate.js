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

  // CRITICAL: Persist agreedSlot to session state so subsequent steps (like selectSession) can access it
  if (args.agreedSlot && args.callSid) {
    sessionStateManager.setSessionDetails(args.callSid, args.agreedSlot);
    console.log(`✅ [authenticate] Persisted agreedSlot to session state for ${args.callSid}`);
  }

  return {
    success: true,
    authenticated: true,
    stepCompleted: 2, // Explicitly state which step is complete
    stepName: 'authenticate', // Explicit step name
    // Note: Step 3 is conversational (no tool) - AI must ask "Have you done training with us before?"
    // After getting the answer, proceed with workflowType: "existing" or "new" in subsequent steps
    message: `✅ STEP 2 COMPLETE: booking_step_authenticate has been successfully completed. CRM authentication successful. DO NOT RETRY THIS STEP. 

Now you MUST ask the caller conversationally: "Have you done training with us before?" Wait for their response.

STRICT NEXT STEPS (follow EXACTLY based on response):

1. If they say YES (EXISTING CLIENT):
   - Workflow Type: "existing"
   - Next Tool: Call booking_step_navigate_contacts with courseType and workflowType: "existing".
   - Following Step: After navigation, call booking_step_search_client to find them by phone/email.

2. If they say NO (NEW CLIENT):
   - Workflow Type: "new"
   - Next Tool: Call booking_step_select_session with courseType and workflowType: "new". (This enters the Diaries to book the slot agreed in Step 1).
   - Following Step: After session selection, call booking_step_select_booking_options to ask for bike type.

DO NOT use made-up tool names like booking_step_find_and_verify_client. Use only the tools defined in your registry.`
  };
}
