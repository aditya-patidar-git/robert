/**
 * Tool Executor
 * Handles tool execution with validation, rate limiting, timeout, and metrics
 */

import { trace, SpanStatusCode } from '@opentelemetry/api';
import { validateToolParameters } from '../utils/toolSchemaValidator.js';
import { recordToolMetrics } from '../services/metricsService.js';
import ToolConfig from '../database/models/ToolConfig.js';
import { setCancellationContext } from '../config/cancellationPhrases.js';

const tracer = trace.getTracer('robert-agent-service', '1.0.0');

class ToolExecutor {
  constructor(toolRegistry, configManager) {
    this.toolRegistry = toolRegistry;
    this.configManager = configManager;
    this.defaultTimeout = 10000; // 10 seconds
    this.rateLimitTrackers = new Map(); // Track rate limits per tool
    this.globalRateLimitTracker = null; // Track global MCP rate limit
  }

  /**
   * Check global MCP rate limit
   * @returns {boolean} True if within global rate limit
   */
  checkGlobalRateLimit() {
    const globalRateLimit = this.configManager.getMCPRateLimit();
    if (!globalRateLimit) {
      return true; // No global rate limit configured
    }

    const now = Date.now();
    const windowMs = 60000; // 1 minute window for global rate limit

    if (!this.globalRateLimitTracker) {
      this.globalRateLimitTracker = {
        requests: 0,
        windowStart: now
      };
    }

    // Reset window if expired
    if (now - this.globalRateLimitTracker.windowStart >= windowMs) {
      this.globalRateLimitTracker.requests = 0;
      this.globalRateLimitTracker.windowStart = now;
    }

    // Check if under global limit
    if (this.globalRateLimitTracker.requests >= globalRateLimit) {
      return false;
    }

    this.globalRateLimitTracker.requests++;
    return true;
  }

  /**
   * Check rate limit for a tool
   * @param {string} toolName - Tool name
   * @param {Object} rateLimitConfig - Rate limit configuration { limit, windowMs }
   * @returns {boolean} True if within rate limit
   */
  checkRateLimit(toolName, rateLimitConfig) {
    if (!rateLimitConfig || !rateLimitConfig.limit) {
      return true; // No rate limit configured
    }

    const now = Date.now();
    let tracker = this.rateLimitTrackers.get(toolName);
    
    if (!tracker) {
      tracker = {
        requests: 0,
        windowStart: now
      };
      this.rateLimitTrackers.set(toolName, tracker);
    }

    // Reset window if expired
    if (now - tracker.windowStart >= rateLimitConfig.windowMs) {
      tracker.requests = 0;
      tracker.windowStart = now;
    }

    // Check if under limit
    if (tracker.requests >= rateLimitConfig.limit) {
      return false;
    }

    tracker.requests++;
    return true;
  }

