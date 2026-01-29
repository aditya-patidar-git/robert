import { conversations } from '../shared/state.js';
import {
  initializeVerificationAttempts,
  incrementVerificationAttempt,
  isMaxAttemptsExceeded,
  getMaxAttemptsExceededMessage,
  getFieldMismatchMessage,
  getTelephoneLastFourDigitsPrompt,
  markClientVerified,
  getVerificationPrompt,
  getPostcodePrompt,
  getTelephonePrompt,
  getCombinedVerificationPrompt,
  getMissingFieldsPrompt
} from '../services/verificationService.js';
import sessionStateManager from '../services/browser/sessionStateManager.js';
import { getStepName, isCancellationStep } from '../services/browser/stepConfiguration.js';

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

      // Normalize field values (handle "undefined" string case)
      const normalizeField = (value) => {
        if (!value || value === 'undefined' || value === 'null' || (typeof value === 'string' && value.trim() === '')) {
          return null;
        }
        return value.toString().trim();
      };

      const normalizedFullName = normalizeField(fullName);
      const normalizedPostcode = normalizeField(postcode);
      const normalizedTelephoneNumber = normalizeField(telephoneNumber);

      // CRITICAL: Initialize sequential verification state
      // Track which field we're currently asking for and which have been verified
      if (!conversation.verificationState) {
        conversation.verificationState = {
          currentField: 'fullName', // Start with fullName
          verifiedFields: {
            fullName: false,
            postcode: false,
            telephoneNumber: false
          },
          verifiedValues: {
            fullName: null,
            postcode: null,
            telephoneNumber: null
          },
          askedLastFourDigitsForTelephone: false
        };
      }

      const verificationState = conversation.verificationState;
      const currentField = verificationState.currentField;
      const verifiedFields = verificationState.verifiedFields;
      const workflowContext = conversation.workflowContext || 'booking';

      // Helper functions for validation (extracted for reusability)
      const normalizeForComparison = (str) => {
        if (!str) return '';
        return str.toString().trim().toLowerCase().replace(/\s+/g, '');
      };

      const normalizeForNameComparison = (str) => {
        if (!str || str === 'Not found' || str === 'undefined' || str === 'null') return '';
        const normalized = str.toString().toLowerCase().trim().replace(/\s+/g, ' ');
        // Remove common prefixes/suffixes and reference numbers
        return normalized.replace(/^(mr|mrs|miss|ms|dr|prof)\s+/i, '').replace(/[#\d]+/g, '').trim();
      };

      const normalizeForPostcodeComparison = (str) => {
        if (!str) return '';
        return str.toString().replace(/\s+/g, '').toUpperCase();
      };

      const normalizeForTelephoneComparison = (str) => {
        if (!str) return '';
        const cleaned = str.toString().replace(/[^\d+]/g, '').replace(/^\+44/, '0');
        return cleaned.slice(-11); // Last 11 digits (UK mobile format)
      };

      // SEQUENTIAL VALIDATION: Validate fields one by one in order
      // 1. Validate fullName first (if not already verified)
      if (!verifiedFields.fullName) {
        if (!normalizedFullName) {
          // FullName not provided - ask for it
          return {
            success: false,
            verified: false,
            missingFields: ['fullName'],
            verifiedFields: [],
            currentField: 'fullName',
            message: getVerificationPrompt(),
            instruction: `CRITICAL: Start verification by asking for full name. Use the exact prompt: "${getVerificationPrompt()}". Then call client_verification with ONLY the fullName parameter when the caller provides it.`,
            requiresImmediateContinuation: true
          };
        }

        // Validate fullName against stored
        const storedName = normalizeForNameComparison(storedClientDetails.fullName || '');
        const providedName = normalizeForNameComparison(normalizedFullName);
        
        if (storedName === providedName || 
            storedName.includes(providedName) || 
            providedName.includes(storedName)) {
          // FullName verified - mark as verified and move to postcode
          verifiedFields.fullName = true;
          verificationState.verifiedValues.fullName = normalizedFullName;
          verificationState.currentField = 'postcode';
          console.log(`✅ [${callSid}] Full name verified: "${normalizedFullName}"`);
        } else {
          // FullName mismatch - increment attempts and ask again
          incrementVerificationAttempt(conversation, 'fullName');
          console.log(`❌ [${callSid}] Full name mismatch: stored="${storedName}", provided="${providedName}"`);
          
          if (isMaxAttemptsExceeded(conversation)) {
            return {
              success: false,
              verified: false,
              maxAttemptsExceeded: true,
              message: getMaxAttemptsExceededMessage(workflowContext),
              attempts: conversation.verificationAttempts
            };
          }
          
          return {
            success: false,
            verified: false,
            missingFields: ['fullName'],
            verifiedFields: [],
            currentField: 'fullName',
            mismatches: ['fullName'],
            message: getFieldMismatchMessage('fullName'),
            instruction: `Full name does not match. Use the exact message: "${getFieldMismatchMessage('fullName')}". Then ask again: "${getVerificationPrompt()}". Call client_verification again with the fullName parameter when caller provides it.`,
            attempts: conversation.verificationAttempts,
            requiresImmediateContinuation: true
          };
        }
      }

      // 2. Validate postcode (if fullName is verified and postcode not yet verified)
      if (verifiedFields.fullName && !verifiedFields.postcode) {
        if (!normalizedPostcode) {
          // Postcode not provided - ask for it
          return {
            success: false,
            verified: false,
            missingFields: ['postcode'],
            verifiedFields: ['fullName'],
            currentField: 'postcode',
            message: getPostcodePrompt(),
            instruction: `Full name verified. Now ask for postcode. Use the exact prompt: "${getPostcodePrompt()}". Then call client_verification with fullName="${verificationState.verifiedValues.fullName}" and postcode parameter when caller provides it.`,
            requiresImmediateContinuation: true
          };
        }

        // Validate postcode against stored
        const storedPostcode = normalizeForPostcodeComparison(storedClientDetails.postcode || '');
        const providedPostcode = normalizeForPostcodeComparison(normalizedPostcode);
        
        if (storedPostcode === providedPostcode) {
          // Postcode verified - mark as verified and move to telephoneNumber
          verifiedFields.postcode = true;
          verificationState.verifiedValues.postcode = normalizedPostcode;
          verificationState.currentField = 'telephoneNumber';
          console.log(`✅ [${callSid}] Postcode verified: "${normalizedPostcode}"`);
        } else {
          // Postcode mismatch - increment attempts and ask again
          incrementVerificationAttempt(conversation, 'postcode');
          console.log(`❌ [${callSid}] Postcode mismatch: stored="${storedPostcode}", provided="${providedPostcode}"`);
          
          if (isMaxAttemptsExceeded(conversation)) {
            return {
              success: false,
              verified: false,
              maxAttemptsExceeded: true,
              message: getMaxAttemptsExceededMessage(workflowContext),
              attempts: conversation.verificationAttempts
            };
          }
          
          return {
            success: false,
            verified: false,
            missingFields: ['postcode'],
            verifiedFields: ['fullName'],
            currentField: 'postcode',
            mismatches: ['postcode'],
            message: getFieldMismatchMessage('postcode'),
            instruction: `Postcode does not match. Use the exact message: "${getFieldMismatchMessage('postcode')}". Then ask again: "${getPostcodePrompt()}". Call client_verification again with fullName="${verificationState.verifiedValues.fullName}" and postcode parameter when caller provides it.`,
            attempts: conversation.verificationAttempts,
            requiresImmediateContinuation: true
          };
        }
      }

      // 3. Validate telephoneNumber (if fullName and postcode are verified)
      if (verifiedFields.fullName && verifiedFields.postcode && !verifiedFields.telephoneNumber) {
        if (!normalizedTelephoneNumber) {
          // TelephoneNumber not provided - ask for it
          return {
            success: false,
            verified: false,
            missingFields: ['telephoneNumber'],
            verifiedFields: ['fullName', 'postcode'],
            currentField: 'telephoneNumber',
            message: getTelephonePrompt(),
            instruction: `Full name and postcode verified. Now ask for telephone number. Use the exact prompt: "${getTelephonePrompt()}". Then call client_verification with fullName="${verificationState.verifiedValues.fullName}", postcode="${verificationState.verifiedValues.postcode}", and telephoneNumber parameter when caller provides it.`,
            requiresImmediateContinuation: true
          };
        }

        // Validate telephoneNumber against stored
        const storedTelephone = normalizeForTelephoneComparison(storedClientDetails.telephoneNumber || '');
        const providedTelephone = normalizeForTelephoneComparison(normalizedTelephoneNumber);
        
        if (storedTelephone === providedTelephone && storedTelephone.length >= 10) {
          // TelephoneNumber verified - all three fields verified!
          verifiedFields.telephoneNumber = true;
          verificationState.verifiedValues.telephoneNumber = normalizedTelephoneNumber;
          console.log(`✅ [${callSid}] Telephone number verified: "${normalizedTelephoneNumber}"`);
          
          // Mark client as verified
          markClientVerified(conversation);
          
          console.log(`✅ [${callSid}] Client verification successful - all three fields verified sequentially`);
          
          // Check if we're in a cancellation workflow
          let isCancellationWorkflow = false;
          try {
            const currentStep = sessionStateManager.getCurrentStep(callSid);
            const session = sessionStateManager.getSession(callSid);
            if (currentStep !== null && session?.courseType) {
              const stepName = getStepName(session.courseType, session.workflowType || 'existing', currentStep);
              isCancellationWorkflow = isCancellationStep(stepName);
            }
          } catch (error) {
            console.warn(`⚠️ [${callSid}] Could not check workflow type:`, error.message);
          }
          
          // Check if we're in a booking context
          const isBookingContext = !!conversation?.clientDetails;
          let nextStepTool = null;
          if (isBookingContext && !isCancellationWorkflow) {
            try {
              const currentStep = sessionStateManager.getCurrentStep(callSid);
              if (currentStep !== null && currentStep < 4) {
                nextStepTool = 'booking_step_select_session';
              }
            } catch (error) {
              console.warn(`⚠️ [${callSid}] Could not check booking session state:`, error.message);
            }
          }
          
          if (!nextStepTool && isBookingContext && !isCancellationWorkflow) {
            nextStepTool = 'booking_step_select_session';
          }
          
          const verificationMessage = isCancellationWorkflow
            ? 'You are successfully verified. Would you like to proceed with cancelling your booking? Please say yes or no.'
            : 'You are successfully verified. Would you like to proceed with your booking? Please say yes or no.';
          
          return {
            success: true,
            verified: true,
            message: verificationMessage,
            verifiedFields: ['fullName', 'postcode', 'telephoneNumber'],
            requiresBookingContinuation: isBookingContext || undefined,
            nextStepTool: nextStepTool || undefined,
            requiresExplicitConfirmation: true,
            requiresImmediateNextStep: false,
            offerUpdatePhone: true,
            offerUpdatePhoneInstruction: 'Ask the caller: "Would you like us to update your telephone number to the one you just provided?" If they say yes, collect their new UK mobile (11 digits starting with 07) and call the update_customer tool with telephoneNumber set to the new number and customerEmail or customerMobile to identify the customer.'
          };
        } else {
          // TelephoneNumber mismatch - first offer last-four-digits confirmation per doc (A)
          if (!verificationState.askedLastFourDigitsForTelephone) {
            verificationState.askedLastFourDigitsForTelephone = true;
            const lastFour = storedTelephone.slice(-4);
            const lastFourPrompt = getTelephoneLastFourDigitsPrompt(lastFour);
            console.log(`❌ [${callSid}] Telephone mismatch - asking for last four digits confirmation`);
            return {
              success: false,
              verified: false,
              missingFields: ['telephoneNumber'],
              verifiedFields: ['fullName', 'postcode'],
              currentField: 'telephoneNumber',
              offerLastFourDigitsConfirmation: true,
              lastFourDigits: lastFour,
              message: lastFourPrompt,
              instruction: `Use the exact message: "${lastFourPrompt}". Then call client_verification again with fullName="${verificationState.verifiedValues.fullName}", postcode="${verificationState.verifiedValues.postcode}", and telephoneNumber when caller provides the full number.`,
              requiresImmediateContinuation: true
            };
          }

          incrementVerificationAttempt(conversation, 'telephoneNumber');
          console.log(`❌ [${callSid}] Telephone number mismatch: stored="${storedTelephone}", provided="${providedTelephone}"`);

          if (isMaxAttemptsExceeded(conversation)) {
            return {
              success: false,
              verified: false,
              maxAttemptsExceeded: true,
              message: getMaxAttemptsExceededMessage(workflowContext),
              attempts: conversation.verificationAttempts
            };
          }

          return {
            success: false,
            verified: false,
            missingFields: ['telephoneNumber'],
            verifiedFields: ['fullName', 'postcode'],
            currentField: 'telephoneNumber',
            mismatches: ['telephoneNumber'],
            message: getFieldMismatchMessage('telephoneNumber'),
            instruction: `Telephone number does not match. Use the exact message: "${getFieldMismatchMessage('telephoneNumber')}". Then ask again: "${getTelephonePrompt()}". Call client_verification again with fullName="${verificationState.verifiedValues.fullName}", postcode="${verificationState.verifiedValues.postcode}", and telephoneNumber parameter when caller provides it.`,
            attempts: conversation.verificationAttempts,
            requiresImmediateContinuation: true
          };
        }
      }

      // If we reach here, all fields should be verified
      if (verifiedFields.fullName && verifiedFields.postcode && verifiedFields.telephoneNumber) {
        markClientVerified(conversation);
        
        // Check if we're in a cancellation workflow
        let isCancellationWorkflow = false;
        try {
          const currentStep = sessionStateManager.getCurrentStep(callSid);
          const session = sessionStateManager.getSession(callSid);
          if (currentStep !== null && session?.courseType) {
            const stepName = getStepName(session.courseType, session.workflowType || 'existing', currentStep);
            isCancellationWorkflow = isCancellationStep(stepName);
          }
        } catch (error) {
          console.warn(`⚠️ [${callSid}] Could not check workflow type:`, error.message);
        }
        
        const verificationMessage = isCancellationWorkflow
          ? 'You are successfully verified. Would you like to proceed with cancelling your booking? Please say yes or no.'
          : 'You are successfully verified. Would you like to proceed with your booking? Please say yes or no.';
        
        return {
          success: true,
          verified: true,
          message: verificationMessage,
          verifiedFields: ['fullName', 'postcode', 'telephoneNumber'],
          requiresExplicitConfirmation: true
        };
      }

      // Fallback - should not reach here
      return {
        success: false,
        verified: false,
        error: 'Unexpected verification state',
        message: 'Please provide your verification details.'
      };
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

