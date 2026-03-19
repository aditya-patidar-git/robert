import toolExecutionService from '../../../services/toolExecutionService.js';
import { WebSocketResultSubmitter } from '../../../services/toolResultSubmitter.js';
import configManager from '../../../agent/configManager.js';
import { conversations } from '../../../shared/state.js';
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
    this.onAfterToolComplete = options.onAfterToolComplete;
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

    // Clear pending premature question when the expected tool is invoked (e.g. bike type question → select_booking_options)
    if (name === 'booking_step_select_booking_options' && conversations[this.state.callSid]?.pendingPrematureQuestion) {
      delete conversations[this.state.callSid].pendingPrematureQuestion;
    }
    
    // Release response lock and clear response state so only the tool is active during execution.
    // This ensures periodic updates can acquire the lock when they fire.
    this.state.activeResponseId = null;
    this.state.isResponding = false;
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
    const hasProgressConfig = !!conversationBehaviorConfig?.progressIndicators?.enabled;
    console.log(`[PROGRESS] [${this.state.callSid}] handleToolCall: tool=${name}, progressIndicators.enabled=${hasProgressConfig}`);

    progressIndicatorService.scheduleAcknowledgmentAndPeriodicUpdates(
      this.state.callSid,
      name,
      this.openaiWs,
      conversationBehaviorConfig,
      this.state,
      getWsRef
    );

    const progressCallback = ({ message }) => {
      // [PROGRESS] Extensive logging to pinpoint queue-driven update flow
      const sid = this.state.callSid;
      if (!message) {
        console.log(`[PROGRESS] [${sid}] progressCallback invoked but SKIP: message empty`);
        return;
      }
      if (this.state.toolExecutionCompleting) {
        console.log(`[PROGRESS] [${sid}] progressCallback invoked but SKIP: toolExecutionCompleting=true`);
        return;
      }
      if (this.state.isInterrupted) {
        console.log(`[PROGRESS] [${sid}] progressCallback invoked but SKIP: isInterrupted=true`);
        return;
      }
      if (this.state.isClosed) {
        console.log(`[PROGRESS] [${sid}] progressCallback invoked but SKIP: isClosed=true`);
        return;
      }
      if (this.state.progressQueue.length >= 10) {
        console.log(`[PROGRESS] [${sid}] progressCallback invoked but SKIP: queue full (${this.state.progressQueue.length} >= 10)`);
        return;
      }
      this.state.progressQueue.push({ message, queuedAt: Date.now() });
      console.log(`📥 [${sid}] Progress queued: "${message}" (queue depth: ${this.state.progressQueue.length})`);
      progressIndicatorService.scheduleQueuedProgressUpdate(this.state.callSid);
    };

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

    // Call ended during execution: do not submit or trigger response
    if (executionResult?.callEnded === true) {
      progressIndicatorService.endToolExecution(this.state.callSid);
      this.state.pendingToolCalls.delete(call_id);
      return;
    }
    
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
        const toolContext = { toolName: effectiveToolName, toolResult };
        if (typeof this.onBeforeTriggerResponse === 'function') {
          this.onBeforeTriggerResponse(this.state.callSid, toolContext);
        }
        await this.resultSubmitter.triggerResponse(this.state.callSid, {
          toolName: effectiveToolName,
          toolResult,
          onComplete: typeof this.onAfterToolComplete === 'function'
            ? (phase) => this.onAfterToolComplete(this.state.callSid, toolContext, phase)
            : undefined
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
      
      const effectiveToolName = executionResult.resolvedToolName || name;
      const toolContext = { toolName: effectiveToolName, toolResult: executionResult.result || executionResult };
      if (typeof this.onBeforeTriggerResponse === 'function') {
        this.onBeforeTriggerResponse(this.state.callSid, toolContext);
      }
      await this.resultSubmitter.triggerResponse(this.state.callSid, {
        toolName: effectiveToolName,
        toolResult: toolContext.toolResult,
        onComplete: typeof this.onAfterToolComplete === 'function'
          ? (phase) => this.onAfterToolComplete(this.state.callSid, toolContext, phase)
          : undefined
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
