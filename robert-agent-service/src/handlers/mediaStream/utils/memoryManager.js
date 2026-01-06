import crossCallMemoryService from '../../../services/crossCallMemoryService.js';
import configManager from '../../../agent/configManager.js';

/**
 * Memory Manager
 * Handles cross-call memory consent and context injection
 */
export class MemoryManager {
  constructor(stateManager) {
    this.state = stateManager;
  }

  /**
   * Check for previous call memories and request consent if needed
   * Optimized to use a single database query instead of two
   */
  async checkAndRequestMemoryConsent() {
    try {
      if (!this.state.phoneNumber || !this.state.callSid) return;
      
      const { conversations } = await import('../../../shared/state.js');
      
      // OPTIMIZATION: Single query for 3 calls (enough for both consent check and summary)
      // This eliminates the duplicate query that was happening before
      const previousCalls = await crossCallMemoryService.retrievePreviousCalls(this.state.phoneNumber, 3);
      const hasPreviousCalls = previousCalls.length > 0;
      
      if (hasPreviousCalls) {
        // Generate memory summary from already-retrieved calls (no additional query)
        const memorySummary = crossCallMemoryService.getMemorySummaryFromCalls(previousCalls);
        
        if (memorySummary) {
          // Mark memory consent as requested
          conversations[this.state.callSid].memoryConsent.requested = true;
          conversations[this.state.callSid].memoryConsent.requestedAt = new Date();
          
          // Inject instruction to ask for consent, but don't inject full memory yet
          // The AI will ask: "Shall I pick up from our last conversation about [topic]?"
          const memoryConsentInstruction = `\n\nIMPORTANT: You have previous interaction history with this caller. You should ask for their consent before referencing it. Say something like: "Shall I pick up from our last conversation about [brief topic]?" Only reference previous interactions if they consent.`;
          
          // Wait for OpenAI WebSocket to be ready before sending session update
          // This prevents errors if called too early
          if (this.state.openaiWs && this.state.openaiWs.readyState === 1) {
            // Get current instructions and append memory consent instruction
            const currentLanguage = conversations[this.state.callSid]?.language || 'en';
            const currentConfig = configManager.getConfigForNumber(this.state.phoneNumber, currentLanguage);
            const updatedInstructions = currentConfig.instructions + memoryConsentInstruction;
            
            this.state.openaiWs.send(JSON.stringify({
              type: 'session.update',
              session: {
                instructions: updatedInstructions
              }
            }));
            
            console.log(`📚 [${this.state.callSid}] Memory consent prompt instruction injected for caller ${this.state.phoneNumber}`);
          } else {
            // If WebSocket not ready yet, wait a bit and retry (non-blocking)
            setTimeout(() => {
              if (this.state.openaiWs && this.state.openaiWs.readyState === 1) {
                const currentLanguage = conversations[this.state.callSid]?.language || 'en';
                const currentConfig = configManager.getConfigForNumber(this.state.phoneNumber, currentLanguage);
                const updatedInstructions = currentConfig.instructions + memoryConsentInstruction;
                
                try {
                  this.state.openaiWs.send(JSON.stringify({
                    type: 'session.update',
                    session: {
                      instructions: updatedInstructions
                    }
                  }));
                  console.log(`📚 [${this.state.callSid}] Memory consent prompt instruction injected (delayed) for caller ${this.state.phoneNumber}`);
                } catch (err) {
                  console.warn(`⚠️ [${this.state.callSid}] Could not inject memory consent instruction:`, err.message);
                }
              }
            }, 500);
          }
        }
      }
    } catch (error) {
      console.error(`❌ [${this.state.callSid}] Error checking memory consent:`, error);
      // Don't block call if memory check fails
    }
  }

  /**
   * Inject full memory context after user consents
   */
  async injectMemoryContext() {
    try {
      if (!this.state.phoneNumber || !this.state.callSid) return;
      
      const memorySummary = await crossCallMemoryService.getMemorySummary(this.state.phoneNumber);
      
      if (memorySummary && this.state.openaiWs && this.state.openaiWs.readyState === 1) {
        const memoryContext = `\n\nPREVIOUS INTERACTION CONTEXT (user has consented to use this): ${memorySummary}\nYou may now reference this context naturally in the conversation.`;
        
        const currentConfig = configManager.getConfigForNumber(this.state.phoneNumber);
        const updatedInstructions = currentConfig.instructions + memoryContext;
        
        this.state.openaiWs.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions: updatedInstructions
          }
        }));
        
        console.log(`📚 [${this.state.callSid}] Full memory context injected after consent for caller ${this.state.phoneNumber}`);
      }
    } catch (error) {
      console.error(`❌ [${this.state.callSid}] Error injecting memory context:`, error);
    }
  }
}

