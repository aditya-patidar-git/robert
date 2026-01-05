/**
 * Tool Execution Service
 * Unified service for executing tools in both SIP and Media Streams contexts
 * Handles parameter parsing, validation, duplicate detection, and execution
 * 
 * Designed for concurrency: supports 8-10 simultaneous calls
 */

import toolExecutor from '../tools/index.js';
import configManager from '../agent/configManager.js';
import kbaService from '../services/kbaService.js';
import progressIndicatorService from '../services/progressIndicatorService.js';
import turnTakingStateMachine, { STATES } from '../services/turnTakingStateMachine.js';
import { conversations } from '../shared/state.js';
import uncertaintyGateService from './uncertaintyGateService.js';

/**
 * Unified Tool Execution Service
 * Extracts common tool execution logic for reuse across SIP and Media Streams
 */
class ToolExecutionService {
  constructor() {
    // Track recent tool calls per call_id for duplicate detection
    // Map<callId, Array<{name, parameters, timestamp}>>
    this.recentToolCalls = new Map();
    this.DUPLICATE_CALL_WINDOW_MS = 5000; // 5 seconds
  }

  /**
   * Parse and validate tool arguments
   * @param {string|object} args - Raw arguments (JSON string or object)
   * @returns {object} Parsed parameters
   * @throws {Error} If parsing fails
   */
  parseArguments(args) {
    if (!args || (typeof args === 'string' && args.trim() === '')) {
      return {};
    }

    if (typeof args === 'object') {
      return args;
    }

    try {
      return JSON.parse(args);
    } catch (parseError) {
      throw new Error(`Failed to parse tool arguments: ${parseError.message}`);
    }
  }

  /**
   * Check for duplicate tool calls within a time window
   * @param {string} callId - Call ID
   * @param {string} toolName - Tool name
   * @param {object} parameters - Tool parameters
   * @returns {boolean} True if duplicate detected
   */
  checkDuplicateCall(callId, toolName, parameters) {
    if (!this.recentToolCalls.has(callId)) {
      this.recentToolCalls.set(callId, []);
    }

    const recentCalls = this.recentToolCalls.get(callId);
    const now = Date.now();

    // Remove old calls outside the window
    const filteredCalls = recentCalls.filter(
      call => (now - call.timestamp) < this.DUPLICATE_CALL_WINDOW_MS
    );
    this.recentToolCalls.set(callId, filteredCalls);

    // Check for duplicate
    const isDuplicate = filteredCalls.some(call => {
      if (call.name !== toolName) return false;
      try {
        return JSON.stringify(call.parameters) === JSON.stringify(parameters);
      } catch (e) {
        return false;
      }
    });

    // Add to recent calls if not duplicate
    if (!isDuplicate) {
      filteredCalls.push({
        name: toolName,
        parameters: JSON.parse(JSON.stringify(parameters)), // Deep copy
        timestamp: now
      });
    }

    return isDuplicate;
  }

  /**
   * Store conversation state from tool results
   * @param {string} callId - Call ID
   * @param {string} toolName - Tool name
   * @param {object} executionResult - Tool execution result
   */
  storeConversationState(callId, toolName, executionResult) {
    if (!conversations[callId]) {
      conversations[callId] = {};
    }

    // Store client details from CRM browser tool
    if (toolName === 'crm_browser' && executionResult.success && executionResult.result) {
      if (executionResult.result.clientDetails) {
        conversations[callId].clientDetails = executionResult.result.clientDetails;
      }

      // Store availability data
      if (executionResult.result.sessionDetails || 
          executionResult.result.selectedSlot || 
          executionResult.result.allSlots) {
        conversations[callId].lastAvailabilityCheck = {
          allSlots: executionResult.result.allSlots,
          selectedSlot: executionResult.result.selectedSlot || executionResult.result.sessionDetails,
          sessionDetails: executionResult.result.selectedSlot || executionResult.result.sessionDetails
        };
      }
    }
  }

