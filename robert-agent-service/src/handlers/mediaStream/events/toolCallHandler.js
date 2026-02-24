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
  constructor(stateManager, openaiWs, options = {}) {
    this.state = stateManager;
    this.openaiWs = openaiWs;
    this.onBeforeTriggerResponse = options.onBeforeTriggerResponse;
    this.onWorkflowSwitch = options.onWorkflowSwitch;
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
    
    // Release response lock so the tool-call response doesn't block acks/progress during execution.
    // Progress and acknowledgements can now acquire the lock and keep the caller in the loop.
    this.state.activeResponseId = null;
    this.state.releaseResponseLock();

    // Store tool call info for tracking
    const toolStartTime = Date.now();
    this.state.pendingToolCalls.set(call_id, {
      name: name,
      arguments: args,
      startTime: toolStartTime
    });
    
    const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
    const getWsRef = () => (this.state.isClosed ? null : this.openaiWs);
    progressIndicatorService.scheduleAcknowledgmentAndPeriodicUpdates(
      this.state.callSid,
      name,
      this.openaiWs,
      conversationBehaviorConfig,
      this.state,
      getWsRef
    );
    progressIndicatorService.setPendingFirstProgress(this.state.callSid, name);

    // Path-based progress: enqueue messages; next is sent only after previous response.done (no race with API).
    const progressCallback = conversationBehaviorConfig?.progressIndicators?.enabled && this.openaiWs
      ? (data) => {
          const message = data?.message;
          if (!message || typeof message !== 'string') return;
          progressIndicatorService.enqueueProgressUpdate(this.state.callSid, message);
          progressIndicatorService.trySendNextProgressUpdate(this.state.callSid, this.openaiWs, conversationBehaviorConfig, this.state);
        }
      : null;

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
    try {
      if (executionResult.success === false) {
        // Submit error result
        await this.resultSubmitter.submitResult(
          this.state.callSid,
          call_id,
          executionResult
        );
        
        const effectiveToolName = executionResult.resolvedToolName || name;
        const toolResult = executionResult.result || executionResult;
        if (typeof this.onBeforeTriggerResponse === 'function') {
          this.onBeforeTriggerResponse(this.state.callSid, { toolName: effectiveToolName, toolResult });
        }
        await this.resultSubmitter.triggerResponse(this.state.callSid, { 
          toolName: effectiveToolName,
          toolResult // Pass the actual tool result, not the wrapper
        });

        progressIndicatorService.endToolExecution(this.state.callSid);
        // Clean up
        this.state.pendingToolCalls.delete(call_id);
        return;
      }
      
      const toSubmit = (name === 'booking_step_check_availability' && executionResult.result?.allSlots)
        ? { ...executionResult, result: { ...executionResult.result, allSlots: undefined } }
        : executionResult;
      await this.resultSubmitter.submitResult(
        this.state.callSid,
        call_id,
        toSubmit
      );

      if (name === 'start_workflow' && executionResult.success && executionResult.result?.phase) {
        if (typeof this.onWorkflowSwitch === 'function') {
          this.onWorkflowSwitch(this.state.callSid, executionResult.result.phase);
        }
      }
      
      if (typeof this.onBeforeTriggerResponse === 'function') {
        this.onBeforeTriggerResponse(this.state.callSid);
      }
      const effectiveToolName = executionResult.resolvedToolName || name;
      await this.resultSubmitter.triggerResponse(this.state.callSid, { 
        toolName: effectiveToolName,
        toolResult: executionResult.result || executionResult // Pass the tool result so triggerResponse can check for incomplete verification
      });
      
      // Clean up
      this.state.pendingToolCalls.delete(call_id);
    } catch (error) {
      // CRITICAL RACE CONDITION FIX: Ensure flag is cleared even if submitResult or triggerResponse throw
      console.error(`❌ [${this.state.callSid}] Error submitting tool result for ${name}:`, error);
      progressIndicatorService.endToolExecution(this.state.callSid);
      this.state.clearToolExecutionCompleting();
      this.state.pendingToolCalls.delete(call_id);
      throw error; // Re-throw to maintain error propagation
    }
  }

}
