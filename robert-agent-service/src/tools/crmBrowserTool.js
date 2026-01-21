import browserAgentService from '../services/browser/index.js';
import { formatUserFriendlyError, getErrorContext } from '../utils/errorFormatter.js';
import { conversations } from '../shared/state.js';
import sessionStateManager from '../services/browser/sessionStateManager.js';

class CRMBrowserTool {
  async execute(parameters, callContext = {}, progressCallback = null) {
    const { task, args } = parameters;
    const callSid = callContext.callSid || 'unknown';
    const phoneNumber = callContext.phoneNumber || 'unknown';
    
    console.log(`🌐 [${callSid}] CRM Browser Tool: Executing ${task}`);
    console.log(`🌐 [${callSid}] Arguments:`, JSON.stringify(args, null, 2));
    
    // DEPRECATION: Block create_booking task - use booking_step_* tools instead
    if (task === 'create_booking') {
      console.warn(`⚠️ [${callSid}] DEPRECATED: crm_browser create_booking is deprecated. Use booking_step_* tools instead.`);
      
      const currentStep = sessionStateManager.getCurrentStep(callSid);
      if (currentStep !== null) {
        const session = sessionStateManager.getSession(callSid);
        const courseType = session?.courseType || args?.courseType || 'unknown';
        const workflowType = session?.workflowType || args?.workflowType || 'unknown';
        
        console.log(`🚫 [${callSid}] BLOCKING: Booking session already in progress (current step: ${currentStep}). Use step-based tools (booking_step_*) instead of crm_browser.`);
        
        return {
          success: false,
          error: 'A booking process is already in progress for this call. Please continue using the step-based booking tools (booking_step_*) instead of starting a new booking with crm_browser.',
          message: `A booking session is already in progress (currently at step ${currentStep}). Please continue with the booking using the step-based tools. After client verification, call booking_step_select_session to continue.`,
          bookingInProgress: true,
          currentStep: currentStep,
          courseType: courseType,
          workflowType: workflowType,
          nextStepTool: currentStep < 4 ? 'booking_step_select_session' : `Continue with step ${currentStep + 1}`,
          deprecated: true
        };
      }
      
      // No active booking session - return deprecation error
      return {
        success: false,
        error: 'The create_booking task in crm_browser tool is deprecated. Please use the step-based booking tools (booking_step_*) instead. These tools provide better state management and allow resumable workflows.',
        deprecated: true,
        message: 'Please use booking_step_* tools for new bookings. The crm_browser create_booking task is no longer supported.',
        recommendedTools: [
          'booking_step_check_availability',
          'booking_step_authenticate',
          'booking_step_select_session',
          'booking_step_select_booking_options',
          'booking_step_process_payment'
        ]
      };
    }
    
    try {
      // Ensure callSid is in callContext
      if (!callContext.callSid) {
        callContext.callSid = callSid;
      }
      
      // Use progressCallback from parameter, or fallback to callContext
      const finalProgressCallback = progressCallback || callContext.progressCallback || null;
      
      // Call browser agent service with callContext
      const result = await browserAgentService.executeTask(task, args, callContext, finalProgressCallback);
      
      // If the result already indicates failure, return it gracefully
      // BUT check for structured responses first (requiresWorkflowType, requiresPreferences, retryPrompt)
      // These should be preserved and passed through, not replaced with generic error
      if (!result.success) {
        // Check if this is a structured response that should be preserved
        const hasStructuredResponse = result.requiresWorkflowType || 
                                      result.requiresPreferences || 
                                      result.retryPrompt ||
                                      result.requiresVerification;
        
        if (hasStructuredResponse) {
          // This is a structured response (e.g., requiresWorkflowType, requiresPreferences)
          // Preserve all fields and return as-is - don't convert to generic error
          console.log(`✅ [${callSid}] Preserving structured response:`, {
            requiresWorkflowType: result.requiresWorkflowType,
            requiresPreferences: result.requiresPreferences,
            requiresVerification: result.requiresVerification,
            retryPrompt: result.retryPrompt ? 'present' : 'absent'
          });
          
          return {
            success: result.success,
            result: result.result,
            dryRun: result.dryRun || false,
            requiresConfirmation: result.requiresConfirmation || false,
            requiresVerification: result.requiresVerification || false,
            verificationPrompt: result.verificationPrompt,
            retryPrompt: result.retryPrompt,
            requiresCustomerInfo: result.requiresCustomerInfo || false,
            requiresWorkflowType: result.requiresWorkflowType === true || result.requiresWorkflowType === 'true' ? true : false,
            requiresPreferences: result.requiresPreferences === true || result.requiresPreferences === 'true' ? true : false,
            missingPreferences: result.missingPreferences || [],
            validOptions: result.validOptions || {},
            sessionDetails: result.sessionDetails,
            clientDetails: result.clientDetails,
            auditId: result.auditId,
            screenshots: result.screenshots || [],
            courseType: result.courseType,
            error: result.error, // Preserve original error if present
            message: result.message, // CRITICAL: Preserve message for structured responses
            confirmationMessage: result.confirmationMessage || (result.requiresConfirmation ? this.generateConfirmationMessage(result.result) : null)
          };
        }
        
        // This is a genuine error - format it as a user-friendly error
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
        requiresWorkflowType: result.requiresWorkflowType === true || result.requiresWorkflowType === 'true' ? true : false,
        requiresPreferences: result.requiresPreferences === true || result.requiresPreferences === 'true' ? true : false,
        missingPreferences: result.missingPreferences || [],
        validOptions: result.validOptions || {},
        sessionDetails: result.sessionDetails,
        clientDetails: result.clientDetails,
        auditId: result.auditId,
        screenshots: result.screenshots || [],
        courseType: result.courseType,
        error: result.error,
        message: result.message,
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