  /**
   * Execute a tool asynchronously with timeout protection
   * @param {string} toolName - Name of the tool to execute
   * @param {object} parameters - Tool parameters
   * @param {object} callContext - Call context (callSid, phoneNumber, etc.)
   * @param {Function} progressCallback - Optional callback for progress updates
   * @param {number} timeout - Execution timeout in ms (optional)
   * @returns {Promise<object>} Tool execution result
   */
  async execute(toolName, parameters, callContext = {}, progressCallback = null, timeout = this.defaultTimeout) {
    const startTime = Date.now();
    const callSid = callContext.callSid || 'unknown';
    const phoneNumber = callContext.phoneNumber || 'unknown';

    if (toolName.startsWith('cancellation_step_')) {
      setCancellationContext(callSid);
    }

    // Create span for tool execution
    const span = tracer.startSpan(`tool.execute.${toolName}`, {
      attributes: {
        'tool.name': toolName,
        'call.sid': callSid,
        'call.phone_number': phoneNumber
      }
    });

    try {
      // ========== GLOBAL MCP SETTINGS CHECK ==========
      // Check if MCP tools are globally enabled
      if (!this.configManager.isMCPEnabled()) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'MCP tools are globally disabled' });
        span.end();
        console.error(`❌ [${callSid}] MCP tools are globally disabled. Tool ${toolName} blocked.`);
        throw new Error('MCP tools are currently disabled. Please contact an administrator.');
      }

      // Check global MCP rate limit (applies to all tools)
      if (!this.checkGlobalRateLimit()) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Global MCP rate limit exceeded' });
        span.end();
        console.error(`❌ [${callSid}] Global MCP rate limit exceeded`);
        throw new Error('Global rate limit exceeded. Too many tool calls. Please try again later.');
      }
      // ================================================

      if (!this.toolRegistry.has(toolName)) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `Tool not found: ${toolName}` });
        span.end();
        console.error(`❌ [${callSid}] Tool not found: ${toolName}`);
        throw new Error(`Unknown tool: ${toolName}`);
      }

      // Validate tool parameters using Zod schema
      const validation = validateToolParameters(toolName, parameters);
      if (!validation.success) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `Parameter validation failed: ${validation.error}` });
        span.end();
        console.error(`❌ [${callSid}] Tool parameter validation failed for ${toolName}:`, validation.error);
        throw new Error(`Invalid parameters for tool ${toolName}: ${validation.error}`);
      }
      
      // Use validated parameters
      const validatedParameters = validation.data;
      span.setAttribute('tool.parameters_validated', true);

      // Get tool configuration from ConfigManager
      const toolConfig = this.configManager.getToolConfig(toolName);
      
      // Check if tool is enabled (per-tool setting)
      if (!toolConfig.enabled) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Tool is disabled' });
        span.end();
        console.error(`❌ [${callSid}] Tool ${toolName} is disabled`);
        throw new Error(`Tool ${toolName} is disabled`);
      }

      // Check per-tool rate limit (simple in-memory tracking per tool executor instance)
      // Note: For distributed systems, this should be in Redis or similar
      if (!this.checkRateLimit(toolName, toolConfig.rateLimit)) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Rate limit exceeded' });
        span.end();
        console.error(`❌ [${callSid}] Rate limit exceeded for tool ${toolName}`);
        throw new Error(`Rate limit exceeded for tool ${toolName}`);
      }

      // Check domain allowlist if URL is provided
      if (validatedParameters.url && toolConfig.domains && toolConfig.domains.length > 0) {
        try {
          const url = new URL(validatedParameters.url);
          const domain = url.hostname;
          const isAllowed = toolConfig.domains.some(allowedDomain => 
            domain === allowedDomain || domain.endsWith('.' + allowedDomain)
          );
          if (!isAllowed) {
            console.error(`❌ [${callSid}] Domain ${domain} not allowed for tool ${toolName}`);
            throw new Error(`Domain ${domain} not allowed for tool ${toolName}`);
          }
        } catch (urlError) {
          console.error(`❌ [${callSid}] Invalid URL in parameters:`, urlError);
          throw new Error(`Invalid URL provided for tool ${toolName}`);
        }
      }

      // Get tool instance BEFORE checking timeout (fixes ReferenceError)
      const tool = this.toolRegistry.get(toolName);

      // ========== TIMEOUT PRIORITY ==========
      // Priority: tool.getTimeout() > toolConfig.maxTime > globalMCPTimeout > hardcoded defaults
      let toolSpecificTimeout = null;
      
      // 1. Check if tool has a custom timeout method (for step-based tools)
      if (tool && typeof tool.getTimeout === 'function') {
        toolSpecificTimeout = tool.getTimeout();
        if (toolSpecificTimeout !== null && toolSpecificTimeout > 0) {
          timeout = toolSpecificTimeout;
          console.log(`⏱️ [${callSid}] Using tool-specific timeout for ${toolName}: ${timeout}ms`);
        }
      }
      
      // 2. Use per-tool configured maxTime if available and no tool-specific timeout was set
      if (toolConfig.maxTime && toolSpecificTimeout === null) {
        timeout = toolConfig.maxTime;
        console.log(`⏱️ [${callSid}] Using per-tool maxTime for ${toolName}: ${timeout}ms`);
      }
      
      // 3. Use global MCP timeout as fallback if no other timeout was set
      if (toolSpecificTimeout === null && !toolConfig.maxTime) {
        const globalTimeoutMs = this.configManager.getMCPTimeoutMs();
        if (globalTimeoutMs && globalTimeoutMs > 0) {
          timeout = globalTimeoutMs;
          console.log(`⏱️ [${callSid}] Using global MCP timeout for ${toolName}: ${timeout}ms`);
        }
      }
      
      // 4. Increase timeout for browser automation tools - they need more time
      // Only if no tool-specific timeout, no per-tool maxTime, and not using global timeout override
      const browserToolNames = ['update_customer'];
      if (browserToolNames.includes(toolName) && toolSpecificTimeout === null && !toolConfig.maxTime) {
        timeout = Math.max(timeout, 360000);
        console.log(`⏱️ [${callSid}] Extended timeout for ${toolName} to ${timeout}ms`);
      }
      // ==========================================
      console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Executing tool: ${toolName}`);
      console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Parameters:`, JSON.stringify(validatedParameters, null, 2));
      console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Timeout: ${timeout}ms`);
      console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Call Context:`, { callSid, phoneNumber });

      try {
        // Execute with timeout
        // Pass progress callback if provided
        let executionPromise;
        if (progressCallback && typeof tool.execute === 'function') {
          // Check if tool.execute accepts progressCallback as third parameter
          if (tool.execute.length >= 3) {
            // Tool accepts progressCallback as third parameter
            executionPromise = tool.execute(validatedParameters, callContext, progressCallback);
          } else {
            // Tool only accepts parameters and callContext, include progressCallback in callContext
            executionPromise = tool.execute(validatedParameters, { ...callContext, progressCallback });
          }
        } else {
          // No progress callback, execute normally
          executionPromise = tool.execute(validatedParameters, callContext);
        }
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Tool execution timeout: ${toolName} (exceeded ${timeout}ms)`)), timeout);
        });

        const result = await Promise.race([executionPromise, timeoutPromise]);
        
        const executionTime = Date.now() - startTime;
        const executionTimeSeconds = executionTime / 1000;
        span.setAttribute('tool.execution_time_ms', executionTime);
        span.setAttribute('tool.success', true);
        span.setStatus({ code: SpanStatusCode.OK });
        
        // Record tool metrics
        recordToolMetrics({
          toolName,
          duration: executionTimeSeconds,
          success: true
        });
        
        console.log(`✅ [${callSid}] [TOOL EXECUTOR] Tool ${toolName} completed successfully`);
        console.log(`✅ [${callSid}] [TOOL EXECUTOR] Execution time: ${executionTime}ms`);
        console.log(`✅ [${callSid}] [TOOL EXECUTOR] Result preview:`, JSON.stringify(result, null, 2).substring(0, 300));

        // Update usage statistics in database (async, don't wait)
        this.updateToolUsage(toolName).catch(err => {
          console.warn(`⚠️ [${callSid}] Failed to update tool usage stats:`, err.message);
        });

        span.end();
        return {
          success: true,
          result: result,
          executionTime: executionTime
        };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const executionTimeSeconds = executionTime / 1000;
        span.setAttribute('tool.execution_time_ms', executionTime);
        span.setAttribute('tool.success', false);
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        
        // Record tool metrics with error
        recordToolMetrics({
          toolName,
          duration: executionTimeSeconds,
          error: { type: error.name || 'unknown', message: error.message },
          success: false
        });
        
        console.error(`❌ [${callSid}] [TOOL EXECUTOR] Tool ${toolName} failed`);
        console.error(`❌ [${callSid}] [TOOL EXECUTOR] Execution time before failure: ${executionTime}ms`);
        console.error(`❌ [${callSid}] [TOOL EXECUTOR] Error:`, error.message || error);

        span.end();
        return {
          success: false,
          error: error.message || 'Tool execution failed',
          executionTime: executionTime
        };
      }
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.end();
      throw error;
    }
  }

  /**
   * Update tool usage statistics in database
   * @param {string} toolName - Tool name
   */
  async updateToolUsage(toolName) {
    try {
      await ToolConfig.findOneAndUpdate(
        { toolName },
        {
          $inc: { usageCount: 1 },
          lastUsed: new Date()
        },
        { upsert: false } // Don't create if doesn't exist
      );
    } catch (error) {
      // Silently fail - usage tracking is not critical
      console.warn(`Failed to update usage for tool ${toolName}:`, error.message);
    }
  }
}

export default ToolExecutor;

