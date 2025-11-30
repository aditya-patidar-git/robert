/**
 * Multilingual Service
 * Handles language detection, switching, and formatting for multi-language support
 */

class MultilingualService {
  constructor() {
    this.supportedLanguages = {
      'en': { name: 'English (British)', code: 'en-GB', voice: 'ash' }, // British English with Ash voice
      'fr': { name: 'French', code: 'fr-FR', voice: 'nova' },
      'de': { name: 'German', code: 'de-DE', voice: 'nova' },
      'es': { name: 'Spanish', code: 'es-ES', voice: 'nova' },
      'it': { name: 'Italian', code: 'it-IT', voice: 'nova' },
      'pt': { name: 'Portuguese', code: 'pt-PT', voice: 'nova' },
      'nl': { name: 'Dutch', code: 'nl-NL', voice: 'nova' },
      'pl': { name: 'Polish', code: 'pl-PL', voice: 'nova' }
    };
    
    this.defaultLanguage = 'en';
  }

  /**
   * Detect language from text using pattern matching
   * Enhanced with more patterns for better detection
   * @param {string} text - Text to analyze
   * @returns {string} - Detected language code (e.g., 'fr', 'de', 'en')
   */
  detectLanguage(text) {
    if (!text || typeof text !== 'string') {
      return this.defaultLanguage;
    }

    const normalizedText = text.toLowerCase().trim();
    
    // Enhanced language patterns with more keywords
    const languagePatterns = {
      'fr': /\b(oui|non|bonjour|bonsoir|merci|au revoir|comment|où|quand|pourquoi|parlez|français|francais|s'il vous plaît|s'il vous plait|excusez|désolé|desole|je voudrais|je veux|combien|bien sûr|bien sur)\b/i,
      'de': /\b(ja|nein|hallo|guten tag|guten morgen|danke|auf wiedersehen|wie|wo|wann|warum|sprechen|deutsch|bitte|entschuldigung|ich möchte|ich will|wie viel|natürlich|naturlich)\b/i,
      'es': /\b(sí|si|no|hola|buenos días|buenos dias|gracias|adiós|adios|cómo|cómo|dónde|donde|cuándo|cuando|por qué|por que|hablar|español|espanol|por favor|disculpe|quiero|cuánto|cuanto|por supuesto)\b/i,
      'it': /\b(sì|si|no|ciao|buongiorno|grazie|arrivederci|come|dove|quando|perché|perche|parlare|italiano|per favore|scusi|voglio|quanto|naturalmente)\b/i,
      'pt': /\b(sim|não|nao|olá|ola|bom dia|obrigado|obrigada|adeus|como|onde|quando|por que|falar|português|portugues|por favor|desculpe|quero|quanto|claro)\b/i,
      'nl': /\b(ja|nee|hallo|goedemorgen|dank je|dank u|tot ziens|hoe|waar|wanneer|waarom|spreken|nederlands|alstublieft|sorry|ik wil|hoeveel|natuurlijk)\b/i,
      'pl': /\b(tak|nie|cześć|czesć|dzień dobry|dzien dobry|dziękuję|dziekuje|do widzenia|jak|gdzie|kiedy|dlaczego|mówić|mowic|polski|proszę|prosze|przepraszam|chcę|chce|ile|oczywiście|oczywiscie)\b/i
    };

    // Count matches for each language
    const scores = {};
    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      const matches = normalizedText.match(pattern);
      scores[lang] = matches ? matches.length : 0;
    }

    // Find language with highest score
    let maxScore = 0;
    let detectedLang = this.defaultLanguage;
    for (const [lang, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    }

    // If no strong match, check for explicit language mentions
    if (maxScore === 0) {
      const explicitPatterns = {
        'fr': /\b(français|francais|french)\b/i,
        'de': /\b(deutsch|german)\b/i,
        'es': /\b(español|espanol|spanish)\b/i,
        'it': /\b(italiano|italian)\b/i,
        'pt': /\b(português|portugues|portuguese)\b/i,
        'nl': /\b(nederlands|dutch)\b/i,
        'pl': /\b(polski|polish)\b/i
      };

      for (const [lang, pattern] of Object.entries(explicitPatterns)) {
        if (pattern.test(normalizedText)) {
          return lang;
        }
      }
    }

    return detectedLang;
  }

  /**
   * Get language configuration
   * @param {string} languageCode - Language code (e.g., 'fr', 'en')
   * @returns {Object} - Language config with name, code, voice
   */
  getLanguageConfig(languageCode) {
    return this.supportedLanguages[languageCode] || this.supportedLanguages[this.defaultLanguage];
  }

