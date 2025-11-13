import { getEncoding } from 'js-tiktoken';
import modelDiscoveryService from './modelDiscoveryService.js';

class TokenManagementService {
  constructor() {
    this.encoders = new Map();
    this.warningThreshold = parseFloat(process.env.TOKEN_WARNING_THRESHOLD) || 0.8;
    this.criticalThreshold = parseFloat(process.env.TOKEN_CRITICAL_THRESHOLD) || 0.9;
    this.bufferPercentage = parseFloat(process.env.TOKEN_BUFFER_PERCENTAGE) || 0.2;
    this.minMessagesToKeep = parseInt(process.env.MIN_MESSAGES_TO_KEEP) || 6;
  }

  /**
   * Get encoder for a specific model
   * @param {string} modelId - Model identifier
   * @returns {Object} - Tiktoken encoder
   */
  getEncoder(modelId) {
    if (!this.encoders.has(modelId)) {
      try {
        // Map model IDs to encoding names
        // Most OpenAI models use 'cl100k_base' encoding
        let encodingName = 'cl100k_base'; // Default for GPT-4, GPT-3.5-turbo, etc.
        
        if (modelId.includes('gpt-4o') || modelId.includes('gpt-4')) {
          encodingName = 'cl100k_base';
        } else if (modelId.includes('gpt-3.5')) {
          encodingName = 'cl100k_base';
        } else if (modelId.includes('realtime')) {
          encodingName = 'cl100k_base';
        } else if (modelId.includes('gpt-3')) {
          encodingName = 'p50k_base';
        }
        
        const encoder = getEncoding(encodingName);
        this.encoders.set(modelId, encoder);
        return encoder;
      } catch (error) {
        console.warn(`Could not get encoder for model ${modelId}, using fallback estimation:`, error.message);
        return null;
      }
    }
    return this.encoders.get(modelId);
  }

  /**
   * Count tokens in text for a specific model
   * @param {string} text - Text to count
   * @param {string} modelId - Model identifier
   * @returns {number} - Token count
   */
  countTokens(text, modelId) {
    if (!text) return 0;
    
    const encoder = this.getEncoder(modelId);
    if (encoder) {
      try {
        return encoder.encode(text).length;
      } catch (error) {
        console.warn('Error encoding text, using fallback estimation:', error.message);
      }
    }
    
    // Fallback: rough estimation (1 token ≈ 4 characters for English)
    return Math.ceil(text.length / 4);
  }

  /**
   * Count tokens for a single message object
   * @param {Object} message - Message object with role and content
   * @param {string} modelId - Model identifier
   * @returns {number} - Token count
   */
  countMessageTokens(message, modelId) {
    if (!message || !message.content) return 0;
    
    // Count role + content + formatting overhead (approximately 4 tokens per message)
    const contentTokens = this.countTokens(message.content, modelId);
    const roleTokens = this.countTokens(message.role || '', modelId);
    const overhead = 4; // Approximate overhead for message formatting
    
    return contentTokens + roleTokens + overhead;
  }

  /**
   * Count total tokens for an array of messages
   * @param {Array} messages - Array of message objects
   * @param {string} modelId - Model identifier
   * @returns {number} - Total token count
   */
  countMessagesTokens(messages, modelId) {
    if (!Array.isArray(messages) || messages.length === 0) return 0;
    
    return messages.reduce((total, message) => {
      return total + this.countMessageTokens(message, modelId);
    }, 0);
  }

  /**
   * Get context limit for a model
   * @param {string} modelId - Model identifier
   * @returns {number} - Context limit in tokens
   */
  getContextLimit(modelId) {
    return modelDiscoveryService.getContextLimit(modelId);
  }

  /**
   * Check if truncation is needed
   * @param {Array} messages - Array of messages
   * @param {string} modelId - Model identifier
   * @param {number} maxTokens - Maximum tokens allowed (optional, uses model limit if not provided)
   * @returns {Object} - { shouldTruncate: boolean, currentTokens: number, limit: number, percentage: number }
   */
  shouldTruncate(messages, modelId, maxTokens = null) {
    const limit = maxTokens || this.getContextLimit(modelId);
    const currentTokens = this.countMessagesTokens(messages, modelId);
    
    // Reserve buffer for response tokens
    const effectiveLimit = Math.floor(limit * (1 - this.bufferPercentage));
    
    return {
      shouldTruncate: currentTokens > effectiveLimit,
      currentTokens,
      limit,
      effectiveLimit,
      percentage: (currentTokens / limit) * 100,
      warningLevel: this.getWarningLevel(currentTokens, limit)
    };
  }

  /**
   * Get warning level based on token usage
   * @param {number} currentTokens - Current token count
   * @param {number} limit - Token limit
   * @returns {string} - 'normal', 'warning', 'critical', 'emergency'
   */
  getWarningLevel(currentTokens, limit) {
    const percentage = (currentTokens / limit) * 100;
    
    if (percentage >= 95) return 'emergency';
    if (percentage >= this.criticalThreshold * 100) return 'critical';
    if (percentage >= this.warningThreshold * 100) return 'warning';
    return 'normal';
  }

  /**
   * Prioritize messages for retention (helper for truncation)
   * @param {Array} messages - Array of messages
   * @param {Object} options - Options for prioritization
   * @returns {Array} - Messages with priority scores
   */
  prioritizeMessages(messages, options = {}) {
    const messagePriorityService = require('./messagePriorityService.js').default;
    return messages.map((message, index) => {
      const priority = messagePriorityService.assignPriority(message, {
        index,
        totalMessages: messages.length,
        ...options
      });
      return {
        ...message,
        _priority: priority,
        _index: index
      };
    });
  }

