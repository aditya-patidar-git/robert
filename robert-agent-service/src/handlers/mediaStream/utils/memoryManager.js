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
          // CRITICAL: Do NOT assume user intent from previous calls - wait for explicit request
          const memoryConsentInstruction = `\n\nIMPORTANT: You have previous interaction history with this caller. DO NOT assume they want to continue or book anything from previous calls. You should ONLY ask for their consent to reference previous interactions, saying something like: "I see we've spoken before. Would you like me to reference our previous conversation, or is this a new inquiry?" ONLY reference previous interactions if they explicitly consent AND explicitly state their current intent. Do NOT call booking tools or assume booking intent unless the user explicitly requests it in THIS call.`;
          
          // Get current instructions and append memory consent instruction
          const currentLanguage = conversations[this.state.callSid]?.language || 'en';
          const currentConfig = configManager.getConfigForNumber(this.state.phoneNumber, currentLanguage);
          const updatedInstructions = currentConfig.instructions + memoryConsentInstruction;
          
          // Use robust send method with connection manager support (queues if not ready)
          const sent = this.state.sendToOpenAI({
            type: 'session.update',
            session: {
              modalities: ['audio', 'text'], // CRITICAL: Preserve audio modality
              instructions: updatedInstructions
            }
          }, { priority: 'high' });
          
          if (sent) {
            console.log(`📚 [${this.state.callSid}] Memory consent prompt instruction injected for caller ${this.state.phoneNumber}`);
          } else {
            // If WebSocket not ready yet, wait a bit and retry (non-blocking)
            setTimeout(() => {
              const currentLanguage = conversations[this.state.callSid]?.language || 'en';
              const currentConfig = configManager.getConfigForNumber(this.state.phoneNumber, currentLanguage);
                const updatedInstructions = currentConfig.instructions + memoryConsentInstruction;
                
                try {
                  // Use robust send method
                  this.state.sendToOpenAI({
                    type: 'session.update',
                    session: {
                      modalities: ['audio', 'text'], // CRITICAL: Preserve audio modality
                      instructions: updatedInstructions
                    }
                  }, { priority: 'high' });
                  console.log(`📚 [${this.state.callSid}] Memory consent prompt instruction injected (delayed) for caller ${this.state.phoneNumber}`);
                } catch (err) {
                  console.warn(`⚠️ [${this.state.callSid}] Could not inject memory consent instruction:`, err.message);
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
      
      if (memorySummary) {
        const memoryContext = `\n\nPREVIOUS INTERACTION CONTEXT (user has consented to use this): ${memorySummary}\nYou may now reference this context naturally in the conversation.`;
        
        const currentConfig = configManager.getConfigForNumber(this.state.phoneNumber);
        const updatedInstructions = currentConfig.instructions + memoryContext;
        
        // Use robust send method with connection manager support
        this.state.sendToOpenAI({
          type: 'session.update',
          session: {
            modalities: ['audio', 'text'], // CRITICAL: Preserve audio modality
            instructions: updatedInstructions
          }
        }, { priority: 'high' });
        
        console.log(`📚 [${this.state.callSid}] Full memory context injected after consent for caller ${this.state.phoneNumber}`);
      }
    } catch (error) {
      console.error(`❌ [${this.state.callSid}] Error injecting memory context:`, error);
    }
  }
}

