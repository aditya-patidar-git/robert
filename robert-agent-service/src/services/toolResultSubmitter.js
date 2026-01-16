/**
 * Tool Result Submitter
 * Abstraction for submitting tool execution results
 * Supports both WebSocket (Media Streams) and HTTP (SIP) submission
 */

import promptService from './promptService.js';
import { conversations } from '../shared/state.js';

/**
 * Base class for tool result submission
 */
class ToolResultSubmitter {
  /**
   * Submit tool execution result
   * @param {string} callId - Call ID
   * @param {string} toolCallId - Tool call ID
   * @param {object} result - Execution result
   * @param {object} options - Additional options
   * @returns {Promise<void>}
   */
  async submitResult(callId, toolCallId, result, options = {}) {
    throw new Error('submitResult must be implemented by subclass');
  }

  /**
   * Trigger response after tool completion
   * @param {string} callId - Call ID
   * @param {object} options - Additional options
   * @returns {Promise<void>}
   */
  async triggerResponse(callId, options = {}) {
    // Default: no-op, can be overridden
  }
}

/**
 * WebSocket result submitter for Media Streams
 */
export class WebSocketResultSubmitter extends ToolResultSubmitter {
  constructor(openaiWs, stateManager) {
    super();
    this.openaiWs = openaiWs;
    this.stateManager = stateManager;
  }

  /**
   * Submit result via WebSocket
   * @param {string} callId - Call ID
   * @param {string} toolCallId - Tool call ID
   * @param {object} result - Execution result
   * @param {object} options - Additional options
   */
  async submitResult(callId, toolCallId, result, options = {}) {
    // Get WebSocket from stored reference or state manager as fallback
    const openaiWs = this.openaiWs || this.stateManager?.openaiWs;
    
    if (!openaiWs || openaiWs.readyState !== 1) {
      const wsState = openaiWs ? openaiWs.readyState : 'null';
      const callClosed = this.stateManager?.isClosed ? ' (call closed)' : '';
      console.log(`ℹ️ [${callId}] Cannot submit result - WebSocket state: ${wsState}${callClosed}. This is expected if the call ended before tool completion.`);
      return;
    }

    if (this.stateManager && this.stateManager.isClosed) {
      console.log(`ℹ️ [${callId}] Cannot submit result - call is closed. This is expected if the call ended before tool completion.`);
      return;
    }

    const output = JSON.stringify(result);
    
    try {
      openaiWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: toolCallId,
          output: output
        }
      }));

      console.log(`✅ [${callId}] Tool result submitted via WebSocket for call_id: ${toolCallId}`);
    } catch (error) {
      console.error(`❌ [${callId}] Error submitting result via WebSocket:`, error);
      throw error;
    }
  }

  /**
   * Trigger response after tool completion
   * PHASE 1: Includes contextual instructions and proper response creation pattern
   * @param {string} callId - Call ID
   * @param {object} options - Additional options
   */
  async triggerResponse(callId, options = {}) {
    // Get WebSocket from stored reference or state manager as fallback
    const openaiWs = this.openaiWs || this.stateManager?.openaiWs;
    
    if (!openaiWs || openaiWs.readyState !== 1) {
      return;
    }

    if (this.stateManager && this.stateManager.isClosed) {
      return;
    }

    // Only trigger if not already responding
    if (this.stateManager && 
        !this.stateManager.isResponding && 
        this.stateManager.activeResponseId === null) {
      
      try {
        // PHASE 1: Get contextual instructions for automatic continuation after tool execution
        const callSid = callId;
        const workflowPhase = await promptService.determineWorkflowPhase(this.stateManager, callSid);
        
        // Get booking session info if available
        let courseType = null;
        let workflowType = null;
        let currentStep = null;
        
        if (callSid && conversations[callSid]?.bookingSession) {
          const bookingSession = conversations[callSid].bookingSession;
          courseType = bookingSession.courseType;
          workflowType = bookingSession.workflowType;
          currentStep = bookingSession.currentStep;
        }
        
        // Get contextual instructions for automatic continuation
        let responseInstructions = promptService.getContextualInstructions({
          isInitialGreeting: false,
          workflowPhase,
          courseType,
          workflowType,
          currentStep,
          activeTool: null // Tool just completed
        });
        
        // CRITICAL FIX: For client_verification specifically, handle both success and incomplete cases
        const toolName = options?.toolName;
        const toolResult = options?.toolResult;
        const isClientVerification = toolName === 'client_verification';
        if (isClientVerification) {
          if (toolResult && !toolResult.verified && toolResult.missingFields) {
            // Verification incomplete - agent must continue asking for ALL missing fields immediately
            const continueInstruction = toolResult.instruction || (() => {
              const fieldNames = {
                fullName: 'full name',
                postcode: 'postcode',
                telephoneNumber: 'telephone number'
              };
              const missingFieldNames = toolResult.missingFields?.map(f => fieldNames[f] || f).join(', ') || 'missing fields';
              
              return `CRITICAL: Client verification is INCOMPLETE. You have collected: ${toolResult.verifiedFields?.join(', ') || 'none'}. You MUST immediately ask for ALL missing fields: ${missingFieldNames}. Use the exact prompt: "${toolResult.message}". Then IMMEDIATELY call client_verification tool again with ALL missing fields filled in. The caller may provide all missing fields in one response, or may provide them partially - extract whatever they provide and call the tool again. Do NOT wait for the user to ask "are you still there" or any other prompt. Continue the verification flow immediately without pausing.`;
            })();
            
            responseInstructions = responseInstructions 
              ? `${continueInstruction}\n\n${responseInstructions}`
              : continueInstruction;
            console.log(`🎯 [${callId}] Client verification incomplete - instructing to ask for missing fields: ${toolResult.missingFields?.join(', ')}${toolResult.requiresImmediateContinuation ? ' (requires immediate continuation)' : ''}`);
          } else if (toolResult && toolResult.verified) {
            // Verification successful - agent must immediately confirm and call next step
            const nextStepTool = toolResult.nextStepTool || 'booking_step_select_session';
            const immediateResponseInstruction = `CRITICAL: You MUST speak immediately without waiting. Start with EXACTLY: "You are successfully verified." Then IMMEDIATELY in the SAME response, continue with: "Now let me continue with your booking." Then IMMEDIATELY call the next step tool: ${nextStepTool} WITHOUT waiting for any user response or prompt. Do NOT pause after saying "You are successfully verified" - immediately continue and call the tool in the same response. Do NOT wait for prompts or user input. The verification is complete - proceed automatically to the next booking step.`;
            
            responseInstructions = responseInstructions 
              ? `${immediateResponseInstruction}\n\n${responseInstructions}`
              : immediateResponseInstruction;
            console.log(`🎯 [${callId}] Client verification successful - instructing immediate confirmation and next step: ${nextStepTool}${toolResult.requiresImmediateNextStep ? ' (requires immediate next step)' : ''}`);
          }
        }
        
        // Step 1: Disable tools before creating response (prevents tool calls during response)
        // CRITICAL FIX: Set flags BEFORE creating response to ensure immediate speech
        this.stateManager.isResponding = true;
        this.stateManager.explicitResponseRequested = true;
        
        openaiWs.send(JSON.stringify({
          type: 'session.update',
          session: {
            tool_choice: 'none'
          }
        }));
        
        // Small delay to ensure session update is processed
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Step 2: Create response with contextual instructions
        const responseCreatePayload = {
          type: 'response.create',
          response: {
            modalities: ['audio', 'text']
          }
        };
        
        // PHASE 1: Include contextual instructions to ensure automatic continuation
        if (responseInstructions) {
          responseCreatePayload.response.instructions = responseInstructions;
          console.log(`📋 [${callId}] Including contextual instructions in response.create after tool completion (phase: ${workflowPhase}${isClientVerification ? ', client_verification' : ''})`);
        }
        
        openaiWs.send(JSON.stringify(responseCreatePayload));
        console.log(`✅ [${callId}] Response triggered after tool completion with contextual instructions`);
        
        // Step 3: Re-enable tools after delay
        setTimeout(() => {
          if (openaiWs && openaiWs.readyState === 1) {
            openaiWs.send(JSON.stringify({
              type: 'session.update',
              session: {
                tool_choice: 'auto'
              }
            }));
          }
        }, 3000);
        
      } catch (error) {
        console.error(`❌ [${callId}] Error triggering response:`, error);
        // Reset state on error
        if (this.stateManager) {
          this.stateManager.isResponding = false;
          this.stateManager.explicitResponseRequested = false;
        }
      }
    }
  }
}

