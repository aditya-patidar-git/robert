/**
 * OpenAI Responses API Service
 * Handles text/toolful turns using OpenAI's chat.completions API
 * Used for complex tool orchestrations, fallback scenarios, and non-audio interactions
 */

import OpenAI from "openai";
// dotenv is already loaded in index.js, no need to reload here

// Lazy initialization: Create OpenAI client only when needed (after dotenv loads)
let openaiClient = null;
function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

class ResponsesApiService {
  constructor() {
    this.defaultModel = 'gpt-4o-mini'; // Cost-effective model for Responses API
    this.maxTokens = 1000;
    this.temperature = 0.4;
  }

  /**
   * Generate response using Responses API (chat.completions)
   * @param {Array} messages - Conversation messages array
   * @param {Array} tools - Tool definitions (optional)
   * @param {Object} options - Additional options (model, temperature, etc.)
   * @returns {Promise<Object>} - Response object with content and tool calls
   */
  async generateResponse(messages, tools = null, options = {}) {
    try {
      const model = options.model || this.defaultModel;
      const temperature = options.temperature ?? this.temperature;
      const maxTokens = options.maxTokens || this.maxTokens;
      const topP = options.top_p ?? options.topP;

      const requestPayload = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false
      };
      if (topP !== undefined && topP !== null) {
        requestPayload.top_p = topP;
      }

      // Add tools if provided
      if (tools && Array.isArray(tools) && tools.length > 0) {
        requestPayload.tools = tools;
        requestPayload.tool_choice = options.toolChoice || 'auto';
      }

      // Add response format if specified
      if (options.responseFormat) {
        requestPayload.response_format = options.responseFormat;
      }

      console.log(`📡 [Responses API] Calling ${model} with ${messages.length} messages${tools ? ` and ${tools.length} tools` : ''}`);

      // Get OpenAI client (lazy initialization)
      const openai = getOpenAIClient();
      const response = await openai.chat.completions.create(requestPayload);

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No response from OpenAI Responses API');
      }

      const result = {
        content: choice.message.content,
        role: choice.message.role,
        toolCalls: choice.message.tool_calls || [],
        finishReason: choice.finish_reason,
        usage: response.usage
      };

      console.log(`✅ [Responses API] Response received (${result.toolCalls.length} tool calls, finish: ${result.finishReason})`);

      return result;
    } catch (error) {
      console.error('❌ [Responses API] Error generating response:', error);
      throw error;
    }
  }

  /**
   * Generate response with tool execution
   * Executes tools and returns final response
   * @param {Array} messages - Conversation messages
   * @param {Array} tools - Tool definitions
   * @param {Function} toolExecutor - Function to execute tools (toolName, parameters, callContext)
   * @param {Object} callContext - Call context (callSid, phoneNumber, etc.)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Final response with tool results
   */
  async generateResponseWithTools(messages, tools, toolExecutor, callContext = {}, options = {}) {
    try {
      const maxIterations = options.maxIterations || 5;
      let iteration = 0;
      let currentMessages = [...messages];

      while (iteration < maxIterations) {
        iteration++;

        // Generate response (may include tool calls)
        const response = await this.generateResponse(currentMessages, tools, options);

        // If no tool calls, return the response
        if (!response.toolCalls || response.toolCalls.length === 0) {
          return {
            content: response.content,
            toolResults: [],
            iterations: iteration
          };
        }

        // Execute tool calls
        const toolResults = [];
        for (const toolCall of response.toolCalls) {
          try {
            const toolName = toolCall.function.name;
            const parameters = JSON.parse(toolCall.function.arguments || '{}');

            console.log(`🔧 [Responses API] Executing tool: ${toolName} with params:`, parameters);

            const toolResult = await toolExecutor(toolName, parameters, callContext);

            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: toolName,
              content: JSON.stringify(toolResult)
            });
          } catch (error) {
            console.error(`❌ [Responses API] Tool execution error:`, error);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: toolCall.function.name,
              content: JSON.stringify({ error: error.message })
            });
          }
        }

        // Add assistant message and tool results to conversation
        currentMessages.push({
          role: 'assistant',
          content: response.content,
          tool_calls: response.toolCalls
        });

        currentMessages.push(...toolResults);

        // Continue loop to get final response
      }

      // If we've exhausted iterations, return the last response
      const lastResponse = await this.generateResponse(currentMessages, tools, options);
      return {
        content: lastResponse.content,
        toolResults: [],
        iterations: iteration,
        warning: 'Max iterations reached'
      };
    } catch (error) {
      console.error('❌ [Responses API] Error in generateResponseWithTools:', error);
      throw error;
    }
  }

  /**
   * Format tool definitions for Responses API
   * Converts Realtime API tool format to Responses API format
   * @param {Array} realtimeTools - Tools in Realtime API format
   * @returns {Array} - Tools in Responses API format
   */
  formatToolsForResponsesApi(realtimeTools) {
    return realtimeTools.map(tool => {
      if (tool.type === 'function') {
        return {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        };
      }
      return tool;
    });
  }
}

export default new ResponsesApiService();
