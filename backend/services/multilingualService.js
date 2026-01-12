class MultilingualService {
  constructor() {
    this.supportedLanguages = {
      'en': { name: 'English', code: 'en-GB', voice: 'ash' },
      'fr': { name: 'French', code: 'fr-FR', voice: 'sage' },
      'de': { name: 'German', code: 'de-DE', voice: 'sage' },
      'es': { name: 'Spanish', code: 'es-ES', voice: 'sage' },
      'it': { name: 'Italian', code: 'it-IT', voice: 'sage' },
      'pt': { name: 'Portuguese', code: 'pt-PT', voice: 'sage' },
      'nl': { name: 'Dutch', code: 'nl-NL', voice: 'sage' },
      'pl': { name: 'Polish', code: 'pl-PL', voice: 'sage' }
    };
    
    this.defaultLanguage = 'en';
    this.currentLanguage = this.defaultLanguage;
  }

  detectLanguage(text) {
    // Simple language detection based on common words
    const languagePatterns = {
      'fr': /\b(oui|non|bonjour|merci|au revoir|comment|où|quand|pourquoi)\b/i,
      'de': /\b(ja|nein|hallo|danke|auf wiedersehen|wie|wo|wann|warum)\b/i,
      'es': /\b(sí|no|hola|gracias|adiós|cómo|dónde|cuándo|por qué)\b/i,
      'it': /\b(sì|no|ciao|grazie|arrivederci|come|dove|quando|perché)\b/i,
      'pt': /\b(sim|não|olá|obrigado|adeus|como|onde|quando|por que)\b/i,
      'nl': /\b(ja|nee|hallo|dank je|tot ziens|hoe|waar|wanneer|waarom)\b/i,
      'pl': /\b(tak|nie|cześć|dziękuję|do widzenia|jak|gdzie|kiedy|dlaczego)\b/i
    };

    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      if (pattern.test(text)) {
        return lang;
      }
    }

    return this.defaultLanguage;
  }

  getLanguageConfig(languageCode) {
    return this.supportedLanguages[languageCode] || this.supportedLanguages[this.defaultLanguage];
  }

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

  getLanguageSelectionMessage(languageCode) {
    const messages = {
      'en': "Please choose your preferred language: Press 1 for English, 2 for French, 3 for German, 4 for Spanish, 5 for Italian, 6 for Portuguese, 7 for Dutch, 8 for Polish.",
      'fr': "Veuillez choisir votre langue préférée: Appuyez sur 1 pour l'anglais, 2 pour le français, 3 pour l'allemand, 4 pour l'espagnol, 5 pour l'italien, 6 pour le portugais, 7 pour le néerlandais, 8 pour le polonais.",
      'de': "Bitte wählen Sie Ihre bevorzugte Sprache: Drücken Sie 1 für Englisch, 2 für Französisch, 3 für Deutsch, 4 für Spanisch, 5 für Italienisch, 6 für Portugiesisch, 7 für Niederländisch, 8 für Polnisch.",
      'es': "Por favor, elija su idioma preferido: Presione 1 para inglés, 2 para francés, 3 para alemán, 4 para español, 5 para italiano, 6 para portugués, 7 para holandés, 8 para polaco.",
      'it': "Scegli la tua lingua preferita: Premi 1 per inglese, 2 per francese, 3 per tedesco, 4 per spagnolo, 5 per italiano, 6 per portoghese, 7 per olandese, 8 per polacco.",
      'pt': "Escolha seu idioma preferido: Pressione 1 para inglês, 2 para francês, 3 para alemão, 4 para espanhol, 5 para italiano, 6 para português, 7 para holandês, 8 para polonês.",
      'nl': "Kies uw voorkeurstaal: Druk op 1 voor Engels, 2 voor Frans, 3 voor Duits, 4 voor Spaans, 5 voor Italiaans, 6 voor Portugees, 7 voor Nederlands, 8 voor Pools.",
      'pl': "Wybierz swój preferowany język: Naciśnij 1 dla angielskiego, 2 dla francuskiego, 3 dla niemieckiego, 4 dla hiszpańskiego, 5 dla włoskiego, 6 dla portugalskiego, 7 dla holenderskiego, 8 dla polskiego."
    };

    return messages[languageCode] || messages[this.defaultLanguage];
  }

  switchLanguage(languageCode) {
    if (this.supportedLanguages[languageCode]) {
      this.currentLanguage = languageCode;
      console.log(`🌐 Language switched to: ${this.supportedLanguages[languageCode].name}`);
      return true;
    }
    return false;
  }

  getCurrentLanguage() {
    return this.currentLanguage;
  }

  getCurrentLanguageConfig() {
    return this.getLanguageConfig(this.currentLanguage);
  }

  formatNumber(number, languageCode) {
    // Format numbers according to language conventions
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

  formatDate(date, languageCode) {
    // Format dates according to language conventions
    const dateFormatters = {
      'en': (date) => date.toLocaleDateString('en-GB'),
      'fr': (date) => date.toLocaleDateString('fr-FR'),
      'de': (date) => date.toLocaleDateString('de-DE'),
      'es': (date) => date.toLocaleDateString('es-ES'),
      'it': (date) => date.toLocaleDateString('it-IT'),
      'pt': (date) => date.toLocaleDateString('pt-PT'),
      'nl': (date) => date.toLocaleDateString('nl-NL'),
      'pl': (date) => date.toLocaleDateString('pl-PL')
    };

    const formatter = dateFormatters[languageCode] || dateFormatters[this.defaultLanguage];
    return formatter(date);
  }

  getSystemInstructions(languageCode) {
    const instructions = {
      'en': `You are "Robert", Universal Motorcycle Training's AI phone agent. Speak in clear, calm, polite British English with a professional but warm tone.`,
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

  getSupportedLanguages() {
    return Object.keys(this.supportedLanguages).map(code => ({
      code,
      ...this.supportedLanguages[code]
    }));
  }

  isValidLanguage(languageCode) {
    return languageCode in this.supportedLanguages;
  }
}

export default new MultilingualService();
