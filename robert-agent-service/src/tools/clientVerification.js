import { conversations } from '../shared/state.js';
import {
  initializeVerificationAttempts,
  incrementVerificationAttempt,
  isMaxAttemptsExceeded,
  getMaxAttemptsExceededMessage,
  getFieldMismatchMessage,
  markClientVerified
} from '../services/verificationService.js';

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

      // Normalize strings for comparison (trim, lowercase, remove extra spaces)
      const normalize = (str) => {
        if (!str || str === 'Not found') return '';
        return str.toString().toLowerCase().trim().replace(/\s+/g, ' ');
      };

      const storedName = normalize(storedClientDetails.fullName);
      const storedPostcode = normalize(storedClientDetails.postcode);
      const storedTelephone = normalize(storedClientDetails.telephoneNumber);

      const providedName = normalize(fullName || '');
      const providedPostcode = normalize(postcode || '');
      const providedTelephone = normalize(telephoneNumber || '');

      // Track mismatches
      const mismatches = [];
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

      // Check if all three fields are verified
      const allVerified = mismatches.length === 0 && verifiedCount >= 2; // At least 2 out of 3 must match

      if (allVerified) {
        // Mark client as verified using verification service
        markClientVerified(conversation);
        
        console.log(`✅ [${callSid}] Client verification successful`);
        
        return {
          success: true,
          verified: true,
          message: 'Identity verified successfully. All details match our records.',
          verifiedFields: ['fullName', 'postcode', 'telephoneNumber'].filter(f => !mismatches.includes(f))
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

        console.log(`⚠️ [${callSid}] Client verification failed. Mismatches: ${mismatches.join(', ')}`);

        return {
          success: false,
          verified: false,
          mismatches,
          message: messages.join(' '),
          attempts: conversation.verificationAttempts,
          verifiedFields: ['fullName', 'postcode', 'telephoneNumber'].filter(f => !mismatches.includes(f))
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

