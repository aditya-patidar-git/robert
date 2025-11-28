import { connectDB } from '../database/connection.js';
import AIConfig from '../database/models/AIConfig.js';
import AudioConfig from '../database/models/AudioConfig.js';
import TelephonyConfig from '../database/models/TelephonyConfig.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

class ConfigManager {
  constructor() {
    this.cache = {
      ai: null,
      audio: null,
      telephony: null
    };
    this.lastFetch = {
      ai: 0,
      audio: 0,
      telephony: 0
    };
    this.cacheTTL = 30000; // 30 seconds
    this.pollInterval = null;
  }

  async initialize() {
    await connectDB();
    await this.refreshAll();
    // Poll for config updates every 30 seconds
    this.pollInterval = setInterval(() => this.refreshAll(), this.cacheTTL);
    console.log('✅ ConfigManager initialized and polling every 30 seconds');
  }

  async refreshAll() {
    try {
      await Promise.all([
        this.refreshAIConfig(),
        this.refreshAudioConfig(),
        this.refreshTelephonyConfig()
      ]);
    } catch (error) {
      console.error('Error refreshing configs:', error);
    }
  }

  async refreshAIConfig() {
    const now = Date.now();
    if (this.cache.ai && (now - this.lastFetch.ai) < this.cacheTTL) {
      return this.cache.ai;
    }

    const config = await AIConfig.findOne({ isActive: true }).lean();
    this.cache.ai = config;
    this.lastFetch.ai = now;
    if (config) {
      console.log('✅ AI Config refreshed:', {
        voice: config?.voice?.id,
        temperature: config?.parameters?.temperature,
        model: config?.model?.id
      });
    }
    return config;
  }

  async refreshAudioConfig() {
    const now = Date.now();
    if (this.cache.audio && (now - this.lastFetch.audio) < this.cacheTTL) {
      return this.cache.audio;
    }

    const config = await AudioConfig.findOne({ isActive: true }).lean();
    this.cache.audio = config;
    this.lastFetch.audio = now;
    return config;
  }

  async refreshTelephonyConfig() {
    const now = Date.now();
    if (this.cache.telephony && (now - this.lastFetch.telephony) < this.cacheTTL) {
      return this.cache.telephony;
    }

    const config = await TelephonyConfig.findOne({ isActive: true }).lean();
    this.cache.telephony = config;
    this.lastFetch.telephony = now;
    return config;
  }

  getAIConfig() {
    return this.cache.ai || {};
  }

  getAudioConfig() {
    return this.cache.audio || {};
  }

  getTelephonyConfig() {
    return this.cache.telephony || {};
  }

  // Get merged config for a specific phone number (supports per-number profiles)
  getConfigForNumber(phoneNumber) {
    const aiConfig = this.getAIConfig();
    const audioConfig = this.getAudioConfig();
    const telephonyConfig = this.getTelephonyConfig();

    // English-only instruction that must always be included
    const englishOnlyInstruction = ` IMPORTANT: You MUST ONLY speak in English. Never switch to any other language including Hindi, Urdu, French, or any other language. Always respond in English only, regardless of what language the user speaks.`;

    // Check for per-number profile
    if (audioConfig?.usePerNumberProfiles && audioConfig?.perNumberProfiles) {
      const profile = audioConfig.perNumberProfiles.find(
        p => p.phoneNumber === phoneNumber
      );
      
      if (profile) {
        const baseInstructions = aiConfig.globalPrompt || 'You are a friendly AI assistant.';
        return {
          voice: profile.defaultVoice || audioConfig.defaultVoice || aiConfig.voice || { id: 'alloy', name: 'Alloy' },
          temperature: profile.temperature ?? audioConfig.temperature ?? aiConfig.parameters?.temperature ?? 0.8,
          vadThreshold: profile.vadThreshold ?? audioConfig.vadThreshold ?? 500,
          startPadding: profile.startPadding ?? audioConfig.startPadding ?? 300,
          endPadding: profile.endPadding ?? audioConfig.endPadding ?? 500,
          confidenceThreshold: aiConfig.uncertaintyGate?.confidenceThreshold ?? 0.8,
          instructions: baseInstructions + englishOnlyInstruction,
          model: aiConfig.model || { id: 'gpt-4o-realtime-preview', name: 'GPT-4o Realtime' },
          uncertaintyGateEnabled: aiConfig.uncertaintyGate?.enabled ?? true
        };
      }
    }

    // Return global config
    const baseInstructions = aiConfig.globalPrompt || 'You are a friendly AI assistant.';
    return {
      voice: audioConfig.defaultVoice || aiConfig.voice || { id: 'alloy', name: 'Alloy' },
      temperature: audioConfig.temperature ?? aiConfig.parameters?.temperature ?? 0.8,
      vadThreshold: audioConfig.vadThreshold ?? 500,
      startPadding: audioConfig.startPadding ?? 300,
      endPadding: audioConfig.endPadding ?? 500,
      confidenceThreshold: aiConfig.uncertaintyGate?.confidenceThreshold ?? 0.8,
      instructions: baseInstructions + englishOnlyInstruction,
      model: aiConfig.model || { id: 'gpt-4o-realtime-preview', name: 'GPT-4o Realtime' },
      uncertaintyGateEnabled: aiConfig.uncertaintyGate?.enabled ?? true
    };
  }

  destroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}

export default new ConfigManager();

