import browserAgentService from '../services/browserAgentService.js';
import { formatUserFriendlyError, getErrorContext } from '../utils/errorFormatter.js';

class CRMBrowserTool {
  async execute(parameters, callContext = {}) {
    const { task, args } = parameters;
    const callSid = callContext.callSid || 'unknown';
    const phoneNumber = callContext.phoneNumber || 'unknown';
    
    console.log(`🌐 [${callSid}] CRM Browser Tool: Executing ${task}`);
    console.log(`🌐 [${callSid}] Arguments:`, JSON.stringify(args, null, 2));
    
    try {
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
          auditId: result.auditId,
          screenshots: result.screenshots || [],
          courseType: result.courseType
        };
      }
      
      return {
        success: result.success,
        result: result.result,
        dryRun: result.dryRun || false,
        requiresConfirmation: result.requiresConfirmation || false,
        requiresVerification: result.requiresVerification || false,
        clientDetails: result.clientDetails,
        auditId: result.auditId,
        screenshots: result.screenshots || [],
        courseType: result.courseType,
        error: result.error
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
}

export default new CRMBrowserTool();