  /**
   * Get greeting message in specified language
   * @param {string} languageCode - Language code
   * @returns {string} - Greeting message
   */
  getGreetingMessage(languageCode) {
    const greetings = {
      'en': "Hello, you're through to Universal Motorcycle Training. This is Robert. What language would you like to use today?",
      'fr': "Bonjour, vous êtes en contact avec Universal Motorcycle Training. Je suis Robert. Dans quelle langue souhaitez-vous communiquer aujourd'hui?",
      'de': "Hallo, Sie sind bei Universal Motorcycle Training. Ich bin Robert. In welcher Sprache möchten Sie heute sprechen?",
      'es': "Hola, está en contacto con Universal Motorcycle Training. Soy Robert. ¿En qué idioma le gustaría comunicarse hoy?",
      'it': "Ciao, sei in contatto con Universal Motorcycle Training. Sono Robert. In quale lingua vorresti comunicare oggi?",
      'pt': "Olá, está em contato com a Universal Motorcycle Training. Sou o Robert. Em que idioma gostaria de se comunicar hoje?",
      'nl': "Hallo, u bent in contact met Universal Motorcycle Training. Ik ben Robert. In welke taal zou u vandaag willen communiceren?",
      'pl': "Cześć, jesteś w kontakcie z Universal Motorcycle Training. Jestem Robert. W jakim języku chciałbyś się dzisiaj komunikować?"
    };

    return greetings[languageCode] || greetings[this.defaultLanguage];
  }

  /**
   * Get system instructions in specified language
   * @param {string} languageCode - Language code
   * @returns {string} - System instructions
   */
  getSystemInstructions(languageCode) {
    const instructions = {
      'en': `You are "Robert", Universal Motorcycle Training's AI phone agent. Speak in clear, calm, polite British English with a professional but warm tone. Use British spelling (colour, centre, organise, etc.) and British terminology. Use UK date format (DD/MM/YYYY) and 24-hour time format. When mentioning prices, use GBP with the £ symbol.`,
      'fr': `Vous êtes "Robert", l'agent téléphonique IA de Universal Motorcycle Training. Parlez en français clair, calme et poli avec un ton professionnel mais chaleureux.`,
      'de': `Sie sind "Robert", der KI-Telefonagent von Universal Motorcycle Training. Sprechen Sie in klarem, ruhigem, höflichem Deutsch mit einem professionellen aber warmen Ton.`,
      'es': `Eres "Robert", el agente telefónico de IA de Universal Motorcycle Training. Habla en español claro, tranquilo y cortés con un tono profesional pero cálido.`,
      'it': `Sei "Robert", l'agente telefonico IA di Universal Motorcycle Training. Parla in italiano chiaro, calmo e cortese con un tono professionale ma caloroso.`,
      'pt': `Você é "Robert", o agente telefônico de IA da Universal Motorcycle Training. Fale em português claro, calmo e cortês com um tom profissional mas caloroso.`,
      'nl': `Je bent "Robert", de AI-telefoonagent van Universal Motorcycle Training. Spreek in duidelijk, kalm, beleefd Nederlands met een professionele maar warme toon.`,
      'pl': `Jesteś "Robert", agentem telefonicznym AI Universal Motorcycle Training. Mów jasno, spokojnie i grzecznie po polsku z profesjonalnym ale ciepłym tonem.`
    };

    return instructions[languageCode] || instructions[this.defaultLanguage];
  }

  /**
   * Format number according to language conventions
   * @param {number} number - Number to format
   * @param {string} languageCode - Language code
   * @returns {string} - Formatted number
   */
  formatNumber(number, languageCode) {
    const formatters = {
      'en': (num) => num.toString(),
      'fr': (num) => num.toString().replace('.', ','),
      'de': (num) => num.toString().replace('.', ','),
      'es': (num) => num.toString(),
      'it': (num) => num.toString(),
      'pt': (num) => num.toString(),
      'nl': (num) => num.toString(),
      'pl': (num) => num.toString()
    };

    const formatter = formatters[languageCode] || formatters[this.defaultLanguage];
    return formatter(number);
  }

  /**
   * Format date according to language conventions
   * @param {Date} date - Date to format
   * @param {string} languageCode - Language code
   * @returns {string} - Formatted date
   */
  formatDate(date, languageCode) {
    const localeMap = {
      'en': 'en-GB',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'es': 'es-ES',
      'it': 'it-IT',
      'pt': 'pt-PT',
      'nl': 'nl-NL',
      'pl': 'pl-PL'
    };

    const locale = localeMap[languageCode] || localeMap[this.defaultLanguage];
    return date.toLocaleDateString(locale);
  }

  /**
   * Get supported languages list
   * @returns {Array} - Array of language objects
   */
  getSupportedLanguages() {
    return Object.keys(this.supportedLanguages).map(code => ({
      code,
      ...this.supportedLanguages[code]
    }));
  }

  /**
   * Check if language code is valid
   * @param {string} languageCode - Language code to check
   * @returns {boolean} - True if valid
   */
  isValidLanguage(languageCode) {
    return languageCode in this.supportedLanguages;
  }

  /**
   * Get OpenAI voice ID for language
   * @param {string} languageCode - Language code
   * @returns {string} - OpenAI voice ID
   */
  getVoiceForLanguage(languageCode) {
    const config = this.getLanguageConfig(languageCode);
    return config.voice || 'ash';
  }

  /**
   * Get locale code for language
   * @param {string} languageCode - Language code
   * @returns {string} - Locale code (e.g., 'en-GB', 'fr-FR')
   */
  getLocaleForLanguage(languageCode) {
    const config = this.getLanguageConfig(languageCode);
    return config.code || 'en-GB';
  }
}

export default new MultilingualService();

