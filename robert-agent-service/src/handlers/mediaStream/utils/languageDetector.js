import multilingualService, { resolveTranscriptionLanguage } from '../../../services/multilingualService.js';
import configManager from '../../../agent/configManager.js';
import { inferLanguageCodeFromCallerUtterance } from '../../../services/languageSelectionInference.js';

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
      
      await multilingualService.loadLanguageMappings();
      const canonical =
        multilingualService.resolveSupportedLanguageKey(detectedLanguageCode);
      if (!canonical) {
        console.warn(`⚠️ [${this.state.callSid}] Invalid language code: ${detectedLanguageCode}`);
        return false;
      }

      const languageConfig = multilingualService.getLanguageConfig(canonical);

      // Update conversation state
      const { conversations } = await import('../../../shared/state.js');
      if (conversations[this.state.callSid]) {
        conversations[this.state.callSid].language = canonical;
        conversations[this.state.callSid].locale = languageConfig.code;
      }

      // CRITICAL: Mark language as selected and clear waitingForLanguage flag
      this.state.languagePreferenceState.selected = true;
      this.state.languagePreferenceState.language = canonical;
      this.state.languagePreferenceState.selectedAt = new Date();
      this.state.waitingForLanguage = false;
      
      if (conversations[this.state.callSid]) {
        if (!conversations[this.state.callSid].languagePreferenceState) {
          conversations[this.state.callSid].languagePreferenceState = {};
        }
        conversations[this.state.callSid].languagePreferenceState.selected = true;
        conversations[this.state.callSid].languagePreferenceState.language = canonical;
        conversations[this.state.callSid].languagePreferenceState.selectedAt = new Date();
        conversations[this.state.callSid].waitingForLanguage = false;
      }
      
      // Get updated config with new language (respects database config priority)
      const config = configManager.getConfigForNumber(this.state.phoneNumber, canonical);
      const transcriptionLanguage = resolveTranscriptionLanguage(canonical);

      // Update OpenAI session with new language, voice, and transcription language
      const sent = this.state.sendToOpenAI(
        {
          type: 'session.update',
          session: {
            modalities: ['audio', 'text'], // CRITICAL: Preserve audio modality
            voice: config.voice.id,
            instructions: config.instructions,
            input_audio_transcription: { model: 'gpt-4o-transcribe', language: transcriptionLanguage }
          }
        },
        { priority: 'high' }
      );

      if (sent && typeof this.state.waitForNextSessionUpdated === 'function') {
        await this.state.waitForNextSessionUpdated(5000);
      }

      if (typeof this.state.lastMidCallLanguageSwitchAt === 'number') {
        this.state.lastMidCallLanguageSwitchAt = Date.now();
      }
      console.log(
        `🌐 [${this.state.callSid}] Language switched to ${languageConfig.name} (${languageConfig.code}) key=${canonical} voice ${config.voice.id}, transcription language: ${transcriptionLanguage}`
      );
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

      // Ensure allowed languages are loaded from DB (languageMappings collection)
      await multilingualService.loadLanguageMappings();

      // Phrase -> ISO 639-1 code: used to recognise requested language; allowed = from DB (isValidLanguage)
      const phraseToCode = {
        'english': 'en', 'eng': 'en',
        'french': 'fr', 'français': 'fr', 'francais': 'fr',
        'german': 'de', 'deutsch': 'de',
        'spanish': 'es', 'español': 'es', 'espanol': 'es',
        'italian': 'it', 'italiano': 'it',
        'portuguese': 'pt', 'português': 'pt', 'portugues': 'pt',
        'dutch': 'nl', 'nederlands': 'nl',
        'polish': 'pl', 'polski': 'pl',
        'sinhala': 'si', 'sinhalese': 'si',
        'tamil': 'ta', 'hindi': 'hi', 'bengali': 'bn', 'urdu': 'ur',
        'punjabi': 'pa', 'gujarati': 'gu', 'marathi': 'mr'
      };

      for (const [phrase, code] of Object.entries(phraseToCode)) {
        if (!normalizedTranscript.includes(phrase)) continue;
        if (multilingualService.isValidLanguage(code)) {
          console.log(`🌐 [${this.state.callSid}] Explicit language preference detected: ${phrase} (${code}) from transcript: "${transcript.substring(0, 50)}..."`);
          await this.switchLanguage(code);
          return;
        }
        // Requested language not in languageMappings: say not supported and continue in English
        const displayName = phrase.charAt(0).toUpperCase() + phrase.slice(1);
        console.log(`🌐 [${this.state.callSid}] Language not supported (not in languageMappings): ${displayName} - will say not available and continue in English`);
        const { conversations } = await import('../../../shared/state.js');
        this.state.languagePreferenceState.selected = true;
        this.state.languagePreferenceState.language = 'en';
        this.state.languagePreferenceState.selectedAt = new Date();
        this.state.waitingForLanguage = false;
        this.state.unsupportedLanguageRequested = displayName;
        if (conversations[this.state.callSid]) {
          conversations[this.state.callSid].language = 'en';
          if (!conversations[this.state.callSid].languagePreferenceState) {
            conversations[this.state.callSid].languagePreferenceState = {};
          }
          conversations[this.state.callSid].languagePreferenceState.selected = true;
          conversations[this.state.callSid].languagePreferenceState.language = 'en';
          conversations[this.state.callSid].languagePreferenceState.selectedAt = new Date();
          conversations[this.state.callSid].waitingForLanguage = false;
        }
        await this.switchLanguage('en');
        return;
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
    
    if (!this.state.hasInitialGreetingCompleted || !languageSelected) {
      return;
    }

    // LANGUAGE LOCK: After initial selection, block automatic mid-call switches
    // unless the caller explicitly requests a change (e.g. "switch to French").
    // This prevents STT errors from triggering unwanted language changes.
    const EXPLICIT_SWITCH_PATTERN =
      /\b(switch\s+to|change\s+(?:to|the\s+)?language|speak\s+(?:in\s+)?|talk\s+in|parle|habla|sprechen|parlo|can\s+(?:we|you)\s+(?:speak|talk)\s+(?:in\s+)?)\b/i;
    const t = transcript.trim();
    const callerExplicitlyAskedSwitch = EXPLICIT_SWITCH_PATTERN.test(t);

    if (!callerExplicitlyAskedSwitch) {
      return;
    }

    const MID_CALL_SWITCH_COOLDOWN_MS = 12000;
    const lastSwitch = this.state.lastMidCallLanguageSwitchAt || 0;
    if (Date.now() - lastSwitch < MID_CALL_SWITCH_COOLDOWN_MS) {
      return;
    }

    const MIN_MID_CALL_TRANSCRIPT_LENGTH = 8;
    if (t.length < MIN_MID_CALL_TRANSCRIPT_LENGTH) {
      return;
    }

    await multilingualService.loadLanguageMappings();
    const currentCanon =
      multilingualService.resolveSupportedLanguageKey(currentLanguage) || currentLanguage;

    const inferred = await inferLanguageCodeFromCallerUtterance(transcript);
    const inferredCanon =
      multilingualService.resolveSupportedLanguageKey(inferred) || inferred;

    if (!inferredCanon || inferredCanon === currentCanon) {
      return;
    }

    console.log(
      `🌐 [${this.state.callSid}] Mid-call EXPLICIT language switch: ${currentCanon} -> ${inferredCanon} ("${t.substring(0, 70)}${t.length > 70 ? '...' : ''}")`
    );
    const ok = await this.switchLanguage(inferred);
    if (ok) {
      this.state.pendingOneShotOutputLanguageCanonical =
        multilingualService.resolveSupportedLanguageKey(inferred) || inferred;
    }
  }
}

