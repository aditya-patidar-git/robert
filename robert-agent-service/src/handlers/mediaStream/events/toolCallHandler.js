import toolExecutor from '../../../tools/index.js';
import configManager from '../../../agent/configManager.js';
import kbaService from '../../../services/kbaService.js';
import progressIndicatorService from '../../../services/progressIndicatorService.js';
import turnTakingStateMachine, { STATES } from '../../../services/turnTakingStateMachine.js';

/**
 * Tool Call Handler
 * Handles tool execution coordination
 */
export class ToolCallHandler {
  constructor(stateManager, openaiWs) {
    this.state = stateManager;
    this.openaiWs = openaiWs;
  }

  /**
   * Handle function_call output_item.done event
   */
  async handleToolCall(event) {
    const { call_id, name, arguments: args } = event.item;
    console.log(`\n🔧 [${this.state.callSid}] ========================================`);
    console.log(`🔧 [${this.state.callSid}] TOOL INVOCATION DETECTED`);
    console.log(`🔧 [${this.state.callSid}] Tool: ${name}`);
    console.log(`🔧 [${this.state.callSid}] Call ID: ${call_id}`);
    console.log(`🔧 [${this.state.callSid}] Phone: ${this.state.phoneNumber || 'unknown'}`);
    console.log(`🔧 [${this.state.callSid}] Raw Arguments: ${args || '{}'}`);
    
    // Parse arguments JSON string
    let parameters = {};
    try {
      if (!args || args.trim() === '') {
        parameters = {};
      } else {
        parameters = JSON.parse(args);
      }
      console.log(`🔧 [${this.state.callSid}] Parsed Parameters:`, JSON.stringify(parameters, null, 2));
    } catch (parseError) {
      console.error(`❌ [${this.state.callSid}] Failed to parse tool arguments for ${name}:`, parseError);
      
      // Submit error result
      if (this.openaiWs && this.openaiWs.readyState === 1) {
        this.openaiWs.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: call_id,
            output: JSON.stringify({
              success: false,
              error: `Failed to parse tool arguments: ${parseError.message}`,
              raw_args_preview: args ? args.substring(0, 100) : 'null'
            })
          }
        }));
        
        if (!this.state.isResponding && this.state.activeResponseId === null && !this.state.isClosed) {
          this.state.isResponding = true;
          this.state.explicitResponseRequested = true;
          this.openaiWs.send(JSON.stringify({
            type: 'response.create'
          }));
        }
      }
      
      // Remove from pending
      this.state.pendingToolCalls.delete(call_id);
      return;
    }
    
    // Check for duplicate calls
    const isDuplicate = this.checkDuplicateCall(name, parameters);
    if (isDuplicate) {
      console.log(`⚠️ [${this.state.callSid}] DUPLICATE CALL DETECTED: ${name} with same parameters - ignoring`);
      return;
    }
    
    // Store tool call info
    const toolStartTime = Date.now();
    this.state.pendingToolCalls.set(call_id, {
      name: name,
      arguments: args,
      startTime: toolStartTime
    });
    
    // Start progress tracking
    const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
    if (conversationBehaviorConfig?.progressIndicators?.enabled) {
      progressIndicatorService.startToolExecution(this.state.callSid, name);
      
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
    }
    
    console.log(`🔧 [${this.state.callSid}] Starting tool execution: ${name}`);
    console.log(`🔧 [${this.state.callSid}] ========================================\n`);
    
    // Initialize state machine
    const currentState = turnTakingStateMachine.getCurrentState(this.state.callSid);
    if (currentState === null) {
      turnTakingStateMachine.initialize(this.state.callSid);
    }
    turnTakingStateMachine.transition(this.state.callSid, STATES.TOOL_EXECUTING, { toolName: name });
    
    // Check if KBA is required
    if (kbaService.requiresKBA(name, parameters)) {
      const isKBAVerified = kbaService.isKBAVerified(this.state.callSid);
      
      if (!isKBAVerified) {
        console.log(`🔐 [${this.state.callSid}] KBA required for tool ${name} but not verified. Blocking execution.`);
        
        if (this.openaiWs && this.openaiWs.readyState === 1) {
          this.openaiWs.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: call_id,
              output: JSON.stringify({
                success: false,
                error: 'KBA_REQUIRED',
                message: 'Identity verification is required before accessing or changing personal booking data. Please use the kba_verification tool first with your email, postcode, and booking reference (if available).',
                requiresKBA: true
              })
            }
          }));
          
          if (!this.state.isResponding && this.state.activeResponseId === null && !this.state.isClosed) {
            this.state.isResponding = true;
            this.state.explicitResponseRequested = true;
            this.openaiWs.send(JSON.stringify({
              type: 'response.create'
            }));
          }
        }
        
        this.state.pendingToolCalls.delete(call_id);
        return;
      } else {
        console.log(`✅ [${this.state.callSid}] KBA verified for tool ${name}. Proceeding with execution.`);
      }
    }
    
    // Execute tool
    const { conversations } = await import('../../../shared/state.js');
    const conversation = conversations[this.state.callSid] || {};
    const callContext = {
      callSid: this.state.callSid,
      phoneNumber: this.state.phoneNumber,
      clientDetails: conversation.clientDetails,
      clientVerified: conversation.clientVerified || false
    };
    
    // Create progress callback for browser operations
    const progressCallback = (name === 'crm_browser') ? (progress) => {
      if (progress && progress.message && this.openaiWs && this.openaiWs.readyState === 1) {
        progressIndicatorService.sendProgressUpdate(this.state.callSid, progress.message, this.openaiWs);
      }
    } : null;
    
    // Check for active execution
    const activeExecution = this.state.activeToolExecutions.get(name);
    if (activeExecution) {
      const elapsedTime = Date.now() - activeExecution.startTime;
      console.log(`🚫 [${this.state.callSid}] BLOCKING duplicate tool call: ${name} is already executing`);
      
      if (this.openaiWs && this.openaiWs.readyState === 1) {
        this.openaiWs.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: call_id,
            output: JSON.stringify({
              success: false,
              error: `The ${name} tool is already executing. Please wait for it to complete.`,
              toolAlreadyExecuting: true
            })
          }
        }));
        
        if (!this.state.isResponding && this.state.activeResponseId === null && !this.state.isClosed) {
          this.state.isResponding = true;
          this.state.explicitResponseRequested = true;
          this.openaiWs.send(JSON.stringify({
            type: 'response.create'
          }));
        }
      }
      
      this.state.pendingToolCalls.delete(call_id);
      progressIndicatorService.endToolExecution(this.state.callSid);
      return;
    }
    
    // Mark tool as active
    this.state.activeToolExecutions.set(name, {
      call_id: call_id,
      startTime: Date.now(),
      callSid: this.state.callSid
    });
    
    // Execute tool
    toolExecutor.execute(name, parameters, callContext, progressCallback)
      .then(async (executionResult) => {
        await this.handleToolResult(call_id, name, executionResult);
      })
      .catch(async (error) => {
        await this.handleToolError(call_id, name, error);
      });
  }

  /**
   * Check for duplicate tool calls
   */
  checkDuplicateCall(name, parameters) {
    if (!this.state.recentToolCalls.has(this.state.callSid)) {
      this.state.recentToolCalls.set(this.state.callSid, []);
    }
    const recentCalls = this.state.recentToolCalls.get(this.state.callSid);
    const now = Date.now();
    const DUPLICATE_CALL_WINDOW_MS = 5000; // 5 seconds
    
    // Remove old calls
    const filteredCalls = recentCalls.filter(call => (now - call.timestamp) < DUPLICATE_CALL_WINDOW_MS);
    this.state.recentToolCalls.set(this.state.callSid, filteredCalls);
    
    // Check for duplicate
    const isDuplicate = filteredCalls.some(call => {
      if (call.name !== name) return false;
      try {
        return JSON.stringify(call.parameters) === JSON.stringify(parameters);
      } catch (e) {
        return false;
      }
    });
    
    if (!isDuplicate) {
      recentCalls.push({ name, parameters: JSON.parse(JSON.stringify(parameters)), timestamp: now });
    }
    
    return isDuplicate;
  }

  /**
   * Handle tool execution result
   */
  async handleToolResult(call_id, name, executionResult) {
    if (this.state.isClosed || !this.openaiWs || this.openaiWs.readyState !== 1) {
      return;
    }
    
    const { conversations } = await import('../../../shared/state.js');
    
    // Store client details if returned
    if (name === 'crm_browser' && executionResult.success && executionResult.result) {
      if (executionResult.result.clientDetails) {
        if (!conversations[this.state.callSid]) {
          conversations[this.state.callSid] = {};
        }
        conversations[this.state.callSid].clientDetails = executionResult.result.clientDetails;
      }
      
      // Store availability data
      if (executionResult.result.sessionDetails || executionResult.result.selectedSlot || executionResult.result.allSlots) {
        if (!conversations[this.state.callSid]) {
          conversations[this.state.callSid] = {};
        }
        conversations[this.state.callSid].lastAvailabilityCheck = {
          allSlots: executionResult.result.allSlots,
          selectedSlot: executionResult.result.selectedSlot || executionResult.result.sessionDetails,
          sessionDetails: executionResult.result.selectedSlot || executionResult.result.sessionDetails
        };
      }
    }
    
    // Submit result
    const output = JSON.stringify(executionResult);
    this.openaiWs.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: call_id,
        output: output
      }
    }));
    
    console.log(`✅ [${this.state.callSid}] Tool ${name} completed successfully`);
    
    // Clean up
    this.state.pendingToolCalls.delete(call_id);
    this.state.activeToolExecutions.delete(name);
    progressIndicatorService.endToolExecution(this.state.callSid);
    turnTakingStateMachine.transition(this.state.callSid, STATES.WAITING_FOR_USER);
    
    // Trigger response
    if (!this.state.isResponding && this.state.activeResponseId === null && !this.state.isClosed) {
      this.state.isResponding = true;
      this.state.explicitResponseRequested = true;
      this.openaiWs.send(JSON.stringify({
        type: 'response.create'
      }));
    }
  }

  /**
   * Handle tool execution error
   */
  async handleToolError(call_id, name, error) {
    console.error(`❌ [${this.state.callSid}] Tool ${name} execution error:`, error);
    
    if (this.state.isClosed || !this.openaiWs || this.openaiWs.readyState !== 1) {
      return;
    }
    
    // Submit error result
    this.openaiWs.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: call_id,
        output: JSON.stringify({
          success: false,
          error: error.message || 'Tool execution failed',
          details: error.toString()
        })
      }
    }));
    
    // Clean up
    this.state.pendingToolCalls.delete(call_id);
    this.state.activeToolExecutions.delete(name);
    progressIndicatorService.endToolExecution(this.state.callSid);
    turnTakingStateMachine.transition(this.state.callSid, STATES.WAITING_FOR_USER);
    
    // Trigger response
    if (!this.state.isResponding && this.state.activeResponseId === null && !this.state.isClosed) {
      this.state.isResponding = true;
      this.state.explicitResponseRequested = true;
      this.openaiWs.send(JSON.stringify({
        type: 'response.create'
      }));
    }
  }
}

