import browserAgentService from '../services/browserAgentService.js';

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
      
      return {
        success: result.success,
        result: result.result,
        dryRun: result.dryRun || false,
        requiresConfirmation: result.requiresConfirmation || false,
        auditId: result.auditId,
        screenshots: result.screenshots || [],
        courseType: result.courseType,
        error: result.error
      };
    } catch (error) {
      console.error(`❌ [${callSid}] CRM Browser Tool error:`, error);
      throw new Error(`CRM browser operation failed: ${error.message}`);
    }
  }
}

export default new CRMBrowserTool();

