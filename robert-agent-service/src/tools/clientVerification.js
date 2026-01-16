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
  getTelephonePrompt,
  getCombinedVerificationPrompt,
  getMissingFieldsPrompt
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

      // CRITICAL FIX: If any fields are missing, return immediately asking for ALL missing fields
      if (missingFields.length > 0) {
        const fieldNames = {
          fullName: 'full name',
          postcode: 'postcode',
          telephoneNumber: 'telephone number'
        };
        
        const missingFieldNames = missingFields.map(f => fieldNames[f]).join(', ');
        const verifiedFields = ['fullName', 'postcode', 'telephoneNumber'].filter(f => !missingFields.includes(f));
        
        // Determine the prompt based on how many fields are missing
        let promptMessage;
        if (missingFields.length === 3) {
          // First call - ask for all three at once
          promptMessage = getCombinedVerificationPrompt();
        } else {
          // Subsequent call - ask for remaining missing fields
          promptMessage = getMissingFieldsPrompt(missingFields);
        }
        
        return {
          success: false,
          verified: false,
          missingFields: missingFields,
          verifiedFields: verifiedFields,
          message: promptMessage,
          instruction: `CRITICAL: Client verification is INCOMPLETE. You have collected: ${verifiedFields.length > 0 ? verifiedFields.map(f => fieldNames[f]).join(', ') : 'none'}. You MUST immediately ask for ALL missing fields: ${missingFieldNames}. Use the exact prompt: "${promptMessage}". Then IMMEDIATELY call client_verification tool again with ALL missing fields filled in. The caller may provide all missing fields in one response, or may provide them partially - extract whatever they provide and call the tool again. Do NOT wait for the user to ask "are you still there" or any other prompt. Continue the verification flow immediately without pausing.`,
          requiresImmediateContinuation: true // Flag to indicate agent must continue immediately
        };
      }

      // CRITICAL: Also check that stored client details have all three required fields
      // If stored details are incomplete, we still require all three fields from the caller
      const storedHasAllFields = !!(storedClientDetails.fullName && 
                                     storedClientDetails.postcode && 
                                     storedClientDetails.telephoneNumber);
      
      if (!storedHasAllFields) {
        const missingStoredFields = [];
        if (!storedClientDetails.fullName) missingStoredFields.push('full name');
        if (!storedClientDetails.postcode) missingStoredFields.push('postcode');
        if (!storedClientDetails.telephoneNumber) missingStoredFields.push('telephone number');
        
        console.log(`⚠️ [${callSid}] Stored client details incomplete - missing: ${missingStoredFields.join(', ')}. Still requiring all three fields for verification.`);
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

      // CRITICAL: All three fields MUST be provided AND verified, regardless of what's stored
      // Verify full name (allow for minor variations, ignore reference numbers/symbols)
      if (!providedName) {
        // Full name not provided - this is already caught by missingFields check, but double-check
        mismatches.push('fullName');
        console.log(`❌ [${callSid}] Full name not provided but required`);
      } else if (storedName && providedName) {
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
      } else {
        // Stored name missing but provided - still count as verified if provided
        verifiedCount++;
        verifiedFields.push('fullName');
        console.log(`✅ [${callSid}] Full name provided (stored name missing)`);
      }

      // Verify postcode (normalize format)
      if (!providedPostcode) {
        // Postcode not provided - this is already caught by missingFields check, but double-check
        mismatches.push('postcode');
        console.log(`❌ [${callSid}] Postcode not provided but required`);
      } else if (storedPostcode && providedPostcode) {
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
      } else {
        // Stored postcode missing but provided - still count as verified if provided
        verifiedCount++;
        verifiedFields.push('postcode');
        console.log(`✅ [${callSid}] Postcode provided (stored postcode missing)`);
      }

      // Verify telephone number (normalize format - remove spaces, dashes, etc.)
      if (!providedTelephone) {
        // Telephone not provided - this is already caught by missingFields check, but double-check
        mismatches.push('telephoneNumber');
        console.log(`❌ [${callSid}] Telephone number not provided but required`);
      } else if (storedTelephone && providedTelephone) {
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
      } else {
        // Stored telephone missing but provided - still count as verified if provided
        verifiedCount++;
        verifiedFields.push('telephoneNumber');
        console.log(`✅ [${callSid}] Telephone number provided (stored telephone missing)`);
      }

      // CRITICAL FIX: Require ALL THREE fields to be provided AND verified
      // verifiedCount must be exactly 3 (all three fields provided)
      // mismatches must be empty (no mismatches)
      // AND all three normalized fields must be non-empty (double-check)
      const allThreeProvided = normalizedFullName && normalizedPostcode && normalizedTelephoneNumber;
      const allVerified = mismatches.length === 0 && verifiedCount === 3 && allThreeProvided;

      if (!allVerified) {
        // If not all verified, check what's missing
        const stillMissing = [];
        if (!normalizedFullName) stillMissing.push('fullName');
        if (!normalizedPostcode) stillMissing.push('postcode');
        if (!normalizedTelephoneNumber) stillMissing.push('telephoneNumber');
        
        if (stillMissing.length > 0) {
          // Some fields still missing - ask for them
          const fieldNames = {
            fullName: 'full name',
            postcode: 'postcode',
            telephoneNumber: 'telephone number'
          };
          const missingFieldNames = stillMissing.map(f => fieldNames[f]).join(', ');
          const promptMessage = getMissingFieldsPrompt(stillMissing);
          
          return {
            success: false,
            verified: false,
            missingFields: stillMissing,
            verifiedFields: verifiedFields,
            message: promptMessage,
            instruction: `CRITICAL: Client verification is INCOMPLETE. You have collected: ${verifiedFields.length > 0 ? verifiedFields.map(f => fieldNames[f]).join(', ') : 'none'}. You MUST immediately ask for ALL missing fields: ${missingFieldNames}. Use the exact prompt: "${promptMessage}". Then IMMEDIATELY call client_verification tool again with ALL missing fields filled in. Do NOT wait for the user to ask "are you still there" or any other prompt. Continue the verification flow immediately without pausing.`,
            requiresImmediateContinuation: true
          };
        }
      }

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
        
        // Default to select_session if no specific next step determined
        if (!nextStepTool && isBookingContext) {
          nextStepTool = 'booking_step_select_session';
        }
        
        return {
          success: true,
          verified: true,
          message: 'You are successfully verified.',
          verifiedFields: verifiedFields,
          requiresBookingContinuation: isBookingContext || undefined,
          nextStepTool: nextStepTool || undefined,
          requiresImmediateNextStep: true // Flag to indicate agent must immediately call next step
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

