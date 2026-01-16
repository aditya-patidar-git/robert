import { conversations } from '../shared/state.js';
import {
  initializeVerificationAttempts,
  incrementVerificationAttempt,
  isMaxAttemptsExceeded,
  getMaxAttemptsExceededMessage,
  getFieldMismatchMessage,
  markClientVerified,
  getVerificationPrompt,
  getPostcodePrompt,
  getTelephonePrompt
} from '../services/verificationService.js';
import sessionStateManager from '../services/browser/sessionStateManager.js';

/**
 * Get step name from step number (for step-based tools)
 * @param {number} stepNumber - Step number
 * @returns {string} Step name
 */
function getStepName(stepNumber) {
  const stepMap = {
    1: 'authenticate',
    2: 'authenticate', // Step 2 is also authenticate
    3: 'determine_workflow_type',
    4: 'select_session',
    5: 'select_booking_options',
    6: 'search_client', // or create_new_contact for new workflow
    7: 'fill_contact_details',
    8: 'fill_contact_details', // Step 8 is also fill_contact_details
    9: 'process_payment'
  };
  return stepMap[stepNumber] || 'select_session';
}

class ClientVerificationTool {
  /**
   * Verify caller's spoken details against stored CRM client details
   * @param {object} parameters - Tool parameters
   * @param {object} callContext - Call context
   * @returns {Promise<object>} Verification result
   */
  async execute(parameters, callContext = {}) {
    const { fullName, postcode, telephoneNumber } = parameters;
    const { callSid } = callContext;

    if (!callSid) {
      throw new Error('Call SID is required for client verification. This tool must be called during an active call.');
    }

    try {
      // Get stored client details from call context
      const conversation = conversations[callSid];
      if (!conversation) {
        return {
          success: false,
          verified: false,
          error: 'No active conversation found. Please search for client first.',
          message: 'Client details not found. Please search for the client first using mobile number or email.'
        };
      }

      const storedClientDetails = conversation.clientDetails || callContext.clientDetails;
      if (!storedClientDetails) {
        return {
          success: false,
          verified: false,
          error: 'Client details not found in context. Please search for client first.',
          message: 'Client details not found. Please search for the client first using mobile number or email.'
        };
      }

      console.log(`🔐 [${callSid}] Verifying client details:`);
      console.log(`   Stored: name="${storedClientDetails.fullName}", postcode="${storedClientDetails.postcode}", telephone="${storedClientDetails.telephoneNumber}"`);
      console.log(`   Provided: name="${fullName}", postcode="${postcode}", telephone="${telephoneNumber}"`);

      // Initialize verification attempts tracking
      initializeVerificationAttempts(conversation);

      // CRITICAL FIX: Handle "undefined" string case and normalize empty values
      // Sometimes the agent passes the string "undefined" instead of actually omitting the field
      const normalizeField = (value) => {
        if (!value || value === 'undefined' || value === 'null' || (typeof value === 'string' && value.trim() === '')) {
          return null;
        }
        return value.toString().trim();
      };

      const normalizedFullName = normalizeField(fullName);
      const normalizedPostcode = normalizeField(postcode);
      const normalizedTelephoneNumber = normalizeField(telephoneNumber);

      // CRITICAL FIX: Track which fields are missing (not provided or "undefined")
      const missingFields = [];
      if (!normalizedFullName) missingFields.push('fullName');
      if (!normalizedPostcode) missingFields.push('postcode');
      if (!normalizedTelephoneNumber) missingFields.push('telephoneNumber');

      // CRITICAL FIX: If any fields are missing, return immediately asking for them
      if (missingFields.length > 0) {
        const fieldNames = {
          fullName: 'full name',
          postcode: 'postcode',
          telephoneNumber: 'telephone number'
        };
        
        const missingFieldNames = missingFields.map(f => fieldNames[f]).join(', ');
        const verifiedFields = ['fullName', 'postcode', 'telephoneNumber'].filter(f => !missingFields.includes(f));
        
        // Get the next field to ask for based on what's already verified
        let nextFieldToAsk = null;
        let nextPrompt = null;
        
        if (!normalizedFullName) {
          nextFieldToAsk = 'fullName';
          nextPrompt = getVerificationPrompt();
        } else if (!normalizedPostcode) {
          nextFieldToAsk = 'postcode';
          nextPrompt = getPostcodePrompt();
        } else if (!normalizedTelephoneNumber) {
          nextFieldToAsk = 'telephoneNumber';
          nextPrompt = getTelephonePrompt();
        }
        
        return {
          success: false,
          verified: false,
          missingFields: missingFields,
          verifiedFields: verifiedFields,
          nextFieldToAsk: nextFieldToAsk,
          message: nextPrompt || `I still need to verify your ${missingFieldNames}. ${nextPrompt || 'Please provide the missing information.'}`,
          instruction: `CRITICAL: Client verification is INCOMPLETE. You have collected: ${verifiedFields.join(', ') || 'none'}. You MUST immediately ask for the next field: ${nextFieldToAsk}. Use the exact prompt: "${nextPrompt}". Then IMMEDIATELY call client_verification tool again with the ${nextFieldToAsk} field filled in. Do NOT wait for the user to ask "are you still there" or any other prompt. Continue the verification flow immediately without pausing.`,
          requiresImmediateContinuation: true // Flag to indicate agent must continue immediately
        };
      }

      // Normalize strings for comparison (trim, lowercase, remove extra spaces)
      const normalize = (str) => {
        if (!str || str === 'Not found' || str === 'undefined' || str === 'null') return '';
        return str.toString().toLowerCase().trim().replace(/\s+/g, ' ');
      };

      const storedName = normalize(storedClientDetails.fullName);
      const storedPostcode = normalize(storedClientDetails.postcode);
      const storedTelephone = normalize(storedClientDetails.telephoneNumber);

      const providedName = normalize(normalizedFullName || '');
      const providedPostcode = normalize(normalizedPostcode || '');
      const providedTelephone = normalize(normalizedTelephoneNumber || '');

      // Track mismatches and verified fields
      const mismatches = [];
      const verifiedFields = [];
      let verifiedCount = 0;

      // Verify full name (allow for minor variations, ignore reference numbers/symbols)
      if (storedName && providedName) {
        // Remove common prefixes/suffixes and reference numbers for comparison
        const cleanStoredName = storedName.replace(/^(mr|mrs|miss|ms|dr|prof)\s+/i, '').replace(/[#\d]+/g, '').trim();
        const cleanProvidedName = providedName.replace(/^(mr|mrs|miss|ms|dr|prof)\s+/i, '').replace(/[#\d]+/g, '').trim();
        
        if (cleanStoredName === cleanProvidedName || 
            cleanStoredName.includes(cleanProvidedName) || 
            cleanProvidedName.includes(cleanStoredName)) {
          verifiedCount++;
          verifiedFields.push('fullName');
          console.log(`✅ [${callSid}] Full name verified`);
        } else {
          mismatches.push('fullName');
          incrementVerificationAttempt(conversation, 'fullName');
          console.log(`❌ [${callSid}] Full name mismatch: stored="${cleanStoredName}", provided="${cleanProvidedName}"`);
        }
      } else if (storedName) {
        mismatches.push('fullName');
        incrementVerificationAttempt(conversation, 'fullName');
        console.log(`❌ [${callSid}] Full name not provided but required`);
      }

      // Verify postcode (normalize format)
      if (storedPostcode && providedPostcode) {
        // Remove spaces and compare
        const cleanStoredPostcode = storedPostcode.replace(/\s+/g, '').toUpperCase();
        const cleanProvidedPostcode = providedPostcode.replace(/\s+/g, '').toUpperCase();
        
        if (cleanStoredPostcode === cleanProvidedPostcode) {
          verifiedCount++;
          verifiedFields.push('postcode');
          console.log(`✅ [${callSid}] Postcode verified`);
        } else {
          mismatches.push('postcode');
          incrementVerificationAttempt(conversation, 'postcode');
          console.log(`❌ [${callSid}] Postcode mismatch: stored="${cleanStoredPostcode}", provided="${cleanProvidedPostcode}"`);
        }
      } else if (storedPostcode) {
        mismatches.push('postcode');
        incrementVerificationAttempt(conversation, 'postcode');
        console.log(`❌ [${callSid}] Postcode not provided but required`);
      }

      // Verify telephone number (normalize format - remove spaces, dashes, etc.)
      if (storedTelephone && providedTelephone) {
        // Remove all non-digit characters except + for comparison
        const cleanStoredTelephone = storedTelephone.replace(/[^\d+]/g, '').replace(/^\+44/, '0');
        const cleanProvidedTelephone = providedTelephone.replace(/[^\d+]/g, '').replace(/^\+44/, '0');
        
        // Compare last 11 digits (UK mobile format)
        const storedLast11 = cleanStoredTelephone.slice(-11);
        const providedLast11 = cleanProvidedTelephone.slice(-11);
        
        if (storedLast11 === providedLast11 || cleanStoredTelephone === cleanProvidedTelephone) {
          verifiedCount++;
          verifiedFields.push('telephoneNumber');
          console.log(`✅ [${callSid}] Telephone number verified`);
        } else {
          mismatches.push('telephoneNumber');
          incrementVerificationAttempt(conversation, 'telephoneNumber');
          console.log(`❌ [${callSid}] Telephone number mismatch: stored="${storedLast11}", provided="${providedLast11}"`);
        }
      } else if (storedTelephone) {
        mismatches.push('telephoneNumber');
        incrementVerificationAttempt(conversation, 'telephoneNumber');
        console.log(`❌ [${callSid}] Telephone number not provided but required`);
      }

      // CRITICAL FIX: Require ALL THREE fields to be verified (not just 2 out of 3)
      const allVerified = mismatches.length === 0 && verifiedCount === 3;

      if (allVerified) {
        // Mark client as verified using verification service
        markClientVerified(conversation);
        
        console.log(`✅ [${callSid}] Client verification successful - all three fields verified`);
        
        // Check if we're in a booking context
        const isBookingContext = !!conversation?.clientDetails;
        
        // CRITICAL: Check if a booking session is already in progress (step-based tools)
        let bookingSessionInProgress = false;
        let nextStepTool = null;
        if (isBookingContext) {
          try {
            const currentStep = sessionStateManager.getCurrentStep(callSid);
            if (currentStep !== null) {
              bookingSessionInProgress = true;
              // Determine next step based on current step
              // After verification, typically continue with Step 4 (select_session)
              if (currentStep < 4) {
                nextStepTool = 'booking_step_select_session';
              } else {
                // If already past Step 4, continue with the next step in sequence
                const nextStepNumber = currentStep + 1;
                const stepName = getStepName(nextStepNumber);
                nextStepTool = `booking_step_${stepName}`;
              }
            }
          } catch (error) {
            console.warn(`⚠️ [${callSid}] Could not check booking session state:`, error.message);
          }
        }
        
        let baseMessage;
        if (isBookingContext && bookingSessionInProgress) {
          // Booking session already in progress - use step-based tools
          baseMessage = `Identity verified successfully. All details match our records. You have been verified successfully. You must now continue with the booking by calling ${nextStepTool || 'booking_step_select_session'}. Verification is a step in the booking process, not the end. Do NOT say "Booking is confirmed" - the booking workflow continues after verification.`;
        } else if (isBookingContext) {
          // Booking context but no step-based session - fallback to crm_browser (legacy)
          baseMessage = 'Identity verified successfully. All details match our records. You have been verified successfully. You must now continue with the booking by calling crm_browser with task: "create_booking" using the same parameters as before. Verification is a step in the booking process, not the end. Do NOT say "Booking is confirmed" - the booking workflow continues after verification.';
        } else {
          baseMessage = 'Identity verified successfully. All details match our records.';
        }
        
        return {
          success: true,
          verified: true,
          message: baseMessage,
          verifiedFields: verifiedFields,
          requiresBookingContinuation: isBookingContext || undefined,
          nextStepTool: bookingSessionInProgress ? (nextStepTool || 'booking_step_select_session') : undefined
        };
      } else {
        // Check if we've exceeded max attempts (7 per field)
        if (isMaxAttemptsExceeded(conversation)) {
          console.log(`❌ [${callSid}] Maximum verification attempts exceeded`);
          return {
            success: false,
            verified: false,
            maxAttemptsExceeded: true,
            mismatches,
            message: getMaxAttemptsExceededMessage(),
            attempts: conversation.verificationAttempts
          };
        }

        // Provide specific feedback for mismatches using verification service
        const messages = mismatches.map(field => getFieldMismatchMessage(field));

        console.log(`⚠️ [${callSid}] Client verification incomplete. Verified: ${verifiedFields.join(', ') || 'none'}. Mismatches: ${mismatches.join(', ') || 'none'}`);

        // Determine what to ask next
        let nextFieldToAsk = null;
        let nextPrompt = null;
        
        if (mismatches.includes('fullName') || !verifiedFields.includes('fullName')) {
          nextFieldToAsk = 'fullName';
          nextPrompt = getVerificationPrompt();
        } else if (mismatches.includes('postcode') || !verifiedFields.includes('postcode')) {
          nextFieldToAsk = 'postcode';
          nextPrompt = getPostcodePrompt();
        } else if (mismatches.includes('telephoneNumber') || !verifiedFields.includes('telephoneNumber')) {
          nextFieldToAsk = 'telephoneNumber';
          nextPrompt = getTelephonePrompt();
        }

        return {
          success: false,
          verified: false,
          mismatches,
          verifiedFields: verifiedFields,
          nextFieldToAsk: nextFieldToAsk,
          message: messages.length > 0 ? messages.join(' ') : (nextPrompt || 'Please provide the missing verification information.'),
          instruction: `Verification incomplete. Verified fields: ${verifiedFields.join(', ') || 'none'}. Mismatches: ${mismatches.join(', ') || 'none'}. ${nextFieldToAsk ? `Ask for ${nextFieldToAsk} next.` : 'Continue collecting verification information.'}`,
          attempts: conversation.verificationAttempts
        };
      }
    } catch (error) {
      console.error(`❌ [${callSid}] Client verification error:`, error);
      return {
        success: false,
        verified: false,
        error: error.message,
        message: 'An error occurred during verification. Please try again or request a human transfer.'
      };
    }
  }
}

export default new ClientVerificationTool();

