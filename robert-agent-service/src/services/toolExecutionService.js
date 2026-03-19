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
import { getSignal as getCallAbortSignal, register as registerCallAbort } from '../shared/callAbortRegistry.js';
import uncertaintyGateService from './uncertaintyGateService.js';
import unansweredQuestionService from './unansweredQuestionService.js';
import errorRecoveryService from './errorRecoveryService.js';

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

    // Store client details from CRM/browser tools
    const crmToolNames = [];
    if (crmToolNames.includes(toolName) && executionResult.success && executionResult.result) {
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
   * Determine UK domains to search based on query context
   * @param {string} query - Search query
   * @returns {string[]} Array of UK domain names
   */
  determineUKDomains(query) {
    if (!query) return [];
    
    const queryLower = query.toLowerCase();
    const ukDomains = [];
    
    // Include takeabyte.co.uk for policy/service queries
    if (queryLower.includes('policy') || 
        queryLower.includes('gdpr') || 
        queryLower.includes('privacy') ||
        queryLower.includes('service') ||
        queryLower.includes('terms') ||
        queryLower.includes('booking') ||
        queryLower.includes('training')) {
      ukDomains.push('takeabyte.co.uk');
    }
    
    return ukDomains;
  }

  /**
   * Execute fallback search tool with low latency optimizations
   * @param {string} fallbackToolName - Tool name to execute ('web_search' or 'file_search')
   * @param {object} parameters - Tool parameters
   * @param {object} callContext - Call context
   * @param {Function} progressCallback - Progress callback
   * @param {string} callSid - Call SID for logging
   * @returns {Promise<object>} Fallback search result
   */
  async executeFallbackSearch(fallbackToolName, parameters, callContext, progressCallback, callSid) {
    const fallbackStartTime = Date.now();
    
    try {
      const fallbackResult = await toolExecutor.execute(
        fallbackToolName,
        parameters,
        callContext,
        progressCallback
      );

      const fallbackTime = fallbackResult.executionTime || (Date.now() - fallbackStartTime);
      
      // Save usage asynchronously (don't wait for latency)
      this.saveToolUsageToCallRecord(callSid, fallbackToolName, fallbackTime, fallbackResult.success !== false)
        .catch(err => {
          console.warn(`⚠️ [${callSid}] Failed to save ${fallbackToolName} usage:`, err.message);
        });

      return fallbackResult;
    } catch (error) {
      console.error(`❌ [${callSid}] Fallback ${fallbackToolName} execution failed:`, error.message);
      throw error;
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

    const toolExecutionStartTime = Date.now();
    console.log(`\n🔧 [${callSid || callId}] ========================================`);
    console.log(`🔧 [${callSid || callId}] TOOL INVOCATION DETECTED`);
    console.log(`🔧 [${callSid || callId}] Tool: ${toolName}`);
    console.log(`🔧 [${callSid || callId}] Call ID: ${callId}`);
    console.log(`🔧 [${callSid || callId}] Tool Call ID: ${toolCallId}`);
    console.log(`🔧 [${callSid || callId}] Phone: ${phoneNumber || 'unknown'}`);
    console.log(`🔧 [${callSid || callId}] Raw Arguments: ${args || '{}'}`);
    if (toolName === 'file_search') {
      console.log(`🔍 [TEST-4] [${callSid || callId}] FILE_SEARCH TOOL CALLED - timestamp: ${toolExecutionStartTime}`);
      console.log(`🔍 [TEST-4] [${callSid || callId}] Tool call ID: ${toolCallId}`);
    }

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

    const isDuplicate =
      toolName === 'set_call_language'
        ? false
        : this.checkDuplicateCall(callId, toolName, parameters);
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
      
      // Check if already in TOOL_EXECUTING state to prevent concurrent execution warnings
      const stateBeforeTransition = turnTakingStateMachine.getCurrentState(callSid || callId);
      if (stateBeforeTransition === STATES.TOOL_EXECUTING) {
        console.warn(`⚠️ [${callSid || callId}] Already in TOOL_EXECUTING state, skipping transition for ${toolName}`);
      } else {
        turnTakingStateMachine.transition(callSid || callId, STATES.TOOL_EXECUTING, { toolName });
      }
    }

    // Start progress tracking (only for Media Streams)
    if (stateManager) {
      const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
      if (conversationBehaviorConfig?.progressIndicators?.enabled) {
        // Pass stateManager for thread-safe response state checks
        progressIndicatorService.startToolExecution(callSid || callId, toolName, stateManager);
      }
    }

    console.log(`🔧 [${callSid || callId}] Starting tool execution: ${toolName}`);
    console.log(`🔧 [${callSid || callId}] ========================================\n`);

    // Track execution start time for metrics (declare outside try/catch for scope)
    let executionStartTime = Date.now();
    let executionTime = 0;

    // Prepare call context (include call abort signal so steps can exit when call disconnects)
    const cid = callSid || callId;
    if (cid && !getCallAbortSignal(cid)) {
      registerCallAbort(cid);
    }
    const conversation = conversations[cid] || {};
    const callContext = {
      callSid: cid,
      phoneNumber: phoneNumber,
      clientDetails: conversation.clientDetails,
      clientVerified: conversation.clientVerified || false,
      callAbortSignal: getCallAbortSignal(cid),
      stateManager: stateManager || null
    };

    // Execute tool
    let executionResult = null;
    try {
      executionResult = await toolExecutor.execute(
        toolName,
        parameters,
        callContext,
        progressCallback
      );
      if (toolName === 'booking_step_select_booking_options') {
        if (!conversations[callSid || callId]) conversations[callSid || callId] = {};
        conversations[callSid || callId].selectBookingOptionsInvoked = true;
      }
    } catch (error) {
      const isCallEnded = error?.name === 'AbortError' || (error?.message && /aborted|call ended/i.test(String(error.message)));
      if (isCallEnded) {
        console.log(`🛑 [${callSid || callId}] Tool ${toolName} aborted (call ended)`);
        executionResult = {
          success: false,
          error: 'Call ended',
          callEnded: true,
          executionTime: Date.now() - executionStartTime
        };
      }
      if (!isCallEnded) {
        console.error(`❌ [${callSid || callId}] Tool ${toolName} execution error:`, error);
      }
      let lastError = error;
      let recovery;
      for (;;) {
        if (isCallEnded) break;
        const config = configManager.getConversationBehaviorConfig();
        recovery = errorRecoveryService.handleToolError(callSid || callId, toolName, lastError, config);
        if (!recovery.shouldRetry || recovery.delay == null) break;
        await new Promise(r => setTimeout(r, recovery.delay));
        try {
          executionResult = await toolExecutor.execute(
            toolName,
            parameters,
            callContext,
            progressCallback
          );
          lastError = null;
          break;
        } catch (e) {
          if (e?.name === 'AbortError' || (e?.message && /aborted|call ended/i.test(String(e.message)))) {
            executionResult = { success: false, error: 'Call ended', callEnded: true };
            break;
          }
          lastError = e;
          console.error(`❌ [${callSid || callId}] Tool ${toolName} retry execution error:`, e);
        }
      }
      if (executionResult === null) {
        const executionTimeFailed = Date.now() - executionStartTime;
        this.saveToolUsageToCallRecord(callSid || callId, toolName, executionTimeFailed, false)
          .catch(err => {
            console.warn(`⚠️ [${callSid || callId}] Failed to save failed tool usage to CallRecord:`, err.message);
          });
        progressIndicatorService.stopPeriodicUpdates(callSid || callId);
        progressIndicatorService.endToolExecution(callSid || callId);
        if (stateManager) {
          stateManager.toolExecutionCompleting = true;
          console.log(`🔒 [${callSid || callId}] Set toolExecutionCompleting flag to prevent periodic update race condition (error path)`);
          if (stateManager.toolExecutionCompletingTimeout) {
            clearTimeout(stateManager.toolExecutionCompletingTimeout);
          }
          stateManager.toolExecutionCompletingTimeout = setTimeout(() => {
            if (stateManager.toolExecutionCompleting) {
              console.warn(`⚠️ [${callSid || callId}] Safety timeout: Auto-clearing stuck toolExecutionCompleting flag (error path)`);
              stateManager.clearToolExecutionCompleting();
            }
          }, 30000);
          stateManager.activeToolExecutions.delete(toolName);
          turnTakingStateMachine.transition(callSid || callId, STATES.LISTENING);
        }
        return {
          success: false,
          error: recovery.userMessage,
          details: lastError.toString(),
          alternatives: recovery.alternatives
        };
      }
    }

    // Call ended during execution: cleanup and return without submitting to agent
    if (executionResult?.callEnded === true) {
      progressIndicatorService.stopPeriodicUpdates(callSid || callId);
      progressIndicatorService.endToolExecution(callSid || callId);
      if (stateManager) {
        stateManager.activeToolExecutions.delete(toolName);
        turnTakingStateMachine.transition(callSid || callId, STATES.LISTENING);
      }
      return executionResult;
    }

    // Success path (executionResult set from try or from retry)
    executionTime = executionResult.executionTime || (Date.now() - executionStartTime);

    // Extract actual tool result (toolExecutor wraps it in { success, result, executionTime })
    const toolResult = executionResult.result || executionResult;
      
      if (toolName === 'file_search') {
        const totalExecutionTime = Date.now() - toolExecutionStartTime;
        console.log(`🔍 [TEST-4] [${callSid || callId}] FILE_SEARCH EXECUTION COMPLETE:`);
        console.log(`   - Execution time: ${executionTime}ms`);
        console.log(`   - Total time (including overhead): ${totalExecutionTime}ms`);
        console.log(`   - Success: ${executionResult.success !== false}`);
        if (toolResult && toolResult.results) {
          console.log(`   - Results count: ${toolResult.results.length}`);
          console.log(`   - Citations: ${toolResult.citations ? toolResult.citations.join(', ') : 'N/A'}`);
        }
      }

      // ========== FILE_SEARCH FAILURE → WEB_SEARCH FALLBACK ==========
      if (toolName === 'file_search' && toolResult && toolResult.validationFailed === true) {
        console.log(`⚠️ [${callSid || callId}] File search failed uncertainty gate validation`);
        
        // Generate uncertainty response
        const uncertaintyResponse = uncertaintyGateService.generateUncertaintyResponse({
          confidence: toolResult.confidence || 0,
          recommendations: toolResult.validationDetails?.recommendations || [],
          fallbackAction: toolResult.validationDetails?.fallbackAction || 'transfer'
        });

        // Store uncertainty event in conversation state
        if (!conversations[callSid || callId]) {
          conversations[callSid || callId] = {};
        }
        if (!conversations[callSid || callId].uncertaintyEvents) {
          conversations[callSid || callId].uncertaintyEvents = [];
        }
        conversations[callSid || callId].uncertaintyEvents.push({
          query: toolResult.query,
          confidence: toolResult.confidence,
          fallbackAction: toolResult.validationDetails?.fallbackAction,
          timestamp: new Date()
        });

        // Automatic fallback to web_search when file_search fails
        const query = toolResult.query || parameters.query || '';
        console.log(`🔄 [${callSid || callId}] Automatically triggering web_search fallback for: "${query}"`);
        
        // CRITICAL: Stop periodic updates atomically before fallback to prevent multiple responses
        // This must happen synchronously before fallback execution starts
        if (stateManager) {
          progressIndicatorService.stopPeriodicUpdates(callSid || callId);
          console.log(`🛑 [${callSid || callId}] Stopped periodic updates before fallback execution`);
          // CRITICAL: Clear original tool from activeToolExecutions before executing fallback
          // This prevents blocking subsequent tool calls with the same tool name
          if (stateManager.activeToolExecutions && stateManager.activeToolExecutions.has(toolName)) {
            stateManager.activeToolExecutions.delete(toolName);
            console.log(`🧹 [${callSid || callId}] Cleared ${toolName} from activeToolExecutions before fallback execution`);
          }
        }
        
        // Save unanswered question asynchronously (don't wait - low latency)
        // This captures the initial failure before fallback attempt
        unansweredQuestionService.saveUnansweredQuestion({
          callSid: callSid || callId,
          callId: callId,
          callerId: phoneNumber || 'unknown',
          question: query,
          context: `File search failed uncertainty gate validation (confidence: ${toolResult.confidence})`,
          confidence: toolResult.confidence,
          failureReason: 'uncertainty_gate_failed',
          searchResults: {
            fileSearchResults: toolResult.results?.length || 0,
            webSearchResults: 0,
            fileSearchConfidence: toolResult.confidence,
            webSearchConfidence: 0
          }
        }).catch(err => {
          console.warn(`⚠️ [${callSid || callId}] Failed to save unanswered question:`, err.message);
        });
        
        try {
          const ukDomains = this.determineUKDomains(query);
          
          // Execute web_search fallback
          const webSearchResult = await this.executeFallbackSearch(
            'web_search',
            {
              query: query,
              domains: ukDomains.length > 0 ? ukDomains : undefined,
              maxResults: 5
            },
            callContext,
            progressCallback,
            callSid || callId
          );

          // Extract web search result (may be wrapped by toolExecutor)
          const webSearchToolResult = webSearchResult.result || webSearchResult;
          
          // Check if web_search succeeded
          if (webSearchToolResult && webSearchToolResult.success !== false && webSearchToolResult.results && webSearchToolResult.results.length > 0) {
            console.log(`✅ [${callSid || callId}] Web search fallback successful, found ${webSearchToolResult.results.length} results`);
            
            return {
              success: true,
              validationFailed: false,
              query: query,
              results: webSearchToolResult.results,
              totalResults: webSearchToolResult.totalResults || webSearchToolResult.results.length,
              source: 'web_search',
              fallbackUsed: true,
              fileSearchConfidence: toolResult.confidence,
              message: `Found ${webSearchToolResult.results.length} result(s) via web search. ${uncertaintyResponse.message || ''}`
            };
          } else {
            // Web search also failed or returned no results
            console.log(`⚠️ [${callSid || callId}] Web search fallback also returned no results`);
            
            // Save unanswered question asynchronously (don't wait - low latency)
            unansweredQuestionService.saveUnansweredQuestion({
              callSid: callSid || callId,
              callId: callId,
              callerId: phoneNumber || 'unknown',
              question: query,
              context: `File search failed (confidence: ${toolResult.confidence}), web search fallback also returned no results`,
              confidence: toolResult.confidence,
              failureReason: 'both_searches_failed',
              searchResults: {
                fileSearchResults: 0,
                webSearchResults: webSearchToolResult?.results?.length || 0,
                fileSearchConfidence: toolResult.confidence,
                webSearchConfidence: 0
              }
            }).catch(err => {
              console.warn(`⚠️ [${callSid || callId}] Failed to save unanswered question:`, err.message);
            });
            
            return {
              success: false,
              validationFailed: true,
              error: 'BOTH_SEARCHES_FAILED',
              message: uncertaintyResponse.message,
              confidence: toolResult.confidence,
              fallbackAction: uncertaintyResponse.action,
              validationDetails: toolResult.validationDetails,
              query: query,
              results: [],
              totalResults: 0,
              fallbackUsed: true
            };
          }
        } catch (webSearchError) {
          console.error(`❌ [${callSid || callId}] Web search fallback failed:`, webSearchError.message);
          
          // Save unanswered question asynchronously (don't wait - low latency)
          unansweredQuestionService.saveUnansweredQuestion({
            callSid: callSid || callId,
            callId: callId,
            callerId: phoneNumber || 'unknown',
            question: query,
            context: `File search failed (confidence: ${toolResult.confidence}), web search fallback threw error: ${webSearchError.message}`,
            confidence: toolResult.confidence,
            failureReason: 'both_searches_failed',
            searchResults: {
              fileSearchResults: 0,
              webSearchResults: 0,
              fileSearchConfidence: toolResult.confidence,
              webSearchConfidence: 0
            }
          }).catch(err => {
            console.warn(`⚠️ [${callSid || callId}] Failed to save unanswered question:`, err.message);
          });
          
          // Return original file_search failure if web_search also fails
          return {
            success: false,
            validationFailed: true,
            error: 'UNCERTAINTY_GATE_FAILED',
            message: uncertaintyResponse.message,
            confidence: toolResult.confidence,
            fallbackAction: uncertaintyResponse.action,
            validationDetails: toolResult.validationDetails,
            query: query,
            results: [],
            totalResults: 0,
            fallbackError: webSearchError.message
          };
        }
      }

      // ========== WEB_SEARCH FAILURE → FILE_SEARCH FALLBACK ==========
      if (toolName === 'web_search' && toolResult) {
        // Extract web search result (may be wrapped by toolExecutor)
        const webSearchResult = toolResult;
        
        // Check if web_search returned empty results or failed
        const hasNoResults = !webSearchResult.results || webSearchResult.results.length === 0;
        
        const hasError = executionResult.success === false || webSearchResult.error;
        
        if (hasNoResults || hasError) {
          console.log(`⚠️ [${callSid || callId}] Web search returned ${hasNoResults ? 'no results' : 'an error'}, triggering file_search fallback`);
          
          // CRITICAL: Stop periodic updates atomically before fallback to prevent multiple responses
          // This must happen synchronously before fallback execution starts
          if (stateManager) {
            progressIndicatorService.stopPeriodicUpdates(callSid || callId);
            console.log(`🛑 [${callSid || callId}] Stopped periodic updates before fallback execution`);
            // CRITICAL: Clear original tool from activeToolExecutions before executing fallback
            // This prevents blocking subsequent tool calls with the same tool name
            if (stateManager.activeToolExecutions && stateManager.activeToolExecutions.has(toolName)) {
              stateManager.activeToolExecutions.delete(toolName);
              console.log(`🧹 [${callSid || callId}] Cleared ${toolName} from activeToolExecutions before fallback execution`);
            }
          }
          
          try {
            const query = webSearchResult.query || parameters.query || '';
            
            // Execute file_search fallback
            const fileSearchFallbackResult = await this.executeFallbackSearch(
              'file_search',
              {
                query: query
              },
              callContext,
              progressCallback,
              callSid || callId
            );

            // Extract file search result (may be wrapped by toolExecutor)
            const fileSearchToolResult = fileSearchFallbackResult.result || fileSearchFallbackResult;

            // Check if file_search succeeded and passed uncertainty gate
            if (fileSearchToolResult && 
                fileSearchFallbackResult.success !== false && 
                !fileSearchToolResult.validationFailed && 
                fileSearchToolResult.results && 
                fileSearchToolResult.results.length > 0) {
              console.log(`✅ [${callSid || callId}] File search fallback successful, found ${fileSearchToolResult.results.length} results`);
              
              return {
                success: true,
                validationFailed: false,
                query: query,
                results: fileSearchToolResult.results,
                totalResults: fileSearchToolResult.totalResults || fileSearchToolResult.results.length,
                source: 'file_search',
                fallbackUsed: true,
                webSearchFailed: true,
                message: `Found ${fileSearchToolResult.results.length} result(s) via file search fallback.`
              };
            } else {
              // File search also failed or returned no results
              console.log(`⚠️ [${callSid || callId}] File search fallback also returned no results or failed validation`);
              
              // Save unanswered question asynchronously (don't wait - low latency)
              unansweredQuestionService.saveUnansweredQuestion({
                callSid: callSid || callId,
                callId: callId,
                callerId: phoneNumber || 'unknown',
                question: query,
                context: `Web search returned no results, file search fallback also failed (validation: ${fileSearchToolResult?.validationFailed || false})`,
                confidence: fileSearchToolResult?.confidence || 0,
                failureReason: 'both_searches_failed',
                searchResults: {
                  fileSearchResults: fileSearchToolResult?.results?.length || 0,
                  webSearchResults: 0,
                  fileSearchConfidence: fileSearchToolResult?.confidence || 0,
                  webSearchConfidence: 0
                }
              }).catch(err => {
                console.warn(`⚠️ [${callSid || callId}] Failed to save unanswered question:`, err.message);
              });
              
              return {
                success: false,
                validationFailed: fileSearchToolResult?.validationFailed || false,
                error: 'BOTH_SEARCHES_FAILED',
                message: `Both web search and file search failed to find results for: "${query}"`,
                query: query,
                results: [],
                totalResults: 0,
                fallbackUsed: true,
                webSearchError: hasError ? webSearchResult.error : 'No results',
                fileSearchError: fileSearchToolResult?.error || (fileSearchToolResult?.validationFailed ? 'Uncertainty gate failed' : 'No results')
              };
            }
          } catch (fileSearchError) {
            console.error(`❌ [${callSid || callId}] File search fallback failed:`, fileSearchError.message);
            
            // Save unanswered question asynchronously (don't wait - low latency)
            unansweredQuestionService.saveUnansweredQuestion({
              callSid: callSid || callId,
              callId: callId,
              callerId: phoneNumber || 'unknown',
              question: webSearchResult.query || parameters.query || '',
              context: `Web search returned no results, file search fallback threw error: ${fileSearchError.message}`,
              confidence: 0,
              failureReason: 'both_searches_failed',
              searchResults: {
                fileSearchResults: 0,
                webSearchResults: 0,
                fileSearchConfidence: 0,
                webSearchConfidence: 0
              }
            }).catch(err => {
              console.warn(`⚠️ [${callSid || callId}] Failed to save unanswered question:`, err.message);
            });
            
            // Return original web_search failure if file_search also fails
            return {
              success: false,
              error: hasError ? webSearchResult.error : 'NO_RESULTS',
              message: `Web search failed and file search fallback also failed: ${fileSearchError.message}`,
              query: webSearchResult.query || parameters.query || '',
              results: [],
              totalResults: 0,
              fallbackError: fileSearchError.message
            };
          }
        }
      }

      // Store conversation state
      this.storeConversationState(callSid || callId, toolName, executionResult);

      const toolSucceeded = executionResult.success !== false;
      // Save tool usage to CallRecord with actual success/failure (async, don't wait)
      this.saveToolUsageToCallRecord(callSid || callId, toolName, executionTime, toolSucceeded)
        .catch(err => {
          console.warn(`⚠️ [${callSid || callId}] Failed to save tool usage to CallRecord:`, err.message);
        });

      progressIndicatorService.stopPeriodicUpdates(callSid || callId);
      progressIndicatorService.endToolExecution(callSid || callId);

      if (stateManager) {
        stateManager.toolExecutionCompleting = true;
        console.log(`🔒 [${callSid || callId}] Set toolExecutionCompleting flag to prevent periodic update race condition`);
        if (stateManager.toolExecutionCompletingTimeout) {
          clearTimeout(stateManager.toolExecutionCompletingTimeout);
        }
        stateManager.toolExecutionCompletingTimeout = setTimeout(() => {
          if (stateManager.toolExecutionCompleting) {
            console.warn(`⚠️ [${callSid || callId}] Safety timeout: Auto-clearing stuck toolExecutionCompleting flag`);
            stateManager.clearToolExecutionCompleting();
          }
        }, 30000);
        stateManager.activeToolExecutions.delete(toolName);
        turnTakingStateMachine.transition(callSid || callId, STATES.LISTENING);
      }

      if (toolSucceeded) {
        console.log(`✅ [${callSid || callId}] Tool ${toolName} completed successfully`);
      } else {
        console.log(`⚠️ [${callSid || callId}] Tool ${toolName} completed with failure (result submitted to agent)`);
      }

      // Return execution result as-is (already has success flag and result)
      return executionResult;
  }

  /**
   * Save tool usage to CallRecord database
   * @param {string} callSid - Call SID
   * @param {string} toolName - Tool name
   * @param {number} executionTime - Execution time in milliseconds
   * @param {boolean} success - Whether tool execution succeeded
   * @returns {Promise<void>}
   */
  async saveToolUsageToCallRecord(callSid, toolName, executionTime, success) {
    try {
      const CallRecord = (await import('../database/models/CallRecord.js')).default;
      
      await CallRecord.findOneAndUpdate(
        { callSid: callSid },
        {
          $push: {
            toolsUsed: {
              toolName: toolName,
              executionTime: executionTime,
              success: success,
              timestamp: new Date()
            }
          }
        },
        { upsert: false } // Don't create if doesn't exist (should already exist)
      );
      
      console.log(`📝 [${callSid}] Saved tool usage to CallRecord: ${toolName} (${executionTime}ms, success: ${success})`);
    } catch (error) {
      // Log but don't throw - tool execution shouldn't fail if DB update fails
      console.error(`❌ [${callSid}] Error saving tool usage to CallRecord:`, error.message);
      throw error; // Re-throw so caller can handle if needed
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

