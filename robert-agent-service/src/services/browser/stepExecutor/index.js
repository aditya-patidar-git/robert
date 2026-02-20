/**
 * Step Executor
 * Executes step logic using commonBookingSteps functions
 * Verifies browser state before/after execution
 * Handles errors and state recovery
 * 
 * This is the main orchestrator that delegates to individual step executors
 * Preserves all Playwright timing, selectors, and execution order
 */

import { verifyBrowserStateBefore, verifyBrowserStateAfter } from './stateVerification.js';
import { executeCheckAvailability } from './stepExecutors/checkAvailability.js';
import { executeAuthenticate } from './stepExecutors/authenticate.js';
import { executeNavigateContacts } from './stepExecutors/navigateContacts.js';
import { executeSearchClient } from './stepExecutors/searchClient.js';
import { executeSelectSession } from './stepExecutors/selectSession.js';
import { executeSelectBookingOptions } from './stepExecutors/selectBookingOptions.js';
import { executeCreateNewContact } from './stepExecutors/createNewContact.js';
import { executeLookupContact } from './stepExecutors/lookupContact.js';
import { executeFillContactDetails } from './stepExecutors/fillContactDetails/index.js';
import { executeProcessPayment } from './stepExecutors/processPayment.js';
import { executeSendPaymentRequest } from './stepExecutors/sendPaymentRequest.js';
import { executeSendConfirmation } from './stepExecutors/sendConfirmation.js';
import { executeSendTerms } from './stepExecutors/sendTerms.js';
import { executeSendSMS } from './stepExecutors/sendSMS.js';
// Cancellation step executors
import { executeSelectClient } from './stepExecutors/executeSelectClient.js';
import { executeLocateBooking } from './stepExecutors/executeLocateBooking.js';
import { executeInitiateCancellation } from './stepExecutors/executeInitiateCancellation.js';
import { executeFillCancellationForm } from './stepExecutors/executeFillCancellationForm.js';
import { executeNavigateCommunication } from './stepExecutors/executeNavigateCommunication.js';
import { executeSelectTemplate } from './stepExecutors/executeSelectTemplate.js';
import { executeSendCancellationConfirmation } from './stepExecutors/executeSendCancellationConfirmation.js';

export class StepExecutor {
  constructor(screenshotsDir = './screenshots') {
    this.screenshotsDir = screenshotsDir;
  }

  /**
   * Execute a step by name
   * @param {string} stepName - Step name (from STEP_NAMES)
   * @param {Object} page - Playwright page object
   * @param {Object} args - Step arguments
   * @param {Object} sessionState - Current session state
   * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates (holding; never sets waitingForUser)
   * @returns {Promise<Object>} Step execution result
   */
  async executeStep(stepName, page, args, sessionState, progressCallback = null) {
    try {
      // Verify browser state before execution
      await verifyBrowserStateBefore(page, stepName, sessionState);

      // Execute step based on step name
      let result;
      switch (stepName) {
        case 'checkAvailability':
          result = await executeCheckAvailability(page, args, sessionState, this.screenshotsDir, progressCallback);
          break;
        case 'authenticate':
          result = await executeAuthenticate(page, args, sessionState, this.screenshotsDir, progressCallback);
          break;
        case 'navigateContacts':
          result = await executeNavigateContacts(page, args, sessionState, this.screenshotsDir, progressCallback);
          break;
        case 'searchClient':
          result = await executeSearchClient(page, args, sessionState, this.screenshotsDir, progressCallback);
          break;
        case 'selectSession':
          result = await executeSelectSession(page, args, sessionState, this.screenshotsDir, progressCallback);
          break;
        case 'selectBookingOptions':
          result = await executeSelectBookingOptions(page, args, sessionState, this.screenshotsDir, progressCallback);
          break;
        case 'createNewContact':
          result = await executeCreateNewContact(page, args, sessionState, this.screenshotsDir, progressCallback);
          break;
        case 'lookupContact':
          result = await executeLookupContact(page, args, sessionState, this.screenshotsDir, progressCallback);
          break;
        case 'fillContactDetails':
          result = await executeFillContactDetails(page, args, sessionState, this.screenshotsDir, progressCallback);
          break;
        case 'processPayment':
          result = await executeProcessPayment(page, args, sessionState, this.screenshotsDir, progressCallback);
          break;
        case 'sendPaymentRequest':
          result = await executeSendPaymentRequest(page, args, sessionState, this.screenshotsDir, progressCallback);
          break;
        case 'sendConfirmation':
          result = await executeSendConfirmation(page, args, sessionState, this.screenshotsDir, progressCallback);
          break;
        case 'sendTerms':
          result = await executeSendTerms(page, args, sessionState, this.screenshotsDir, progressCallback);
          break;
        case 'sendSMS':
          result = await executeSendSMS(page, args, sessionState, this.screenshotsDir, progressCallback);
          break;
        // Cancellation workflow steps
        case 'selectClient':
          result = await executeSelectClient(page, args, sessionState, this.screenshotsDir);
          break;
        case 'locateBooking':
          result = await executeLocateBooking(page, args, sessionState, this.screenshotsDir);
          break;
        case 'initiateCancellation':
          result = await executeInitiateCancellation(page, args, sessionState, this.screenshotsDir);
          break;
        case 'fillCancellationForm':
          result = await executeFillCancellationForm(page, args, sessionState, this.screenshotsDir);
          break;
        case 'navigateCommunication':
          result = await executeNavigateCommunication(page, args, sessionState, this.screenshotsDir);
          break;
        case 'selectTemplate':
          result = await executeSelectTemplate(page, args, sessionState, this.screenshotsDir);
          break;
        case 'sendCancellationConfirmation':
          result = await executeSendCancellationConfirmation(page, args, sessionState, this.screenshotsDir);
          break;
        default:
          throw new Error(`Unknown step name: ${stepName}`);
      }

      // Verify browser state after execution
      await verifyBrowserStateAfter(page, stepName, result);

      return result;
    } catch (error) {
      console.error(`❌ [STEP_EXECUTOR] Error executing step ${stepName}:`, error);
      

      return {
        success: false,
        error: error.message,
        stepName
      };
    }
  }
}
