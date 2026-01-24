/**
 * Token Limit Service
 * Manages token limits with intelligent truncation and summarization
 */

import { encoding_for_model } from 'tiktoken';
import OpenAI from 'openai';
// dotenv is already loaded in index.js, no need to reload here

class TokenLimitService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.openai = this.openaiApiKey ? new OpenAI({ apiKey: this.openaiApiKey }) : null;
    
    // Default token limits (will be overridden by capability registry)
    this.defaultLimits = {
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
      softLimitPercent: 0.8, // 80% of max
      hardLimitPercent: 0.95 // 95% of max
    };
    
    // Cache for encodings
    this.encodingCache = new Map();
  }

  /**
   * Get encoding for a model
   * @param {string} modelName - Model name
   * @returns {Object} Tiktoken encoding
   */
  getEncoding(modelName) {
    if (!this.encodingCache.has(modelName)) {
      try {
        // Try to get encoding for the model
        const encoding = encoding_for_model(modelName);
        this.encodingCache.set(modelName, encoding);
      } catch (error) {
        // Fallback to cl100k_base (used by GPT-4, GPT-3.5)
        console.warn(`⚠️ [TOKEN LIMIT] Could not get encoding for ${modelName}, using cl100k_base`);
        const encoding = encoding_for_model('gpt-4');
        this.encodingCache.set(modelName, encoding);
      }
    }
    return this.encodingCache.get(modelName);
  }

  /**
   * Count tokens in text
   * @param {string} text - Text to count
   * @param {string} modelName - Model name (default: gpt-4)
   * @returns {number} Token count
   */
  countTokens(text, modelName = 'gpt-4') {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    try {
      const encoding = this.getEncoding(modelName);
      return encoding.encode(text).length;
    } catch (error) {
      // Fallback: approximate 1 token = 4 characters
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Count tokens in messages array
   * @param {Array} messages - Array of message objects
   * @param {string} modelName - Model name
   * @returns {number} Total token count
   */
  countTokensInMessages(messages, modelName = 'gpt-4') {
    if (!Array.isArray(messages)) {
      return 0;
    }

    let total = 0;
    messages.forEach(msg => {
      // Count role + content
      total += this.countTokens(msg.role || '', modelName);
      total += this.countTokens(msg.content || '', modelName);
      
      // Count tool calls if present
      if (msg.tool_calls) {
        msg.tool_calls.forEach(toolCall => {
          total += this.countTokens(JSON.stringify(toolCall), modelName);
        });
      }
      
      // Add overhead per message (formatting, etc.)
      total += 4; // Approximate overhead
    });

    return total;
  }

  /**
   * Get token limits for a model
   * @param {string} modelName - Model name
   * @returns {Object} Token limits
   */
  async getTokenLimits(modelName) {
    // Try to get from capability registry if available
    try {
      const configManager = (await import('../agent/configManager.js')).default;
      const aiConfig = configManager.getAIConfig();
      
      if (aiConfig && aiConfig.model) {
        // Check if we have capability registry
        // For now, use defaults
        return {
          maxContextTokens: this.defaultLimits.maxContextTokens,
          maxOutputTokens: this.defaultLimits.maxOutputTokens,
          softLimit: Math.floor(this.defaultLimits.maxContextTokens * this.defaultLimits.softLimitPercent),
          hardLimit: Math.floor(this.defaultLimits.maxContextTokens * this.defaultLimits.hardLimitPercent)
        };
      }
    } catch (error) {
      // Fallback to defaults
    }

    // Return defaults
    return {
      maxContextTokens: this.defaultLimits.maxContextTokens,
      maxOutputTokens: this.defaultLimits.maxOutputTokens,
      softLimit: Math.floor(this.defaultLimits.maxContextTokens * this.defaultLimits.softLimitPercent),
      hardLimit: Math.floor(this.defaultLimits.maxContextTokens * this.defaultLimits.hardLimitPercent)
    };
  }

  /**
   * Truncate conversation by removing oldest messages
   * @param {Array} messages - Array of messages
   * @param {number} maxTokens - Maximum tokens allowed
   * @param {string} modelName - Model name
   * @param {Object} options - Truncation options
   * @returns {Object} Truncated messages and metadata
   */
  async truncateConversation(messages, maxTokens, modelName = 'gpt-4', options = {}) {
    const {
      preserveSystemInstructions = true,
      preserveLastNTurns = 5,
      preserveToolResults = true
    } = options;

    if (!Array.isArray(messages) || messages.length === 0) {
      return {
        messages: [],
        tokensRemoved: 0,
        messagesRemoved: 0
      };
    }

    // Separate system instructions and other messages
    const systemMessages = [];
    const otherMessages = [];
    const toolResults = [];

    messages.forEach(msg => {
      if (msg.role === 'system') {
        systemMessages.push(msg);
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        toolResults.push(msg);
      } else {
        otherMessages.push(msg);
      }
    });

    // Calculate current token count
    let currentTokens = this.countTokensInMessages(messages, modelName);
    let tokensRemoved = 0;
    let messagesRemoved = 0;

    // If under limit, return as-is
    if (currentTokens <= maxTokens) {
      return {
        messages: [...messages],
        tokensRemoved: 0,
        messagesRemoved: 0,
        truncated: false
      };
    }

    // Preserve last N turns
    const lastNTurns = otherMessages.slice(-preserveLastNTurns * 2); // *2 because each turn has user + assistant
    const messagesToProcess = otherMessages.slice(0, -preserveLastNTurns * 2);

    // Remove oldest messages until under limit
    const truncatedMessages = [...messagesToProcess];
    while (currentTokens > maxTokens && truncatedMessages.length > 0) {
      const removed = truncatedMessages.shift();
      const removedTokens = this.countTokensInMessages([removed], modelName);
      currentTokens -= removedTokens;
      tokensRemoved += removedTokens;
      messagesRemoved++;
    }

    // Reconstruct messages
    const finalMessages = [];
    if (preserveSystemInstructions) {
      finalMessages.push(...systemMessages);
    }
    finalMessages.push(...truncatedMessages);
    if (preserveToolResults) {
      finalMessages.push(...toolResults);
    }
    finalMessages.push(...lastNTurns);

    return {
      messages: finalMessages,
      tokensRemoved,
      messagesRemoved,
      truncated: true,
      finalTokenCount: this.countTokensInMessages(finalMessages, modelName)
    };
  }

  /**
   * Summarize older messages and inject summary
   * @param {Array} messages - Array of messages
   * @param {number} maxTokens - Maximum tokens allowed
   * @param {string} modelName - Model name
   * @returns {Promise<Object>} Messages with summary and metadata
   */
  async summarizeAndContinue(messages, maxTokens, modelName = 'gpt-4') {
    if (!this.openai) {
      // Fallback to truncation if OpenAI not available
      return await this.truncateConversation(messages, maxTokens, modelName);
    }

    try {
      // Separate messages to summarize vs keep
      const systemMessages = messages.filter(m => m.role === 'system');
      const recentMessages = messages.slice(-10); // Keep last 10 messages
      const olderMessages = messages.slice(systemMessages.length, -10);

      if (olderMessages.length === 0) {
        // Nothing to summarize
        return {
          messages: [...messages],
          tokensRemoved: 0,
          messagesRemoved: 0,
          summarized: false
        };
      }

      // Generate summary of older messages
      const summaryPrompt = `Summarize the following conversation history in 2-3 sentences, focusing on key decisions, actions taken, and important context:\n\n${olderMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`;
      
      const summaryResponse = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use cheaper model for summarization
        messages: [
          {
            role: 'system',
            content: 'You are a conversation summarizer. Create concise summaries of conversation history.'
          },
          {
            role: 'user',
            content: summaryPrompt
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      });

      const summary = summaryResponse.choices[0]?.message?.content || 'Previous conversation context.';

      // Reconstruct messages with summary
      const summarizedMessages = [
        ...systemMessages,
        {
          role: 'system',
          content: `Previous conversation summary: ${summary}`
        },
        ...recentMessages
      ];

      const finalTokenCount = this.countTokensInMessages(summarizedMessages, modelName);

      return {
        messages: summarizedMessages,
        tokensRemoved: this.countTokensInMessages(olderMessages, modelName) - this.countTokens(summary, modelName),
        messagesRemoved: olderMessages.length,
        summarized: true,
        summary,
        finalTokenCount
      };
    } catch (error) {
      console.error('❌ [TOKEN LIMIT] Error generating summary, falling back to truncation:', error);
      // Fallback to truncation
      return await this.truncateConversation(messages, maxTokens, modelName);
    }
  }

  /**
   * Manage conversation context to stay within token limits
   * @param {Array} messages - Current messages
   * @param {string} modelName - Model name
   * @param {Object} options - Management options
   * @returns {Promise<Object>} Managed messages and metadata
   */
  async manageTokenLimits(messages, modelName = 'gpt-4', options = {}) {
    const limits = await this.getTokenLimits(modelName);
    const currentTokens = this.countTokensInMessages(messages, modelName);

    // If under soft limit, no action needed
    if (currentTokens <= limits.softLimit) {
      return {
        messages: [...messages],
        action: 'none',
        currentTokens,
        maxTokens: limits.maxContextTokens
      };
    }

    // If over hard limit, use summarization
    if (currentTokens > limits.hardLimit) {
      console.log(`⚠️ [TOKEN LIMIT] Hard limit exceeded (${currentTokens}/${limits.maxContextTokens}), using summarization`);
      const result = await this.summarizeAndContinue(messages, limits.hardLimit, modelName);
      return {
        ...result,
        action: 'summarize',
        currentTokens: result.finalTokenCount || currentTokens,
        maxTokens: limits.maxContextTokens
      };
    }

    // If between soft and hard limit, use truncation
    console.log(`⚠️ [TOKEN LIMIT] Soft limit exceeded (${currentTokens}/${limits.maxContextTokens}), truncating oldest messages`);
    const result = await this.truncateConversation(messages, limits.softLimit, modelName);
    return {
      ...result,
      action: 'truncate',
      currentTokens: result.finalTokenCount || currentTokens,
      maxTokens: limits.maxContextTokens
    };
  }
}

export default new TokenLimitService();

