import tokenLimitService from '../../../services/tokenLimitService.js';
import ConversationContext from '../../../database/models/ConversationContext.js';
import configManager from '../../../agent/configManager.js';

/**
 * Token Manager
 * Manages token limits for conversation context
 */
export class TokenManager {
  constructor(stateManager) {
    this.state = stateManager;
  }

  /**
   * Manage token limits for conversation
   */
  async manageTokenLimits() {
    try {
      if (!this.state.callSid || !this.state.openaiWs || this.state.openaiWs.readyState !== 1) {
        return;
      }

      // Get current model from config
      const config = configManager.getConfigForNumber(this.state.phoneNumber);
      const modelName = config?.model?.id || 'gpt-4o-realtime-preview-2024-12-17';

      // Get conversation context from database or build from transcript
      const { conversations } = await import('../../../shared/state.js');
      let conversationContext = await ConversationContext.findOne({ callSid: this.state.callSid }).lean();
      
      // Build messages array from transcript if context doesn't exist
      const messages = [];
      if (conversations[this.state.callSid]?.transcript) {
        conversations[this.state.callSid].transcript.forEach(entry => {
          messages.push({
            role: entry.role === 'agent' ? 'assistant' : 'user',
            content: entry.text
          });
        });
      }

      // If we have stored context, use it
      if (conversationContext && conversationContext.messages) {
        messages.push(...conversationContext.messages.map(m => ({
          role: m.role,
          content: m.content
        })));
      }

      // Manage token limits
      const result = await tokenLimitService.manageTokenLimits(messages, modelName);

      if (result.action !== 'none') {
        console.log(`📊 [${this.state.callSid}] Token management: ${result.action} - ${result.currentTokens}/${result.maxTokens} tokens`);
        
        // Update conversation context in database
        if (result.messages && result.messages.length > 0) {
          await ConversationContext.findOneAndUpdate(
            { callSid: this.state.callSid },
            {
              callSid: this.state.callSid,
              modelId: modelName,
              contextLimit: result.maxTokens,
              currentTokens: result.currentTokens,
              messages: result.messages.map((msg, idx) => ({
                role: msg.role,
                content: msg.content,
                timestamp: new Date(),
                priority: 5,
                tokenCount: tokenLimitService.countTokens(msg.content || '', modelName),
                isSummary: result.summarized && idx === 1 // Second message is summary
              })),
              $push: {
                truncationHistory: {
                  tokensBefore: result.currentTokens + (result.tokensRemoved || 0),
                  tokensAfter: result.currentTokens,
                  messagesRemoved: result.messagesRemoved || 0,
                  strategy: result.action
                }
              }
            },
            { upsert: true, new: true }
          );
        }
      }
    } catch (error) {
      console.error(`❌ [${this.state.callSid}] Error in token limit management:`, error);
      // Don't throw - token management is non-critical
    }
  }
}