  /**
   * Truncate messages intelligently
   * @param {Array} messages - Array of messages
   * @param {string} modelId - Model identifier
   * @param {number} maxTokens - Maximum tokens allowed
   * @param {Object} options - Truncation options
   * @returns {Object} - { messages: Array, removedCount: number, strategy: string, tokensBefore: number, tokensAfter: number }
   */
  async truncateMessages(messages, modelId, maxTokens, options = {}) {
    const tokensBefore = this.countMessagesTokens(messages, modelId);
    const effectiveLimit = Math.floor(maxTokens * (1 - this.bufferPercentage));
    
    if (tokensBefore <= effectiveLimit) {
      return {
        messages,
        removedCount: 0,
        strategy: 'none',
        tokensBefore,
        tokensAfter: tokensBefore
      };
    }

    // Always keep system message (first message)
    const systemMessage = messages[0]?.role === 'system' ? messages[0] : null;
    const otherMessages = systemMessage ? messages.slice(1) : messages;

    // Prioritize messages
    const prioritized = this.prioritizeMessages(otherMessages, options);
    
    // Sort by priority (descending), then by index (descending for recent messages)
    prioritized.sort((a, b) => {
      if (b._priority !== a._priority) {
        return b._priority - a._priority;
      }
      return b._index - a._index; // Keep more recent messages if same priority
    });

    // Keep messages until we're under the limit
    const keptMessages = [];
    let currentTokens = systemMessage ? this.countMessageTokens(systemMessage, modelId) : 0;
    
    for (const msg of prioritized) {
      const msgTokens = this.countMessageTokens(msg, modelId);
      if (currentTokens + msgTokens <= effectiveLimit) {
        // Remove internal priority fields
        const { _priority, _index, ...cleanMsg } = msg;
        keptMessages.push(cleanMsg);
        currentTokens += msgTokens;
      } else {
        break;
      }
    }

    // Ensure we keep minimum number of messages
    if (keptMessages.length < this.minMessagesToKeep && otherMessages.length >= this.minMessagesToKeep) {
      const recentMessages = otherMessages.slice(-this.minMessagesToKeep);
      const recentTokens = this.countMessagesTokens(recentMessages, modelId);
      
      if (recentTokens <= effectiveLimit) {
        keptMessages.length = 0;
        keptMessages.push(...recentMessages);
        currentTokens = recentTokens;
      }
    }

    // Reconstruct message array with system message first, then kept messages in original order
    const finalMessages = [];
    if (systemMessage) {
      finalMessages.push(systemMessage);
    }
    
    // Sort kept messages back to original order
    const keptIndices = keptMessages.map(m => {
      const originalIndex = otherMessages.findIndex(om => 
        om.role === m.role && om.content === m.content
      );
      return { message: m, originalIndex };
    }).sort((a, b) => a.originalIndex - b.originalIndex);
    
    finalMessages.push(...keptIndices.map(ki => ki.message));

    const tokensAfter = this.countMessagesTokens(finalMessages, modelId);
    const removedCount = messages.length - finalMessages.length;

    return {
      messages: finalMessages,
      removedCount,
      strategy: 'priority-based',
      tokensBefore,
      tokensAfter
    };
  }

  /**
   * Summarize older messages (delegates to summarization service)
   * @param {Array} messages - Messages to summarize
   * @param {string} modelId - Model identifier
   * @returns {Promise<Object>} - Summary message object
   */
  async summarizeMessages(messages, modelId) {
    const messageSummarizationService = require('./messageSummarizationService.js').default;
    return await messageSummarizationService.summarizeConversationSegment(messages, modelId);
  }

  /**
   * Main context optimization method
   * @param {Array} messages - Array of messages
   * @param {string} modelId - Model identifier
   * @param {number} maxTokens - Maximum tokens (optional)
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} - Optimized messages and metadata
   */
  async optimizeContext(messages, modelId, maxTokens = null, options = {}) {
    const limit = maxTokens || this.getContextLimit(modelId);
    const check = this.shouldTruncate(messages, modelId, limit);
    
    if (!check.shouldTruncate) {
      return {
        messages,
        optimized: false,
        tokenCount: check.currentTokens,
        warningLevel: check.warningLevel
      };
    }

    // First, try simple truncation
    let result = await this.truncateMessages(messages, modelId, limit, options);
    
    // If still over limit after truncation, try summarization
    const afterCheck = this.shouldTruncate(result.messages, modelId, limit);
    if (afterCheck.shouldTruncate && options.summarizationEnabled !== false) {
      // Get messages that were removed or are old
      const systemMessage = result.messages[0]?.role === 'system' ? result.messages[0] : null;
      const otherMessages = systemMessage ? result.messages.slice(1) : result.messages;
      
      // Summarize oldest messages if we have many
      if (otherMessages.length > 10) {
        const toSummarize = otherMessages.slice(0, Math.floor(otherMessages.length / 2));
        const summary = await this.summarizeMessages(toSummarize, modelId);
        
        if (summary) {
          const remaining = otherMessages.slice(Math.floor(otherMessages.length / 2));
          result.messages = systemMessage 
            ? [systemMessage, summary, ...remaining]
            : [summary, ...remaining];
          
          result.strategy = 'truncation-with-summarization';
          result.tokensAfter = this.countMessagesTokens(result.messages, modelId);
        }
      }
    }

    return {
      messages: result.messages,
      optimized: true,
      tokenCount: result.tokensAfter,
      tokensBefore: result.tokensBefore,
      removedCount: result.removedCount,
      strategy: result.strategy,
      warningLevel: this.getWarningLevel(result.tokensAfter, limit)
    };
  }
}

export default new TokenManagementService();

