import browserAgentService from '../services/browserAgentService.js';
import { formatUserFriendlyError, getErrorContext } from '../utils/errorFormatter.js';
import { conversations } from '../shared/state.js';

class CRMBrowserTool {
  async execute(parameters, callContext = {}) {
    const { task, args } = parameters;
    const callSid = callContext.callSid || 'unknown';
    const phoneNumber = callContext.phoneNumber || 'unknown';
    
    console.log(`🌐 [${callSid}] CRM Browser Tool: Executing ${task}`);
    console.log(`🌐 [${callSid}] Arguments:`, JSON.stringify(args, null, 2));
    
    try {
      // Ensure callSid is in callContext
      if (!callContext.callSid) {
        callContext.callSid = callSid;
      }
      
      // Call browser agent service with callContext
      const result = await browserAgentService.executeTask(task, args, callContext);
      
      // If the result already indicates failure, return it gracefully
      if (!result.success) {
        const errorContext = getErrorContext(
          result.error ? new Error(result.error) : new Error('Unknown error'),
          task
        );
        const userFriendlyError = formatUserFriendlyError(
          result.error ? new Error(result.error) : new Error('Unknown error'),
          errorContext
        );
        
        return {
          success: false,
          error: userFriendlyError,
          technicalError: result.error, // Keep technical error for logging
          dryRun: result.dryRun || false,
          requiresConfirmation: false,
          requiresVerification: result.requiresVerification || false,
          verificationPrompt: result.verificationPrompt,
          retryPrompt: result.retryPrompt,
          requiresCustomerInfo: result.requiresCustomerInfo || false,
          auditId: result.auditId,
          screenshots: result.screenshots || [],
          courseType: result.courseType,
          clientDetails: result.clientDetails
        };
      }
      
      // Track booking consent if dry-run requires confirmation
      if (result.dryRun && result.requiresConfirmation && callSid) {
        const conversation = conversations[callSid];
        if (conversation) {
          if (!conversation.bookingConsent) {
            conversation.bookingConsent = {
              given: false,
              timestamp: null,
              dryRunDiff: null
            };
          }
          // Store dry-run diff for consent
          conversation.bookingConsent.dryRunDiff = result.result || result.diff || null;
        }
      }
      
      return {
        success: result.success,
        result: result.result,
        dryRun: result.dryRun || false,
        requiresConfirmation: result.requiresConfirmation || false,
        requiresVerification: result.requiresVerification || false,
        verificationPrompt: result.verificationPrompt,
        retryPrompt: result.retryPrompt,
        requiresCustomerInfo: result.requiresCustomerInfo || false,
        clientDetails: result.clientDetails,
        auditId: result.auditId,
        screenshots: result.screenshots || [],
        courseType: result.courseType,
        error: result.error,
        confirmationMessage: result.confirmationMessage || (result.requiresConfirmation ? this.generateConfirmationMessage(result.result) : null)
      };
    } catch (error) {
      console.error(`❌ [${callSid}] CRM Browser Tool error:`, error);
      
      // Return error gracefully instead of throwing
      const errorContext = getErrorContext(error, task);
      const userFriendlyError = formatUserFriendlyError(error, errorContext);
      
      return {
        success: false,
        error: userFriendlyError,
        technicalError: error.message, // Keep technical error for logging
        dryRun: true,
        requiresConfirmation: false
      };
    }
  }

  /**
   * Generate confirmation message from dry-run diff
   * @param {object} dryRunResult - Dry-run result containing diff
   * @returns {string} - Formatted confirmation message
   */
  generateConfirmationMessage(dryRunResult) {
    if (!dryRunResult) {
      return 'I\'m ready to proceed with this booking. Shall I confirm this now?';
    }

    const parts = [];
    
    if (dryRunResult.date) {
      parts.push(`Date: ${dryRunResult.date}`);
    }
    if (dryRunResult.time) {
      parts.push(`Time: ${dryRunResult.time}`);
    }
    if (dryRunResult.centre || dryRunResult.location) {
      parts.push(`Location: ${dryRunResult.centre || dryRunResult.location}`);
    }
    if (dryRunResult.fees) {
      parts.push(`Fees: ${dryRunResult.fees}`);
    }
    
    if (parts.length > 0) {
      return `I can confirm this booking: ${parts.join(', ')}. Shall I confirm this now?`;
    }
    
    return 'I\'m ready to proceed with this booking. Shall I confirm this now?';
  }
}

export default new CRMBrowserTool();