/**
 * HTTP result submitter for SIP
 * Returns result in HTTP response format
 */
export class HTTPResultSubmitter extends ToolResultSubmitter {
  constructor() {
    super();
  }

  /**
   * Format result for HTTP response
   * @param {string} callId - Call ID
   * @param {string} toolCallId - Tool call ID
   * @param {object} result - Execution result
   * @param {object} options - Additional options
   * @returns {object} HTTP response object
   */
  async submitResult(callId, toolCallId, result, options = {}) {
    // For HTTP, we return the result object directly
    // The handler will format it as JSON response
    return {
      success: result.success !== false,
      result: result,
      tool_call_id: toolCallId,
      call_id: callId
    };
  }

  /**
   * Trigger response after tool completion
   * For HTTP/SIP, this is handled by OpenAI's SIP connector
   * No action needed here
   */
  async triggerResponse(callId, options = {}) {
    // No-op for HTTP/SIP - OpenAI handles response triggering
  }
}

/**
 * Factory function to create appropriate submitter
 * @param {string} type - 'websocket' or 'http'
 * @param {object} options - Options for submitter
 * @returns {ToolResultSubmitter} Submitter instance
 */
export function createResultSubmitter(type, options = {}) {
  if (type === 'websocket') {
    return new WebSocketResultSubmitter(options.openaiWs, options.stateManager);
  } else if (type === 'http') {
    return new HTTPResultSubmitter();
  } else {
    throw new Error(`Unknown submitter type: ${type}`);
  }
}

