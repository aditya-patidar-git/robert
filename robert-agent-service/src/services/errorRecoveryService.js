/**
 * Error Recovery Service
 * Provides user-friendly error messages and retry logic
 * Enhanced with circuit breakers and comprehensive error handling
 */

import circuitBreakerManager from '../utils/circuitBreaker.js';
import { isRetryableError } from '../utils/isRetryableError.js';

class ErrorRecoveryService {
  constructor() {
    this.retryCounts = new Map(); // callSid -> { toolName -> count }
    this.serviceMapping = {
      'openai': 'openai',
      'file_search': 'openai',
      'web_search': 'brave',
      'update_customer': 'crm',
      'reschedule_booking': 'crm'
    };
  }

  /**
   * Detect service from tool name
   * @param {string} toolName - Name of the tool
   * @returns {string} Service name
   */
  getServiceName(toolName) {
    return this.serviceMapping[toolName] || 'default';
  }

  /**
   * Check if error is an OpenAI 5xx error
   * @param {Error} error - Error object
   * @returns {boolean} True if OpenAI 5xx error
   */
  isOpenAI5xxError(error) {
    const statusCode = error.status || error.statusCode || error.response?.status;
    if (statusCode && [500, 502, 503, 504].includes(statusCode)) {
      return true;
    }
    
    const errorMessage = (error.message || String(error)).toLowerCase();
    const openai5xxIndicators = ['500', '502', '503', '504', 'internal server error', 'bad gateway', 'service unavailable', 'gateway timeout'];
    return openai5xxIndicators.some(indicator => errorMessage.includes(indicator));
  }

  /**
   * Check if error is a Twilio stream drop
   * @param {Error} error - Error object
   * @returns {boolean} True if Twilio stream drop
   */
  isTwilioStreamDrop(error) {
    const errorMessage = (error.message || String(error)).toLowerCase();
    const twilioIndicators = [
      'websocket',
      'stream',
      'connection closed',
      'connection reset',
      'econnreset',
      'twilio',
      'media stream'
    ];
    return twilioIndicators.some(indicator => errorMessage.includes(indicator));
  }

  /**
   * Get user-friendly error message
   * @param {Error} error - Error object
   * @param {string} toolName - Name of the tool that failed
   * @returns {string} - User-friendly error message
   */
  getUserFriendlyMessage(error, toolName) {
    const errorMessage = error.message || String(error);
    const errorLower = errorMessage.toLowerCase();

    // OpenAI 5xx errors
    if (this.isOpenAI5xxError(error)) {
      return "I'm experiencing some technical difficulties with my systems. Please hold on for a moment while I try again.";
    }

    // Twilio stream drop errors
    if (this.isTwilioStreamDrop(error)) {
      return "I'm having trouble with the connection. Let me reconnect and we can continue.";
    }

    // Network/timeout errors
    if (errorLower.includes('timeout') || errorLower.includes('network') || errorLower.includes('connection')) {
      return "I'm having trouble connecting right now. Please try again in a moment.";
    }

    // Authentication errors
    if (errorLower.includes('auth') || errorLower.includes('unauthorized') || errorLower.includes('permission')) {
      return "I don't have permission to access that right now. Let me try a different approach.";
    }

    // Not found errors
    if (errorLower.includes('not found') || errorLower.includes('404')) {
      return "I couldn't find what you're looking for. Could you provide more details?";
    }

    // Rate limit errors
    if (errorLower.includes('rate limit') || errorLower.includes('too many requests') || errorLower.includes('429')) {
      return "I'm processing too many requests right now. Please wait a moment and try again.";
    }

    // Circuit breaker errors
    if (errorLower.includes('circuit breaker') || errorLower.includes('unavailable')) {
      return "The service is temporarily unavailable. Please try again in a moment.";
    }

    // Tool-specific messages
    if (toolName === 'update_customer' || toolName === 'reschedule_booking') {
      return "I'm having trouble accessing the booking system. Please try again or I can help you with something else.";
    }

    if (toolName === 'web_search') {
      return "I couldn't search the web right now. Let me try again or we can continue without that information.";
    }

    if (toolName === 'email') {
      return "I couldn't send the email right now. Please try again or I can help you with something else.";
    }

    // Generic fallback
    return "Something went wrong. Let me try again, or I can help you with something else.";
  }

  /**
   * Determine if operation should be retried
   * @param {Error} error - Error object
   * @param {number} retryCount - Current retry count
   * @param {Object} config - ConversationBehaviorConfig errorHandling settings
   * @param {string} toolName - Name of the tool (optional)
   * @returns {boolean} - True if should retry
   */
  shouldRetry(error, retryCount, config, toolName = null) {
    if (!config?.errorHandling?.retryEnabled) {
      return false;
    }

    const maxRetries = config.errorHandling.maxRetries || 2;
    if (retryCount >= maxRetries) {
      return false;
    }

    // Check circuit breaker state
    if (toolName) {
      const serviceName = this.getServiceName(toolName);
      const breaker = circuitBreakerManager.getBreaker(serviceName);
      if (breaker.isOpen()) {
        return false; // Circuit is open, don't retry
      }
    }

    // Check if error is retryable using retry handler utility
    return isRetryableError(error);
  }

