/**
 * Search Client Step Executor
 * Handles client search and verification
 * Preserves all Playwright timing and state checks
 */

import * as commonSteps from '../../../commonBookingSteps/index.js';

/**
 * Execute searchClient step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<Object>} Step execution result
 */
export async function executeSearchClient(page, args, sessionState, screenshotsDir, progressCallback = null) {
  progressCallback?.({ message: 'Opening the client search.' });
  // Determine search type and value
  let searchType = null;
  let searchValue = null;
  let email = null;
  
  if (args.customerMobile || args.customerPhone) {
    searchType = 'mobile';
    searchValue = args.customerMobile || args.customerPhone;
  } else if (args.customerEmail) {
    searchType = 'email';
    searchValue = args.customerEmail;
    email = args.customerEmail;
  } else if (args.customerName) {
    searchType = 'name';
    searchValue = args.customerName;
  } else {
    return {
      success: false,
      error: 'Either customerMobile, customerEmail, or customerName is required for client search'
    };
  }
  
  // Get callSid from args or extract from browserSessionId if available
  let callSid = args.callSid || null;
  if (!callSid && sessionState?.browserSessionId) {
    // Extract callSid from browserSessionId pattern: browser_{callSid}_{timestamp}
    const match = sessionState.browserSessionId.match(/^browser_(.+?)_\d+$/);
    if (match) {
      callSid = match[1];
    }
  }
  
  // CRITICAL FIX: Check if client was already found in a previous search attempt
  // This handles the case where a timeout occurred but the search completed successfully
  if (callSid) {
    const { conversations } = await import('../../../../shared/state.js');
    if (conversations[callSid]?.clientDetails) {
      console.log(`✅ [searchClient] Client already found in previous search, using existing client details`);
      return {
        success: true,
        clientDetails: conversations[callSid].clientDetails,
        requiresVerification: true,
        verificationPrompt: 'I found your profile. Can you please confirm your postcode to verify your identity?'
      };
    }
  }
  
  try {
    // Call findAndVerifyClient with correct parameters
    const result = await commonSteps.findAndVerifyClient(
      page, 
      searchType, 
      searchValue, 
      screenshotsDir,
      email,
      null, // clientPostcode
      callSid,
      progressCallback
    );

    // Wrap result to match expected format
    if (result.found) {
      // Store client details in conversation state for future reference
      // This prevents the "not found" error if a timeout occurs but search completes
      if (callSid) {
        const { conversations } = await import('../../../../shared/state.js');
        if (conversations[callSid]) {
          conversations[callSid].clientDetails = result.clientDetails;
        }
      }
      
      return {
        success: true,
        clientDetails: result.clientDetails,
        requiresVerification: result.requiresVerification,
        verificationPrompt: result.verificationPrompt
      };
    } else {
      // Only return retry prompt if we haven't exhausted attempts
      // Don't return retry prompt if client was already found (handled above)
      return {
        success: false,
        error: result.error || 'Client not found',
        retryPrompt: result.retryPrompt,
        nextSearchType: result.nextSearchType,
        requiresPostcodeVerification: result.requiresPostcodeVerification
      };
    }
  } catch (error) {
    // CRITICAL FIX: If timeout occurs, check if client was already found
    if (error.message && (error.message.includes('timeout') || error.message.includes('exceeded'))) {
      console.log(`⚠️ [searchClient] Timeout occurred, checking if client was already found...`);
      
      // Check if client details were stored during the search process
      if (callSid) {
        const { conversations } = await import('../../../../shared/state.js');
        if (conversations[callSid]?.clientDetails) {
          console.log(`✅ [searchClient] Client was found before timeout, using stored details`);
          return {
            success: true,
            clientDetails: conversations[callSid].clientDetails,
            requiresVerification: true,
            verificationPrompt: 'I found your profile. Can you please confirm your postcode to verify your identity?'
          };
        }
      }
    }
    
    // If no client found, return error
    return {
      success: false,
      error: error.message || 'Client search failed',
      retryPrompt: 'Unfortunately, I could not locate your profile with us with the provided mobile number, could you please repeat your full mobile number to me so that I can try again?'
    };
  }
}
