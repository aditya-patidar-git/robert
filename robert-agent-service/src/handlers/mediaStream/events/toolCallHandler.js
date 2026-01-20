import toolExecutionService from '../../../services/toolExecutionService.js';
import { WebSocketResultSubmitter } from '../../../services/toolResultSubmitter.js';
import configManager from '../../../agent/configManager.js';
import progressIndicatorService from '../../../services/progressIndicatorService.js';

/**
 * Tool Call Handler
 * Handles tool execution coordination for Media Streams (WebSocket)
 * Delegates execution to ToolExecutionService for code reuse
 */
export class ToolCallHandler {
  constructor(stateManager, openaiWs) {
    this.state = stateManager;
    this.openaiWs = openaiWs;
    this.resultSubmitter = new WebSocketResultSubmitter(openaiWs, stateManager);
  }

  /**
   * Update OpenAI WebSocket reference (called after connection is established)
   */
  setOpenAIWebSocket(openaiWs) {
    this.openaiWs = openaiWs;
    // Update result submitter with new WebSocket reference
    this.resultSubmitter = new WebSocketResultSubmitter(openaiWs, this.state);
  }

  /**
   * Handle function_call output_item.done event
   */
  async handleToolCall(event) {
    const { call_id, name, arguments: args } = event.item;
    
    // Store tool call info for tracking
    const toolStartTime = Date.now();
    this.state.pendingToolCalls.set(call_id, {
      name: name,
      arguments: args,
      startTime: toolStartTime
    });
    
    // Start progress tracking (Media Streams specific)
    // Skip progress tracking for step-based tools to avoid redundant "hold on" messages
    const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
    const isStepBasedTool = name && name.startsWith('booking_step_');
    
    if (conversationBehaviorConfig?.progressIndicators?.enabled && !isStepBasedTool) {
      // Pass stateManager for thread-safe response state checks
      progressIndicatorService.startToolExecution(this.state.callSid, name, this.state);
      
      setTimeout(() => {
        if (!this.state.isClosed && this.openaiWs && this.openaiWs.readyState === 1) {
          const sentAck = progressIndicatorService.checkAndSendAcknowledgment(this.state.callSid, this.openaiWs, conversationBehaviorConfig);
          
          if (!sentAck) {
            const execution = progressIndicatorService.getExecutionInfo(this.state.callSid);
            if (execution) {
              progressIndicatorService.startPeriodicUpdates(this.state.callSid, this.openaiWs, conversationBehaviorConfig);
            }
          }
        }
      }, conversationBehaviorConfig.progressIndicators.acknowledgmentThresholdMs || 2000);
    } else if (isStepBasedTool) {
      console.log(`📊 [${this.state.callSid}] Skipping progress tracking for step-based tool: ${name}`);
    }
    
    // Create progress callback for browser operations
    const progressCallback = (name === 'crm_browser') ? (progress) => {
      if (progress && progress.message && this.openaiWs && this.openaiWs.readyState === 1) {
        progressIndicatorService.sendProgressUpdate(this.state.callSid, progress.message, this.openaiWs);
      }
    } : null;
    
    // Execute tool using unified service
    const executionResult = await toolExecutionService.executeTool({
      callId: call_id,
      callSid: this.state.callSid,
      toolCallId: call_id,
      toolName: name,
      arguments: args,
      phoneNumber: this.state.phoneNumber,
      stateManager: this.state,
      progressCallback: progressCallback
    });
    
    // Handle result submission
    // executionResult format: {success: true/false, result: {...}, error: '...'}
    if (executionResult.success === false) {
      // Submit error result
      await this.resultSubmitter.submitResult(
        this.state.callSid,
        call_id,
        executionResult
      );
      
      // Trigger response if needed - pass tool name and result for special handling
      // CRITICAL FIX: Extract the actual tool result (same as success path) so client_verification
      // missingFields can be detected properly. Some tools like client_verification return
      // {success: false, verified: false, missingFields: [...]} which needs special handling
      // to trigger automatic continuation asking for missing fields.
      await this.resultSubmitter.triggerResponse(this.state.callSid, { 
        toolName: name,
        toolResult: executionResult.result || executionResult // Pass the actual tool result, not the wrapper
      });
      
      // Clean up
      this.state.pendingToolCalls.delete(call_id);
      return;
    }
    
    // Submit success result (executionResult already has success: true and result)
    await this.resultSubmitter.submitResult(
      this.state.callSid,
      call_id,
      executionResult
    );
    
    // Trigger response - pass tool name and result for special handling (e.g., client_verification)
    await this.resultSubmitter.triggerResponse(this.state.callSid, { 
      toolName: name,
      toolResult: executionResult.result || executionResult // Pass the tool result so triggerResponse can check for incomplete verification
    });
    
    // Clean up
    this.state.pendingToolCalls.delete(call_id);
  }

}