  /**
   * Get retry delay with exponential backoff
   * @param {number} retryCount - Current retry count
   * @param {Object} config - ConversationBehaviorConfig errorHandling settings
   * @returns {number} - Delay in milliseconds
   */
  getRetryDelay(retryCount, config) {
    const baseDelay = config?.errorHandling?.retryBackoffMs || 1000;
    return baseDelay * Math.pow(2, retryCount);
  }

  /**
   * Handle tool execution error
   * @param {string} callSid - Call SID
   * @param {string} toolName - Name of the tool
   * @param {Error} error - Error object
   * @param {Object} config - ConversationBehaviorConfig
   * @returns {Object} - Error handling result
   */
  handleToolError(callSid, toolName, error, config) {
    const key = `${callSid}_${toolName}`;
    const currentRetryCount = this.retryCounts.get(key) || 0;
    const serviceName = this.getServiceName(toolName);

    // Update circuit breaker
    const breaker = circuitBreakerManager.getBreaker(serviceName);
    breaker.onFailure(error);

    // Check if we should retry
    const shouldRetry = this.shouldRetry(error, currentRetryCount, config, toolName);
    const userMessage = config?.errorHandling?.userFriendlyErrorMessages 
      ? this.getUserFriendlyMessage(error, toolName)
      : error.message;

    // Detect specific error types
    const isOpenAI5xx = this.isOpenAI5xxError(error);
    const isTwilioDrop = this.isTwilioStreamDrop(error);

    if (shouldRetry) {
      const newRetryCount = currentRetryCount + 1;
      this.retryCounts.set(key, newRetryCount);
      const delay = this.getRetryDelay(currentRetryCount, config);

      console.log(`🔄 [${callSid}] Will retry ${toolName} (attempt ${newRetryCount}, delay: ${delay}ms)`);
      if (isOpenAI5xx) {
        console.warn(`⚠️ [${callSid}] OpenAI 5xx error detected for ${toolName}`);
      }
      if (isTwilioDrop) {
        console.warn(`⚠️ [${callSid}] Twilio stream drop detected for ${toolName}`);
      }

      return {
        shouldRetry: true,
        retryCount: newRetryCount,
        delay,
        userMessage: `Let me try again... ${userMessage}`,
        isOpenAI5xx,
        isTwilioDrop,
        circuitState: breaker.getState()
      };
    } else {
      // Clear retry count
      this.retryCounts.delete(key);

      console.log(`❌ [${callSid}] Tool ${toolName} failed (no retry): ${error.message}`);
      if (isOpenAI5xx) {
        console.error(`🔴 [${callSid}] OpenAI 5xx error - service may be degraded`);
      }
      if (isTwilioDrop) {
        console.error(`🔴 [${callSid}] Twilio stream drop - connection issue`);
      }

      return {
        shouldRetry: false,
        retryCount: currentRetryCount,
        userMessage,
        alternatives: this.suggestAlternatives(callSid, toolName),
        isOpenAI5xx,
        isTwilioDrop,
        circuitState: breaker.getState(),
        shouldFallbackToVoicemail: isOpenAI5xx || isTwilioDrop // Suggest voicemail for critical errors
      };
    }
  }

  /**
   * Suggest alternative actions when a tool fails
   * @param {string} callSid - Call SID
   * @param {string} failedTool - Name of the failed tool
   * @returns {Array<string>} - Array of alternative suggestions
   */
  suggestAlternatives(callSid, failedTool) {
    const alternatives = [];

    if (failedTool === 'update_customer' || failedTool === 'reschedule_booking') {
      alternatives.push("I can help you find information another way.");
      alternatives.push("Would you like to try again, or can I help you with something else?");
    } else if (failedTool === 'web_search') {
      alternatives.push("I can continue without that information.");
      alternatives.push("Would you like to try a different search?");
    } else if (failedTool === 'email') {
      alternatives.push("I can help you with something else while we wait.");
      alternatives.push("Would you like to try sending the email again?");
    } else {
      alternatives.push("I can help you with something else.");
      alternatives.push("Would you like to try again?");
    }

    return alternatives;
  }

  /**
   * Clear retry count for a call/tool
   * @param {string} callSid - Call SID
   * @param {string} toolName - Name of the tool (optional, clears all if not provided)
   */
  clearRetryCount(callSid, toolName) {
    if (toolName) {
      const key = `${callSid}_${toolName}`;
      this.retryCounts.delete(key);
    } else {
      // Clear all retries for this call
      const keysToDelete = [];
      for (const key of this.retryCounts.keys()) {
        if (key.startsWith(`${callSid}_`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.retryCounts.delete(key));
    }
  }

  /**
   * Get circuit breaker state for a service
   * @param {string} toolName - Name of the tool
   * @returns {Object} Circuit breaker state
   */
  getCircuitBreakerState(toolName) {
    const serviceName = this.getServiceName(toolName);
    const breaker = circuitBreakerManager.getBreaker(serviceName);
    return breaker.getState();
  }

  /**
   * Get all circuit breaker states
   * @returns {Array} Array of circuit breaker states
   */
  getAllCircuitBreakerStates() {
    return circuitBreakerManager.getAllStates();
  }
}

export default new ErrorRecoveryService();

