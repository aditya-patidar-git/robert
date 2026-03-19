/**
 * Infer ISO 639-1 language code for the post-greeting language-selection step.
 * Used as server-side backup when the model fails to invoke set_call_language.
 */
import multilingualService from './multilingualService.js';

/**
 * Parse {"language_code":"hi"} style output from model text (misbehaving Realtime turns).
 * @param {string} text
 * @returns {string|null} two-letter code or null
 */
export function parseLanguageCodeFromModelOutput(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  const m =
    t.match(/"language_code"\s*:\s*"([a-z]{2,3})"/i) ||
    t.match(/language_code\s*[:=]\s*['"]?([a-z]{2,3})['"]?/i);
  if (!m) return null;
  const code = (m[1] || '').toLowerCase().slice(0, 2);
  return /^[a-z]{2}$/.test(code) ? code : null;
}

/**
 * Map caller utterance to a supported language code (async: loads DB mappings).
 * @param {string} utterance
 * @returns {Promise<string>}
 */
export async function inferLanguageCodeFromCallerUtterance(utterance) {
  await multilingualService.loadLanguageMappings();
  const s = typeof utterance === 'string' ? utterance.trim() : '';
  if (!s) return 'en';

  const fromJson = parseLanguageCodeFromModelOutput(s);
  if (fromJson && multilingualService.isValidLanguage(fromJson)) {
    return fromJson;
  }

  const lower = s.toLowerCase();

  // Unicode script → primary language (caller may speak only in script, no Latin "hindi")
  if (/[\u0900-\u097F]/.test(s)) {
    if (/\bमराठी\b|marathi/i.test(s) && multilingualService.isValidLanguage('mr')) return 'mr';
    if (multilingualService.isValidLanguage('hi')) return 'hi';
  }
  if (/[\u0980-\u09FF]/.test(s) && multilingualService.isValidLanguage('bn')) return 'bn';
  if (/[\u0A80-\u0AFF]/.test(s) && multilingualService.isValidLanguage('gu')) return 'gu';
  if (/[\u0A00-\u0A7F]/.test(s) && multilingualService.isValidLanguage('pa')) return 'pa';
  if (/[\u0B80-\u0BFF]/.test(s) && multilingualService.isValidLanguage('ta')) return 'ta';
  if (/[\u0600-\u06FF]/.test(s) && multilingualService.isValidLanguage('ur')) return 'ur';

  const phraseToCode = {
    english: 'en',
    eng: 'en',
    french: 'fr',
    français: 'fr',
    francais: 'fr',
    german: 'de',
    deutsch: 'de',
    spanish: 'es',
    español: 'es',
    espanol: 'es',
    italian: 'it',
    italiano: 'it',
    portuguese: 'pt',
    português: 'pt',
    portugues: 'pt',
    dutch: 'nl',
    nederlands: 'nl',
    polish: 'pl',
    polski: 'pl',
    sinhala: 'si',
    sinhalese: 'si',
    tamil: 'ta',
    hindi: 'hi',
    हिंदी: 'hi',
    bengali: 'bn',
    urdu: 'ur',
    punjabi: 'pa',
    gujarati: 'gu',
    marathi: 'mr'
  };

  for (const [phrase, code] of Object.entries(phraseToCode)) {
    if (!lower.includes(phrase)) continue;
    if (multilingualService.isValidLanguage(code)) return code;
  }

  const detected = multilingualService.detectLanguage(s);
  if (detected && detected !== 'en' && multilingualService.isValidLanguage(detected)) {
    return detected;
  }

  return 'en';
}

/** Phrases that indicate the caller asked for a given ISO 639-1 base code (Latin / named languages). */
const PHRASES_BY_CODE = {
  en: ['english', 'eng'],
  fr: ['french', 'français', 'francais'],
  de: ['german', 'deutsch'],
  es: ['spanish', 'español', 'espanol'],
  it: ['italian', 'italiano'],
  pt: ['portuguese', 'português', 'portugues'],
  nl: ['dutch', 'nederlands'],
  pl: ['polish', 'polski'],
  si: ['sinhala', 'sinhalese'],
  ta: ['tamil'],
  hi: ['hindi', 'हिंदी'],
  bn: ['bengali'],
  ur: ['urdu'],
  pa: ['punjabi'],
  gu: ['gujarati'],
  mr: ['marathi']
};

/**
 * True if the caller transcript plausibly requests `code` (for corroborating model JSON).
 * Used so hallucinated assistant text like {"language_code":"es"} cannot override inference
 * when the transcribed utterance does not mention that language.
 * @param {string} utterance
 * @param {string} code - ISO base or locale key (e.g. es, hi-IN)
 * @returns {boolean}
 */
export function transcriptSupportsLanguageCode(utterance, code) {
  if (!utterance || typeof utterance !== 'string' || !code) return false;
  const base = String(code).toLowerCase().split(/[-_]/)[0];
  if (!/^[a-z]{2}$/.test(base) || !multilingualService.isValidLanguage(base)) return false;

  const s = utterance.trim();
  const lower = s.toLowerCase();

  if (/[\u0900-\u097F]/.test(s)) {
    if (/\bमराठी\b|marathi/i.test(s)) {
      return base === 'mr' && multilingualService.isValidLanguage('mr');
    }
    return base === 'hi' && multilingualService.isValidLanguage('hi');
  }
  if (/[\u0980-\u09FF]/.test(s) && base === 'bn') return multilingualService.isValidLanguage('bn');
  if (/[\u0A80-\u0AFF]/.test(s) && base === 'gu') return multilingualService.isValidLanguage('gu');
  if (/[\u0A00-\u0A7F]/.test(s) && base === 'pa') return multilingualService.isValidLanguage('pa');
  if (/[\u0B80-\u0BFF]/.test(s) && base === 'ta') return multilingualService.isValidLanguage('ta');
  if (/[\u0600-\u06FF]/.test(s) && base === 'ur') return multilingualService.isValidLanguage('ur');

  const phrases = PHRASES_BY_CODE[base];
  if (phrases) {
    for (const p of phrases) {
      if (lower.includes(p)) return true;
    }
  }
  return false;
}

/**
 * Collect plain text from Realtime response output items (assistant message content).
 * @param {Array} outputItems
 * @returns {string}
 */
export function collectAssistantTextFromResponseOutput(outputItems) {
  if (!Array.isArray(outputItems)) return '';
  let out = '';
  for (const item of outputItems) {
    if (item.type !== 'message' || !item.content) continue;
    for (const c of item.content) {
      if (c.type === 'text' && c.text) out += c.text;
    }
  }
  return out.trim();
}
