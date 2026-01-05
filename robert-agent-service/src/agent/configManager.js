import { connectDB } from '../database/connection.js';
import AIConfig from '../database/models/AIConfig.js';
import AudioConfig from '../database/models/AudioConfig.js';
import TelephonyConfig from '../database/models/TelephonyConfig.js';
import ToolConfig from '../database/models/ToolConfig.js';
import ConversationBehaviorConfig from '../database/models/ConversationBehaviorConfig.js';
import multilingualService from '../services/multilingualService.js';
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
      telephony: null,
      tools: null,
      conversationBehavior: null
    };
    this.lastFetch = {
      ai: 0,
      audio: 0,
      telephony: 0,
      tools: 0,
      conversationBehavior: 0
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
        this.refreshTelephonyConfig(),
        this.refreshToolConfig(),
        this.refreshConversationBehaviorConfig()
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

  async refreshToolConfig() {
    const now = Date.now();
    if (this.cache.tools && (now - this.lastFetch.tools) < this.cacheTTL) {
      return this.cache.tools;
    }

    try {
      const toolConfigs = await ToolConfig.find({}).lean();
      // Convert array to Map for faster lookup
      const toolsMap = new Map();
      toolConfigs.forEach(config => {
        toolsMap.set(config.toolName, config);
      });
      
      this.cache.tools = toolsMap;
      this.lastFetch.tools = now;
      
      if (toolConfigs.length > 0) {
        console.log(`✅ Tool Config refreshed: ${toolConfigs.length} tools configured`);
      }
      return toolsMap;
    } catch (error) {
      console.error('Error refreshing tool config:', error);
      return this.cache.tools || new Map();
    }
  }

  getToolConfig(toolName) {
    const toolsMap = this.cache.tools || new Map();
    return toolsMap.get(toolName) || {
      toolName,
      enabled: true,
      rateLimit: { limit: 100, windowMs: 60000 },
      domains: [],
      maxTime: null
    };
  }

  getAllToolConfigs() {
    const toolsMap = this.cache.tools || new Map();
    return Array.from(toolsMap.values());
  }

  async refreshConversationBehaviorConfig() {
    const now = Date.now();
    if (this.cache.conversationBehavior && (now - this.lastFetch.conversationBehavior) < this.cacheTTL) {
      return this.cache.conversationBehavior;
    }

    try {
      const config = await ConversationBehaviorConfig.findOne({ isActive: true }).lean();
      this.cache.conversationBehavior = config;
      this.lastFetch.conversationBehavior = now;
      if (config) {
        console.log('✅ Conversation Behavior Config refreshed');
      }
      return config;
    } catch (error) {
      console.error('Error refreshing conversation behavior config:', error);
      return this.cache.conversationBehavior || null;
    }
  }

  getConversationBehaviorConfig() {
    return this.cache.conversationBehavior || null;
  }

  // Get merged config for a specific phone number (supports per-number profiles)
  getConfigForNumber(phoneNumber, languageCode = 'en') {
    const aiConfig = this.getAIConfig();
    const audioConfig = this.getAudioConfig();
    const telephonyConfig = this.getTelephonyConfig();

    // Get language-specific instructions (multilingual support enabled)
    const languageConfig = multilingualService.getLanguageConfig(languageCode);
    const languageInstructions = multilingualService.getSystemInstructions(languageCode);

    // Check for per-number profile
    if (audioConfig?.usePerNumberProfiles && audioConfig?.perNumberProfiles) {
      const profile = audioConfig.perNumberProfiles.find(
        p => p.phoneNumber === phoneNumber
      );
      
      if (profile) {
        const baseInstructions = aiConfig.globalPrompt || 'You are a friendly AI assistant.';
        // Combine base instructions with language-specific instructions
        const fullInstructions = `${baseInstructions}\n\n${languageInstructions}`;
        
        return {
          voice: { id: languageConfig.voice, name: languageConfig.name } || profile.defaultVoice || audioConfig.defaultVoice || aiConfig.voice || { id: 'ash', name: 'Ash' },
          temperature: profile.temperature ?? audioConfig.temperature ?? aiConfig.parameters?.temperature ?? 0.8,
          vadThreshold: profile.vadThreshold ?? audioConfig.vadThreshold ?? 500,
          startPadding: profile.startPadding ?? audioConfig.startPadding ?? 300,
          endPadding: profile.endPadding ?? audioConfig.endPadding ?? 500,
          confidenceThreshold: aiConfig.uncertaintyGate?.confidenceThreshold ?? 0.8,
          minSources: aiConfig.uncertaintyGate?.minSources ?? 1,
          instructions: fullInstructions,
          model: aiConfig.model || { id: 'gpt-4o-realtime-preview', name: 'GPT-4o Realtime' },
          uncertaintyGateEnabled: aiConfig.uncertaintyGate?.enabled ?? true,
          language: languageCode,
          locale: languageConfig.code
        };
      }
    }

    // Return global config
    const baseInstructions = aiConfig.globalPrompt || 'You are a friendly AI assistant.';
    // Combine base instructions with language-specific instructions
    const fullInstructions = `${baseInstructions}\n\n${languageInstructions}`;
    
    return {
      voice: { id: languageConfig.voice, name: languageConfig.name } || audioConfig.defaultVoice || aiConfig.voice || { id: 'ash', name: 'Ash' },
      temperature: audioConfig.temperature ?? aiConfig.parameters?.temperature ?? 0.8,
      vadThreshold: audioConfig.vadThreshold ?? 500,
      startPadding: audioConfig.startPadding ?? 300,
      endPadding: audioConfig.endPadding ?? 500,
      confidenceThreshold: aiConfig.uncertaintyGate?.confidenceThreshold ?? 0.8,
      minSources: aiConfig.uncertaintyGate?.minSources ?? 1,
      instructions: fullInstructions,
      model: aiConfig.model || { id: 'gpt-4o-realtime-preview', name: 'GPT-4o Realtime' },
      uncertaintyGateEnabled: aiConfig.uncertaintyGate?.enabled ?? true,
      language: languageCode,
      locale: languageConfig.code
    };
  }

  destroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}

export default new ConfigManager();

