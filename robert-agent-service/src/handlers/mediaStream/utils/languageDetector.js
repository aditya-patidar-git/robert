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
      
      // CRITICAL: Mark language as selected and clear waitingForLanguage flag
      this.state.languagePreferenceState.selected = true;
      this.state.languagePreferenceState.language = detectedLanguageCode;
      this.state.languagePreferenceState.selectedAt = new Date();
      this.state.waitingForLanguage = false;
      
      if (conversations[this.state.callSid]) {
        if (!conversations[this.state.callSid].languagePreferenceState) {
          conversations[this.state.callSid].languagePreferenceState = {};
        }
        conversations[this.state.callSid].languagePreferenceState.selected = true;
        conversations[this.state.callSid].languagePreferenceState.language = detectedLanguageCode;
        conversations[this.state.callSid].languagePreferenceState.selectedAt = new Date();
        conversations[this.state.callSid].waitingForLanguage = false;
      }
      
      // Get updated config with new language (respects database config priority)
      const config = configManager.getConfigForNumber(this.state.phoneNumber, detectedLanguageCode);
      
      // Update OpenAI session with new language and voice (use config.voice to respect database settings)
      // Use robust send method with connection manager support
      this.state.sendToOpenAI({
        type: 'session.update',
        session: {
          modalities: ['audio', 'text'], // CRITICAL: Preserve audio modality
          voice: config.voice.id,
          instructions: config.instructions
        }
      }, { priority: 'high' });
      
      console.log(`🌐 [${this.state.callSid}] Language switched to ${languageConfig.name} (${languageConfig.code}) with voice ${config.voice.id}`);
      console.log(`✅ [${this.state.callSid}] Language preference marked as selected - can proceed to business questions`);
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
    
    const { conversations } = await import('../../../shared/state.js');
    const currentLanguage = conversations[this.state.callSid]?.language || 'en';
    const waitingForLanguage = this.state.waitingForLanguage || conversations[this.state.callSid]?.waitingForLanguage || false;
    const languageSelected = this.state.languagePreferenceState?.selected || conversations[this.state.callSid]?.languagePreferenceState?.selected || false;
    
    // If waiting for language preference, handle it even before initial greeting is completed
    if (waitingForLanguage && !languageSelected) {
      const normalizedTranscript = transcript.toLowerCase().trim();
      
      // Check for explicit language names in transcript
      const languageNameMap = {
        'english': 'en',
        'eng': 'en',
        'french': 'fr',
        'français': 'fr',
        'francais': 'fr',
        'german': 'de',
        'deutsch': 'de',
        'spanish': 'es',
        'español': 'es',
        'espanol': 'es',
        'italian': 'it',
        'italiano': 'it',
        'portuguese': 'pt',
        'português': 'pt',
        'portugues': 'pt',
        'dutch': 'nl',
        'nederlands': 'nl',
        'polish': 'pl',
        'polski': 'pl'
      };
      
      // Check if transcript contains explicit language name
      for (const [name, code] of Object.entries(languageNameMap)) {
        if (normalizedTranscript.includes(name)) {
          console.log(`🌐 [${this.state.callSid}] Explicit language preference detected: ${name} (${code}) from transcript: "${transcript.substring(0, 50)}..."`);
          await this.switchLanguage(code);
          return;
        }
      }
      
      // If no explicit language name, detect from language patterns
      const detectedLanguage = multilingualService.detectLanguage(transcript);
      
      // If English is detected or no clear language, mark English as selected
      if (detectedLanguage === 'en' || !detectedLanguage) {
        console.log(`🌐 [${this.state.callSid}] English or no language preference detected - defaulting to English`);
        await this.switchLanguage('en');
      } else {
        console.log(`🌐 [${this.state.callSid}] Language preference detected: ${detectedLanguage} from transcript: "${transcript.substring(0, 50)}..."`);
        await this.switchLanguage(detectedLanguage);
      }
      return;
    }
    
    // Only detect language after initial greeting is completed (for mid-call language switching)
    if (!this.state.hasInitialGreetingCompleted) {
      return;
    }
    
    // Skip if already in the detected language
    if (currentLanguage !== 'en') {
      return; // Already switched, don't re-detect
    }
    
    // Detect language from transcript
    const detectedLanguage = multilingualService.detectLanguage(transcript);
    
    // If detected language is different from current (and not English), switch
    if (detectedLanguage !== currentLanguage && detectedLanguage !== 'en') {
      console.log(`🌐 [${this.state.callSid}] Language detected: ${detectedLanguage} from transcript: "${transcript.substring(0, 50)}..."`);
      await this.switchLanguage(detectedLanguage);
    } else if (detectedLanguage === 'en' && currentLanguage === 'en') {
      // Low confidence - ask for confirmation if we're not sure
      // This will be handled by the AI's instructions to ask "Would you like me to continue in English, or [language]?"
      console.log(`🌐 [${this.state.callSid}] Language detection inconclusive, keeping English`);
    }
  }
}

