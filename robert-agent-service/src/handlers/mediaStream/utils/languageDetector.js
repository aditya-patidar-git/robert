import multilingualService from '../../../services/multilingualService.js';
import configManager from '../../../agent/configManager.js';

/**
 * Language Detector
 * Handles language detection and switching
 */
export class LanguageDetector {
  constructor(stateManager) {
    this.state = stateManager;
  }

  /**
   * Switch language and update OpenAI session
   */
  async switchLanguage(detectedLanguageCode) {
    try {
      if (!this.state.callSid || !this.state.openaiWs || this.state.openaiWs.readyState !== 1) {
        return false;
      }
      
      // Validate language
      if (!multilingualService.isValidLanguage(detectedLanguageCode)) {
        console.warn(`⚠️ [${this.state.callSid}] Invalid language code: ${detectedLanguageCode}`);
        return false;
      }
      
      // Get language config
      const languageConfig = multilingualService.getLanguageConfig(detectedLanguageCode);
      const languageInstructions = multilingualService.getSystemInstructions(detectedLanguageCode);
      
      // Update conversation state
      const { conversations } = await import('../../../shared/state.js');
      if (conversations[this.state.callSid]) {
        conversations[this.state.callSid].language = detectedLanguageCode;
        conversations[this.state.callSid].locale = languageConfig.code;
      }
      
      // Get updated config with new language (respects database config priority)
      const config = configManager.getConfigForNumber(this.state.phoneNumber, detectedLanguageCode);
      
      // Update OpenAI session with new language and voice (use config.voice to respect database settings)
      this.state.openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          voice: config.voice.id,
          instructions: config.instructions
        }
      }));
      
      console.log(`🌐 [${this.state.callSid}] Language switched to ${languageConfig.name} (${languageConfig.code}) with voice ${config.voice.id}`);
      return true;
    } catch (error) {
      console.error(`❌ [${this.state.callSid}] Error switching language:`, error);
      return false;
    }
  }

  /**
   * Detect and switch language from user transcription
   */
  async detectAndSwitchLanguage(transcript) {
    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      return;
    }
    
    // Only detect language after initial greeting is completed
    if (!this.state.hasInitialGreetingCompleted) {
      return;
    }
    
    // Get current language
    const { conversations } = await import('../../../shared/state.js');
    const currentLanguage = conversations[this.state.callSid]?.language || 'en';
    
    // Skip if already in the detected language
    if (currentLanguage !== 'en') {
      return; // Already switched, don't re-detect
    }
    
    // Detect language from transcript
    const detectedLanguage = multilingualService.detectLanguage(transcript);
    
    // If detected language is different from current (and not English), switch
    if (detectedLanguage !== currentLanguage && detectedLanguage !== 'en') {
      console.log(`🌐 [${this.state.callSid}] Language detected: ${detectedLanguage} from transcript: "${transcript.substring(0, 50)}..."`);
      this.switchLanguage(detectedLanguage);
    } else if (detectedLanguage === 'en' && currentLanguage === 'en') {
      // Low confidence - ask for confirmation if we're not sure
      // This will be handled by the AI's instructions to ask "Would you like me to continue in English, or [language]?"
      console.log(`🌐 [${this.state.callSid}] Language detection inconclusive, keeping English`);
    }
  }
}

