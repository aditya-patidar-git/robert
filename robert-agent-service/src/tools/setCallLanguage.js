import { LanguageDetector } from '../handlers/mediaStream/utils/languageDetector.js';
import multilingualService from '../services/multilingualService.js';
import { getFlowCopy } from '../services/flowCopyByLanguage.js';
import configManager from '../agent/configManager.js';
import PrivacyConfig from '../database/models/PrivacyConfig.js';
import { getEffectiveRecordingConsentSettings } from '../services/callRecordPersistenceService.js';

/**
 * Model-driven language selection after the caller answers the language question.
 * Updates session voice/instructions via LanguageDetector.switchLanguage.
 */
class SetCallLanguageTool {
  async execute(parameters, callContext = {}) {
    const { language_code } = parameters || {};
    const { callSid, stateManager } = callContext;

    if (!callSid || !stateManager) {
      return { success: false, error: 'Missing call context for set_call_language' };
    }

    await multilingualService.loadLanguageMappings();
    const raw = (language_code ?? '').toString().trim().toLowerCase();
    const base = raw.split(/[-_]/)[0] || 'en';
    const canonical =
      multilingualService.resolveSupportedLanguageKey(raw) ||
      multilingualService.resolveSupportedLanguageKey(base);

    const midCallLanguageSwitch =
      stateManager.languagePreferenceState?.selected === true &&
      stateManager.waitingForLanguage !== true;

    if (!canonical) {
      const codes = Object.keys(multilingualService.supportedLanguages || {}).filter(Boolean);
      return {
        success: false,
        error: 'UNSUPPORTED_LANGUAGE',
        message: `language_code "${language_code}" is not supported. Call set_call_language again with a supported code (e.g. en, hi, hi-IN, fr, de, es) or en if unsure.`,
        supportedCodes: codes
      };
    }

    const detector = new LanguageDetector(stateManager);
    const ok = await detector.switchLanguage(canonical);
    if (!ok) {
      return {
        success: false,
        error: 'SWITCH_FAILED',
        message: 'Could not apply language (session not ready). Call set_call_language again with the same language_code.'
      };
    }

    if (midCallLanguageSwitch) {
      stateManager.pendingOneShotOutputLanguageCanonical = canonical;
    }

    let privacySettings = null;
    try {
      privacySettings = await PrivacyConfig.findOne({ isActive: true }).lean();
    } catch {
      privacySettings = null;
    }
    const telephonyConfig = configManager.getTelephonyConfig();
    const { consentRequired, consentMessage: consentNotice } = getEffectiveRecordingConsentSettings(
      telephonyConfig,
      privacySettings
    );
    const flow = getFlowCopy(canonical);

    console.log(`🌐 [${callSid}] set_call_language applied: ${canonical}`);

    return {
      success: true,
      language_code: canonical,
      midCallLanguageSwitch,
      consentRequired: midCallLanguageSwitch ? false : !!consentRequired,
      consentNotice: consentNotice || 'For training and quality, this call may be recorded.',
      consentQuestionLocalized: flow.consentQuestion,
      mainFollowUpLocalized: flow.mainFollowUpQuestion
    };
  }
}

export default new SetCallLanguageTool();