  /**
   * Execute a tool with full validation and error handling
   * @param {object} options - Execution options
   * @param {string} options.callId - Call ID (OpenAI call_id)
   * @param {string} options.callSid - Call SID (Twilio call SID, same as callId for SIP)
   * @param {string} options.toolCallId - Tool call ID
   * @param {string} options.toolName - Tool name
   * @param {string|object} options.arguments - Tool arguments (JSON string or object)
   * @param {string} options.phoneNumber - Phone number (optional)
   * @param {object} options.stateManager - State manager (for Media Streams, null for SIP)
   * @param {Function} options.progressCallback - Progress callback (optional)
   * @returns {Promise<object>} Execution result with standardized format
   */
  async executeTool(options) {
    const {
      callId,
      callSid,
      toolCallId,
      toolName,
      arguments: args,
      phoneNumber,
      stateManager = null,
      progressCallback = null
    } = options;

    console.log(`\n🔧 [${callSid || callId}] ========================================`);
    console.log(`🔧 [${callSid || callId}] TOOL INVOCATION DETECTED`);
    console.log(`🔧 [${callSid || callId}] Tool: ${toolName}`);
    console.log(`🔧 [${callSid || callId}] Call ID: ${callId}`);
    console.log(`🔧 [${callSid || callId}] Tool Call ID: ${toolCallId}`);
    console.log(`🔧 [${callSid || callId}] Phone: ${phoneNumber || 'unknown'}`);
    console.log(`🔧 [${callSid || callId}] Raw Arguments: ${args || '{}'}`);

    // Parse arguments
    let parameters;
    try {
      parameters = this.parseArguments(args);
      console.log(`🔧 [${callSid || callId}] Parsed Parameters:`, JSON.stringify(parameters, null, 2));
    } catch (parseError) {
      console.error(`❌ [${callSid || callId}] Failed to parse tool arguments for ${toolName}:`, parseError);
      return {
        success: false,
        error: parseError.message,
        raw_args_preview: typeof args === 'string' ? args.substring(0, 100) : 'null'
      };
    }

    // Check for duplicate calls
    const isDuplicate = this.checkDuplicateCall(callId, toolName, parameters);
    if (isDuplicate) {
      console.log(`⚠️ [${callSid || callId}] DUPLICATE CALL DETECTED: ${toolName} with same parameters - ignoring`);
      return {
        success: false,
        error: 'DUPLICATE_CALL',
        message: 'This tool call was already executed recently. Ignoring duplicate.'
      };
    }

    // Check if KBA is required
    if (kbaService.requiresKBA(toolName, parameters)) {
      const isKBAVerified = kbaService.isKBAVerified(callSid || callId);
      
      if (!isKBAVerified) {
        console.log(`🔐 [${callSid || callId}] KBA required for tool ${toolName} but not verified. Blocking execution.`);
        return {
          success: false,
          error: 'KBA_REQUIRED',
          message: 'Identity verification is required before accessing or changing personal booking data. Please use the kba_verification tool first with your email, postcode, and booking reference (if available).',
          requiresKBA: true
        };
      } else {
        console.log(`✅ [${callSid || callId}] KBA verified for tool ${toolName}. Proceeding with execution.`);
      }
    }

    // Check for active execution (only for Media Streams with state manager)
    if (stateManager && stateManager.activeToolExecutions) {
      const activeExecution = stateManager.activeToolExecutions.get(toolName);
      if (activeExecution) {
        console.log(`🚫 [${callSid || callId}] BLOCKING duplicate tool call: ${toolName} is already executing`);
        return {
          success: false,
          error: 'TOOL_ALREADY_EXECUTING',
          message: `The ${toolName} tool is already executing. Please wait for it to complete.`,
          toolAlreadyExecuting: true
        };
      }

      // Mark tool as active
      stateManager.activeToolExecutions.set(toolName, {
        call_id: toolCallId,
        startTime: Date.now(),
        callSid: callSid || callId
      });
    }

    // Initialize state machine (only for Media Streams)
    if (stateManager) {
      const currentState = turnTakingStateMachine.getCurrentState(callSid || callId);
      if (currentState === null) {
        turnTakingStateMachine.initialize(callSid || callId);
      }
      turnTakingStateMachine.transition(callSid || callId, STATES.TOOL_EXECUTING, { toolName });
    }

    // Start progress tracking (only for Media Streams)
    if (stateManager) {
      const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
      if (conversationBehaviorConfig?.progressIndicators?.enabled) {
        progressIndicatorService.startToolExecution(callSid || callId, toolName);
      }
    }

    console.log(`🔧 [${callSid || callId}] Starting tool execution: ${toolName}`);
    console.log(`🔧 [${callSid || callId}] ========================================\n`);

    // Prepare call context
    const conversation = conversations[callSid || callId] || {};
    const callContext = {
      callSid: callSid || callId,
      phoneNumber: phoneNumber,
      clientDetails: conversation.clientDetails,
      clientVerified: conversation.clientVerified || false
    };

    // Execute tool
    try {
      const executionResult = await toolExecutor.execute(
        toolName,
        parameters,
        callContext,
        progressCallback
      );

      // Check uncertainty gate for file_search results
      if (toolName === 'file_search' && executionResult && executionResult.validationFailed === true) {
        console.log(`⚠️ [${callSid || callId}] File search failed uncertainty gate validation`);
        
        // Generate uncertainty response
        const uncertaintyResponse = uncertaintyGateService.generateUncertaintyResponse({
          confidence: executionResult.confidence || 0,
          recommendations: executionResult.validationDetails?.recommendations || [],
          fallbackAction: executionResult.validationDetails?.fallbackAction || 'transfer'
        });

        // Store uncertainty event in conversation state
        if (!conversations[callSid || callId]) {
          conversations[callSid || callId] = {};
        }
        if (!conversations[callSid || callId].uncertaintyEvents) {
          conversations[callSid || callId].uncertaintyEvents = [];
        }
        conversations[callSid || callId].uncertaintyEvents.push({
          query: executionResult.query,
          confidence: executionResult.confidence,
          fallbackAction: executionResult.validationDetails?.fallbackAction,
          timestamp: new Date()
        });

        // Return result with uncertainty response
        return {
          success: false,
          validationFailed: true,
          error: 'UNCERTAINTY_GATE_FAILED',
          message: uncertaintyResponse.message,
          confidence: executionResult.confidence,
          fallbackAction: uncertaintyResponse.action,
          validationDetails: executionResult.validationDetails,
          query: executionResult.query,
          results: [],
          totalResults: 0
        };
      }

      // Store conversation state
      this.storeConversationState(callSid || callId, toolName, executionResult);

      // Clean up active execution tracking (only for Media Streams)
      if (stateManager) {
        stateManager.activeToolExecutions.delete(toolName);
        progressIndicatorService.endToolExecution(callSid || callId);
        turnTakingStateMachine.transition(callSid || callId, STATES.WAITING_FOR_USER);
      }

      console.log(`✅ [${callSid || callId}] Tool ${toolName} completed successfully`);

      // Return execution result as-is (already has success flag and result)
      return executionResult;
    } catch (error) {
      console.error(`❌ [${callSid || callId}] Tool ${toolName} execution error:`, error);

      // Clean up active execution tracking (only for Media Streams)
      if (stateManager) {
        stateManager.activeToolExecutions.delete(toolName);
        progressIndicatorService.endToolExecution(callSid || callId);
        turnTakingStateMachine.transition(callSid || callId, STATES.WAITING_FOR_USER);
      }

      return {
        success: false,
        error: error.message || 'Tool execution failed',
        details: error.toString()
      };
    }
  }

  /**
   * Clean up recent tool calls for a call (call on call end)
   * @param {string} callId - Call ID
   */
  cleanup(callId) {
    this.recentToolCalls.delete(callId);
  }
}

export default new ToolExecutionService();

