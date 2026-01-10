/**
 * Tool Orchestrator
 * Coordinates between Realtime API (for audio) and Responses API (for complex tool calls)
 * Handles hybrid mode: Realtime for audio, Responses API for complex tool orchestrations
 */

import responsesApiService from './responsesApiService.js';
import toolExecutor from '../tools/index.js';
import uncertaintyGateService from './uncertaintyGateService.js';
import configManager from '../agent/configManager.js';

class ToolOrchestrator {
  constructor() {
    this.complexToolThreshold = 2; // Use Responses API if 2+ tools need to be called
  }

  /**
   * Get Responses API configuration from AIConfig
   * @returns {Object} - Responses API configuration with fallbacks
   */
  getResponsesApiConfig() {
    const aiConfig = configManager.getAIConfig();
    const responsesApi = aiConfig?.responsesApi || {};
    
    return {
      enabled: responsesApi.enabled !== false, // Default to true (backward compatible)
      model: responsesApi.model?.id || 'gpt-4o-mini', // Default to current hardcoded value
      useForComplexTools: responsesApi.useForComplexTools !== false, // Default to true
      fallbackOnRealtimeFailure: responsesApi.fallbackOnRealtimeFailure !== false // Default to true
    };
  }

  /**
   * Determine if a tool call should use Responses API
   * @param {Array} toolCalls - Array of tool calls
   * @param {Object} context - Call context
   * @returns {boolean} - True if should use Responses API
   */
  shouldUseResponsesApi(toolCalls, context = {}) {
    const config = this.getResponsesApiConfig();
    
    if (!config.enabled || !config.useForComplexTools) {
      return false;
    }

    // Use Responses API for complex multi-step operations
    if (toolCalls && toolCalls.length >= this.complexToolThreshold) {
      return true;
    }

    // Use Responses API for specific complex tools (CRM operations, multi-step bookings)
    const complexToolNames = ['crm', 'crm_browser'];
    if (toolCalls && toolCalls.some(tc => complexToolNames.includes(tc.function?.name))) {
      return true;
    }

    return false;
  }

  /**
   * Execute tools using Responses API
   * @param {Array} conversationHistory - Full conversation history
   * @param {Array} toolCalls - Tool calls to execute
   * @param {Object} callContext - Call context
   * @returns {Promise<Object>} - Tool execution results
   */
  async executeToolsWithResponsesApi(conversationHistory, toolCalls, callContext = {}) {
    try {
      // Get tool definitions
      const toolDefinitions = toolExecutor.getToolDefinitions();
      const formattedTools = responsesApiService.formatToolsForResponsesApi(toolDefinitions);

      // Prepare messages for Responses API
      const messages = this.prepareMessagesForResponsesApi(conversationHistory, toolCalls);

      // Get Responses API config from database
      const responsesApiConfig = this.getResponsesApiConfig();
      const aiConfig = configManager.getAIConfig();
      
      // Execute with tool orchestrator
      const result = await responsesApiService.generateResponseWithTools(
        messages,
        formattedTools,
        async (toolName, parameters, context) => {
          return await toolExecutor.execute(toolName, parameters, context);
        },
        callContext,
        {
          model: responsesApiConfig.model, // Use configured model
          temperature: aiConfig?.parameters?.temperature ?? 0.4,
          maxTokens: aiConfig?.parameters?.maxTokens ?? 1000
        }
      );

      return result;
    } catch (error) {
      console.error('❌ [Tool Orchestrator] Error executing tools with Responses API:', error);
      throw error;
    }
  }

