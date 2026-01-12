import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class VoiceDiscoveryService {
  constructor() {
    this.voiceRegistry = new Map();
    this.lastDiscovery = null;
    this.discoveryInterval = 60 * 60 * 1000; // 1 hour
  }

  // Discover available voices from OpenAI API
  async discoverVoices() {
    try {
      console.log('🔍 Starting voice discovery from OpenAI...');
      
      if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY is not set. Cannot discover voices.');
        console.log('⚠️ Using fallback voices due to missing API key');
        return this.getDefaultVoices();
      }

      // For now, use known OpenAI voices as per documentation
      // In the future, this could call OpenAI API if voice discovery endpoint exists
      const voices = this.getKnownVoices();

      // Update voice registry
      this.voiceRegistry.clear();
      voices.forEach(voice => {
        this.voiceRegistry.set(voice.id, voice);
      });

      this.lastDiscovery = new Date();
      
      console.log(`✅ Discovered ${voices.length} voices`);
      return voices;
    } catch (error) {
      console.error('Error discovering voices:', error);
      // Fallback to default voices
      return this.getDefaultVoices();
    }
  }

  // Get known OpenAI voices as per documentation
  getKnownVoices() {
    return [
      {
        id: 'ash',
        name: 'Ash',
        description: 'A warm, clear male British English voice',
        language: 'en-GB',
        gender: 'male',
        provider: 'openai',
        isDefault: true,
        capabilities: {
          realtime: true,
          streaming: true,
          bargeIn: true
        },
        sampleText: 'Hello, this is Robert from Universal Motorcycle Training. How can I help you today?'
      },
      {
        id: 'cedar',
        name: 'Cedar',
        description: 'A calm and confident male voice',
        language: 'en-GB',
        gender: 'male',
        provider: 'openai',
        isDefault: false,
        capabilities: {
          realtime: true,
          streaming: true,
          bargeIn: true
        },
        sampleText: 'Hello, this is Robert from Universal Motorcycle Training. How can I help you today?'
      },
      {
        id: 'marin',
        name: 'Marin',
        description: 'A friendly and expressive female voice',
        language: 'en-GB',
        gender: 'female',
        provider: 'openai',
        isDefault: false,
        capabilities: {
          realtime: true,
          streaming: true,
          bargeIn: true
        },
        sampleText: 'Hello, this is Robert from Universal Motorcycle Training. How can I help you today?'
      },
      {
        id: 'alloy',
        name: 'Alloy',
        description: 'A versatile and balanced neutral voice',
        language: 'en-GB',
        gender: 'neutral',
        provider: 'openai',
        isDefault: false,
        capabilities: {
          realtime: true,
          streaming: true,
          bargeIn: true
        },
        sampleText: 'Hello, this is Robert from Universal Motorcycle Training. How can I help you today?'
      },
      {
        id: 'echo',
        name: 'Echo',
        description: 'A clear and articulate male voice',
        language: 'en-GB',
        gender: 'male',
        provider: 'openai',
        isDefault: false,
        capabilities: {
          realtime: true,
          streaming: true,
          bargeIn: true
        },
        sampleText: 'Hello, this is Robert from Universal Motorcycle Training. How can I help you today?'
      },
      {
        id: 'shimmer',
        name: 'Shimmer',
        description: 'A bright and cheerful female voice',
        language: 'en-GB',
        gender: 'female',
        provider: 'openai',
        isDefault: false,
        capabilities: {
          realtime: true,
          streaming: true,
          bargeIn: true
        },
        sampleText: 'Hello, this is Robert from Universal Motorcycle Training. How can I help you today?'
      },
      {
        id: 'ballad',
        name: 'Ballad',
        description: 'A melodic and expressive voice',
        language: 'en-GB',
        gender: 'neutral',
        provider: 'openai',
        isDefault: false,
        capabilities: {
          realtime: true,
          streaming: true,
          bargeIn: true
        },
        sampleText: 'Hello, this is Robert from Universal Motorcycle Training. How can I help you today?'
      },
      {
        id: 'coral',
        name: 'Coral',
        description: 'A vibrant and energetic female voice',
        language: 'en-GB',
        gender: 'female',
        provider: 'openai',
        isDefault: false,
        capabilities: {
          realtime: true,
          streaming: true,
          bargeIn: true
        },
        sampleText: 'Hello, this is Robert from Universal Motorcycle Training. How can I help you today?'
      },
      {
        id: 'sage',
        name: 'Sage',
        description: 'A wise and thoughtful voice',
        language: 'en-GB',
        gender: 'neutral',
        provider: 'openai',
        isDefault: false,
        capabilities: {
          realtime: true,
          streaming: true,
          bargeIn: true
        },
        sampleText: 'Hello, this is Robert from Universal Motorcycle Training. How can I help you today?'
      },
      {
        id: 'verse',
        name: 'Verse',
        description: 'A poetic and rhythmic voice',
        language: 'en-GB',
        gender: 'neutral',
        provider: 'openai',
        isDefault: false,
        capabilities: {
          realtime: true,
          streaming: true,
          bargeIn: true
        },
        sampleText: 'Hello, this is Robert from Universal Motorcycle Training. How can I help you today?'
      }
    ];
  }

  // Get default voices as fallback
  getDefaultVoices() {
    return [
      {
        id: 'ash',
        name: 'Ash',
        description: 'Default male British English voice',
        language: 'en-GB',
        gender: 'male',
        provider: 'openai',
        isDefault: true,
        capabilities: {
          realtime: true,
          streaming: true,
          bargeIn: true
        },
        sampleText: 'Hello, this is Robert from Universal Motorcycle Training.'
      }
    ];
  }

  // Get cached voices
  getVoices() {
    return Array.from(this.voiceRegistry.values());
  }

  // Get specific voice
  getVoice(voiceId) {
    return this.voiceRegistry.get(voiceId);
  }

  // Get default voice
  getDefaultVoice() {
    const voices = Array.from(this.voiceRegistry.values());
    return voices.find(voice => voice.isDefault) || voices[0];
  }

  // Get voices by language
  getVoicesByLanguage(language) {
    const voices = Array.from(this.voiceRegistry.values());
    return voices.filter(voice => voice.language === language);
  }

  // Check if discovery is needed
  isDiscoveryNeeded() {
    if (!this.lastDiscovery) return true;
    return (Date.now() - this.lastDiscovery.getTime()) > this.discoveryInterval;
  }

  // Get discovery status
  getDiscoveryStatus() {
    return {
      lastDiscovery: this.lastDiscovery,
      voiceCount: this.voiceRegistry.size,
      needsRefresh: this.isDiscoveryNeeded()
    };
  }
}

export default new VoiceDiscoveryService();
