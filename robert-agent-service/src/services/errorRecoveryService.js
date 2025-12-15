/**
 * Error Recovery Service
 * Provides user-friendly error messages and retry logic
 */

class ErrorRecoveryService {
  constructor() {
    this.retryCounts = new Map(); // callSid -> { toolName -> count }
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
    if (errorLower.includes('rate limit') || errorLower.includes('too many requests')) {
      return "I'm processing too many requests right now. Please wait a moment and try again.";
    }

    // Tool-specific messages
    if (toolName === 'crm_browser') {
      return "I'm having trouble accessing the booking system. Please try again or I can help you with something else.";
    }

    if (toolName === 'web_search') {
      return "I couldn't search the web right now. Let me try again or we can continue without that information.";
    }

    if (toolName === 'calendar') {
      return "I'm having trouble accessing the calendar. Please try again in a moment.";
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
   * @returns {boolean} - True if should retry
   */
  shouldRetry(error, retryCount, config) {
    if (!config?.errorHandling?.retryEnabled) {
      return false;
    }

    const maxRetries = config.errorHandling.maxRetries || 2;
    if (retryCount >= maxRetries) {
      return false;
    }

    const errorMessage = error.message || String(error);
    const errorLower = errorMessage.toLowerCase();

    // Retry on transient errors
    const retryableErrors = [
      'timeout',
      'network',
      'connection',
      'rate limit',
      'temporary',
      '503',
      '502',
      '504'
    ];

    return retryableErrors.some(keyword => errorLower.includes(keyword));
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

    const shouldRetry = this.shouldRetry(error, currentRetryCount, config);
    const userMessage = config?.errorHandling?.userFriendlyErrorMessages 
      ? this.getUserFriendlyMessage(error, toolName)
      : error.message;

    if (shouldRetry) {
      const newRetryCount = currentRetryCount + 1;
      this.retryCounts.set(key, newRetryCount);
      const delay = this.getRetryDelay(currentRetryCount, config);

      console.log(`🔄 [${callSid}] Will retry ${toolName} (attempt ${newRetryCount}, delay: ${delay}ms)`);

      return {
        shouldRetry: true,
        retryCount: newRetryCount,
        delay,
        userMessage: `Let me try again... ${userMessage}`
      };
    } else {
      // Clear retry count
      this.retryCounts.delete(key);

      console.log(`❌ [${callSid}] Tool ${toolName} failed (no retry): ${error.message}`);

      return {
        shouldRetry: false,
        retryCount: currentRetryCount,
        userMessage,
        alternatives: this.suggestAlternatives(callSid, toolName)
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

    if (failedTool === 'crm_browser') {
      alternatives.push("I can help you find information another way.");
      alternatives.push("Would you like to try again, or can I help you with something else?");
    } else if (failedTool === 'web_search') {
      alternatives.push("I can continue without that information.");
      alternatives.push("Would you like to try a different search?");
    } else if (failedTool === 'calendar') {
      alternatives.push("I can help you check availability another way.");
      alternatives.push("Would you like to try again later?");
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
}

export default new ErrorRecoveryService();