  /**
   * Prepare conversation messages for Responses API
   * @param {Array} conversationHistory - Conversation transcript
   * @param {Array} toolCalls - Pending tool calls
   * @returns {Array} - Formatted messages for Responses API
   */
  prepareMessagesForResponsesApi(conversationHistory, toolCalls = []) {
    const messages = [];

    // Add system message
    messages.push({
      role: 'system',
      content: 'You are "Robert", Universal Motorcycle Training\'s AI phone agent. Execute tools as requested and provide clear, concise responses.'
    });

    // Convert conversation history to messages
    for (const entry of conversationHistory) {
      if (entry.role === 'user' || entry.role === 'agent') {
        messages.push({
          role: entry.role === 'agent' ? 'assistant' : 'user',
          content: entry.text || entry.content
        });
      }
    }

    // If there are pending tool calls, add them as assistant message with tool_calls
    if (toolCalls && toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id || `call_${Date.now()}_${Math.random()}`,
          type: 'function',
          function: {
            name: tc.function?.name || tc.name,
            arguments: typeof tc.function?.arguments === 'string' 
              ? tc.function.arguments 
              : JSON.stringify(tc.function?.arguments || {})
          }
        }))
      });
    }

    return messages;
  }

  /**
   * Inject Responses API results into Realtime conversation
   * @param {Object} responsesApiResult - Result from Responses API
   * @param {WebSocket} openaiWs - OpenAI Realtime WebSocket
   * @param {string} callSid - Call SID
   */
  async injectResultsIntoRealtime(responsesApiResult, openaiWs, callSid) {
    try {
      if (!openaiWs || openaiWs.readyState !== 1) { // 1 = OPEN
        console.warn(`⚠️ [${callSid}] Cannot inject results - WebSocket not open`);
        return;
      }

      // If there's content, add it as a conversation item
      if (responsesApiResult.content) {
        openaiWs.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'assistant',
            content: [{
              type: 'text',
              text: responsesApiResult.content
            }]
          }
        }));

        console.log(`✅ [${callSid}] Injected Responses API result into Realtime conversation`);
      }

      // Tool results are already handled by the Responses API flow
    } catch (error) {
      console.error(`❌ [${callSid}] Error injecting Responses API results:`, error);
    }
  }

  /**
   * Check tool result for uncertainty gate failure and handle accordingly
   * @param {Object} toolResult - Tool execution result
   * @param {string} toolName - Tool name
   * @param {WebSocket} openaiWs - OpenAI Realtime WebSocket (optional)
   * @param {string} callSid - Call SID
   * @returns {Promise<Object>} Modified result or original result
   */
  async checkUncertaintyGate(toolResult, toolName, openaiWs, callSid) {
    // Only check file_search results
    if (toolName !== 'file_search') {
      return toolResult;
    }

    // Check if validation failed
    if (toolResult && toolResult.validationFailed === true) {
      console.log(`⚠️ [${callSid}] Uncertainty gate failed for file_search. Fallback action: ${toolResult.validationDetails?.fallbackAction || 'transfer'}`);
      
      // Generate uncertainty response
      const uncertaintyResponse = uncertaintyGateService.generateUncertaintyResponse({
        confidence: toolResult.confidence || 0,
        recommendations: toolResult.validationDetails?.recommendations || [],
        fallbackAction: toolResult.validationDetails?.fallbackAction || 'transfer'
      });

      // If automatic transfer is enabled and fallback action is transfer, trigger transfer
      // Otherwise, return result with message for model to handle
      if (uncertaintyResponse.action === 'transfer') {
        // The model should see the error message and decide to transfer
        // We'll let the model handle it via the error message
        console.log(`🔄 [${callSid}] Uncertainty gate suggests transfer. Model will handle based on error message.`);
      }

      // Return result with uncertainty message
      return {
        ...toolResult,
        uncertaintyMessage: uncertaintyResponse.message,
        uncertaintyAction: uncertaintyResponse.action
      };
    }

    return toolResult;
  }

  /**
   * Handle fallback to Responses API when Realtime fails
   * @param {Array} conversationHistory - Conversation history
   * @param {Object} callContext - Call context
   * @returns {Promise<Object>} - Response from Responses API
   */
  async fallbackToResponsesApi(conversationHistory, callContext = {}) {
    try {
      const responsesApiConfig = this.getResponsesApiConfig();
      
      // Check if fallback is enabled
      if (!responsesApiConfig.fallbackOnRealtimeFailure) {
        throw new Error('Responses API fallback is disabled in configuration');
      }

      console.log(`🔄 [${callContext.callSid || 'unknown'}] Falling back to Responses API`);

      const messages = this.prepareMessagesForResponsesApi(conversationHistory);
      const toolDefinitions = toolExecutor.getToolDefinitions();
      const formattedTools = responsesApiService.formatToolsForResponsesApi(toolDefinitions);
      
      const aiConfig = configManager.getAIConfig();

      const result = await responsesApiService.generateResponse(
        messages,
        formattedTools,
        {
          model: responsesApiConfig.model, // Use configured model
          temperature: aiConfig?.parameters?.temperature ?? 0.4,
          maxTokens: 500
        }
      );

      return result;
    } catch (error) {
      console.error('❌ [Tool Orchestrator] Error in fallback to Responses API:', error);
      throw error;
    }
  }
}

export default new ToolOrchestrator();

