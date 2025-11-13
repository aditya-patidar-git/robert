import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class MessageSummarizationService {
  constructor() {
    this.summarizationEnabled = process.env.SUMMARIZATION_ENABLED !== 'false';
  }

  /**
   * Summarize a batch of messages
   * @param {Array} messages - Array of messages to summarize
   * @param {string} modelId - Model identifier
   * @returns {Promise<Object|null>} - Summary message object or null if summarization fails
   */
  async summarizeConversationSegment(messages, modelId) {
    if (!this.summarizationEnabled || !messages || messages.length === 0) {
      return null;
    }

    try {
      // Convert messages to conversation text
      const conversationText = messages
        .map(msg => {
          const role = msg.role === 'user' ? 'User' : (msg.role === 'assistant' ? 'Assistant' : 'System');
          return `${role}: ${msg.content || ''}`;
        })
        .join('\n');

      // Create summarization prompt
      const summarizationPrompt = `Summarize the following conversation segment concisely. 
Preserve key information: user intent, important decisions, specific details mentioned (names, dates, numbers), and outcomes.
Keep it brief (2-3 sentences maximum).

Conversation:
${conversationText}

Summary:`;

      // Use a lightweight model for summarization to save tokens
      const summaryModel = modelId.includes('gpt-4') ? 'gpt-4o-mini' : 'gpt-3.5-turbo';
      
      const response = await openai.chat.completions.create({
        model: summaryModel,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise summaries of conversations.'
          },
          {
            role: 'user',
            content: summarizationPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 150
      });

      const summaryText = response.choices[0]?.message?.content?.trim();
      
      if (!summaryText) {
        return null;
      }

      // Create summary message object
      return this.createSummaryMessage(messages, summaryText);
    } catch (error) {
      console.error('Error summarizing conversation segment:', error.message);
      return null;
    }
  }

  /**
   * Create a summary message object
   * @param {Array} originalMessages - Original messages that were summarized
   * @param {string} summary - Summary text
   * @returns {Object} - Summary message object
   */
  createSummaryMessage(originalMessages, summary) {
    return {
      role: 'system',
      content: `[Earlier conversation summary] ${summary}`,
      isSummary: true,
      originalMessageCount: originalMessages.length,
      originalMessageIds: originalMessages.map((msg, idx) => `msg_${idx}`),
      summarizedAt: new Date()
    };
  }

  /**
   * Summarize multiple segments of a conversation
   * @param {Array} messages - All messages
   * @param {number} segmentSize - Number of messages per segment
   * @param {string} modelId - Model identifier
   * @returns {Promise<Array>} - Array of summary messages
   */
  async summarizeMultipleSegments(messages, segmentSize = 10, modelId) {
    if (!this.summarizationEnabled || messages.length <= segmentSize) {
      return [];
    }

    const summaries = [];
    const segments = [];
    
    // Group messages into segments (excluding system message and recent messages)
    const systemMessage = messages[0]?.role === 'system' ? messages[0] : null;
    const otherMessages = systemMessage ? messages.slice(1) : messages;
    
    // Keep last 10 messages, summarize the rest
    const toSummarize = otherMessages.slice(0, -10);
    const recentMessages = otherMessages.slice(-10);

    // Create segments
    for (let i = 0; i < toSummarize.length; i += segmentSize) {
      segments.push(toSummarize.slice(i, i + segmentSize));
    }

    // Summarize each segment
    for (const segment of segments) {
      const summary = await this.summarizeConversationSegment(segment, modelId);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries;
  }
}

export default new MessageSummarizationService();

