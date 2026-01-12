class BritishVoiceService {
  constructor() {
    this.defaultVoice = 'ash'; // Preferred British male voice
    this.fallbackVoices = ['cedar', 'marin']; // Fallback voices with British prosody
    this.britishInstructions = this.getBritishInstructions();
    this.terminologyMap = this.getTerminologyMap();
  }

  /**
   * Get British English system instructions
   * @returns {string} British English instructions
   */
  getBritishInstructions() {
    return `You are "Robert", Universal Motorcycle Training's AI phone agent. 
Speak in clear, calm, polite British English with a professional but warm tone.
Use British spelling (colour, centre, organise, etc.) and British terminology.
Be concise and helpful. Adjust your politeness and pacing to match the caller's style.
Never guess or invent facts. If unsure, ask clarifying questions or offer human transfer.
Use UK date format (DD/MM/YYYY) and 24-hour time format.
When mentioning prices, use GBP with the £ symbol.
Use British address formatting (postcodes, etc.).`;
  }

  /**
   * Get British terminology mapping (British vs American)
   * @returns {object} Terminology map
   */
  getTerminologyMap() {
    return {
      'apartment': 'flat',
      'apartments': 'flats',
      'garbage': 'rubbish',
      'trash': 'rubbish',
      'sidewalk': 'pavement',
      'elevator': 'lift',
      'parking lot': 'car park',
      'gas': 'petrol',
      'truck': 'lorry',
      'soccer': 'football',
      'sneakers': 'trainers',
      'pants': 'trousers',
      'underpants': 'pants',
      'diaper': 'nappy',
      'pacifier': 'dummy',
      'stroller': 'pushchair',
      'vacation': 'holiday',
      'fall': 'autumn',
      'candy': 'sweets',
      'cookie': 'biscuit',
      'chips': 'crisps',
      'fries': 'chips',
      'math': 'maths',
      'color': 'colour',
      'center': 'centre',
      'organize': 'organise',
      'recognize': 'recognise',
      'realize': 'realise'
    };
  }

  /**
   * Get voice configuration
   * @param {string} preferredVoice - Preferred voice (optional)
   * @returns {object} Voice configuration
   */
  getVoiceConfig(preferredVoice = null) {
    const voice = preferredVoice || this.defaultVoice;
    return {
      id: voice,
      name: this.getVoiceName(voice),
      prosody: this.getProsodyHints(voice)
    };
  }

  /**
   * Get voice name
   * @param {string} voiceId - Voice ID
   * @returns {string} Voice name
   */
  getVoiceName(voiceId) {
    const voiceNames = {
      'ash': 'Ash',
    'cedar': 'Cedar',
    'marin': 'Marin',
    'alloy': 'Alloy',
    'sage': 'Sage',
    'shimmer': 'Shimmer',
    'verse': 'Verse',
    'echo': 'Echo',
    'coral': 'Coral',
    'ballad': 'Ballad'
    };
    return voiceNames[voiceId] || voiceId;
  }

  /**
   * Get prosody hints for non-Ash voices
   * @param {string} voiceId - Voice ID
   * @returns {string} Prosody hints
   */
  getProsodyHints(voiceId) {
    if (voiceId === 'ash') {
      return null; // Ash is already British
    }

    // Prosody hints for British English on non-Ash voices
    return 'Use British English pronunciation and intonation. Speak with a calm, professional British accent.';
  }

  /**
   * Convert American terminology to British
   * @param {string} text - Text to convert
   * @returns {string} Converted text
   */
  convertToBritish(text) {
    let converted = text;
    for (const [american, british] of Object.entries(this.terminologyMap)) {
      const regex = new RegExp(`\\b${american}\\b`, 'gi');
      converted = converted.replace(regex, british);
    }
    return converted;
  }

  /**
   * Get British formatting utilities
   * @returns {object} Formatting utilities
   */
  getFormattingUtils() {
    return {
      formatDate: (date) => {
        if (typeof date === 'string') {
          date = new Date(date);
        }
        return date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      },
      formatTime: (date) => {
        if (typeof date === 'string') {
          date = new Date(date);
        }
        return date.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      },
      formatCurrency: (amount) => {
        return `£${amount.toFixed(2)}`;
      },
      formatPostcode: (postcode) => {
        // UK postcode format: SW1A 1AA
        return postcode.toUpperCase().replace(/\s+/g, ' ').trim();
      }
    };
  }
}

export default new BritishVoiceService();

