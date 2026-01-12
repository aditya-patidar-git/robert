import { connectDB } from '../database/connection.js';
import AIConfig from '../database/models/AIConfig.js';
import AudioConfig from '../database/models/AudioConfig.js';
import TelephonyConfig from '../database/models/TelephonyConfig.js';
import ToolConfig from '../database/models/ToolConfig.js';
import ConversationBehaviorConfig from '../database/models/ConversationBehaviorConfig.js';
import FlowParameterOverride from '../database/models/FlowParameterOverride.js';
import CRMTasksConfig from '../database/models/CRMTasksConfig.js';
import multilingualService from '../services/multilingualService.js';
import promptService from '../services/promptService.js';
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
      conversationBehavior: null,
      flowParameterOverrides: null,
      crmTasks: null
    };
    this.lastFetch = {
      ai: 0,
      audio: 0,
      telephony: 0,
      tools: 0,
      conversationBehavior: 0,
      flowParameterOverrides: 0,
      crmTasks: 0
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
        this.refreshConversationBehaviorConfig(),
        this.refreshFlowParameterOverrides(),
        this.refreshCRMTasksConfig()
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

  async refreshFlowParameterOverrides() {
    const now = Date.now();
    if (this.cache.flowParameterOverrides && (now - this.lastFetch.flowParameterOverrides) < this.cacheTTL) {
      return this.cache.flowParameterOverrides;
    }

    try {
      const overrides = await FlowParameterOverride.find({ enabled: true })
        .sort({ priority: -1 })
        .lean();
      
      // Convert to Map for faster lookup
      const overridesMap = new Map();
      overrides.forEach(override => {
        overridesMap.set(override.flowType, override);
      });
      
      this.cache.flowParameterOverrides = overridesMap;
      this.lastFetch.flowParameterOverrides = now;
      
      if (overrides.length > 0) {
        console.log(`✅ Flow Parameter Overrides refreshed: ${overrides.length} overrides`);
      }
      return overridesMap;
    } catch (error) {
      console.error('Error refreshing flow parameter overrides:', error);
      return this.cache.flowParameterOverrides || new Map();
    }
  }

  /**
   * Get effective parameters for a flow type
   * Merges flow-specific overrides with global AIConfig
   * @param {string} flowType - Flow type: 'booking', 'complaint', 'information', 'human_transfer', 'default'
   * @param {Object} aiConfig - Global AI configuration
   * @returns {Object} - Effective parameters with temperature and model
   */
  getEffectiveParameters(flowType, aiConfig) {
    const overrides = this.cache.flowParameterOverrides || new Map();
    const flowOverride = overrides.get(flowType);
    
    if (!flowOverride || !flowOverride.enabled) {
      // No override, use global config (backward compatible)
      return {
        temperature: aiConfig?.parameters?.temperature ?? 0.4,
        model: aiConfig?.model?.id || 'gpt-4o-realtime-preview'
      };
    }

    // Merge override with global config (override takes precedence)
    return {
      temperature: flowOverride.parameters?.temperature ?? aiConfig?.parameters?.temperature ?? 0.4,
      model: flowOverride.model?.id || aiConfig?.model?.id || 'gpt-4o-realtime-preview'
    };
  }

  async refreshCRMTasksConfig() {
    const now = Date.now();
    if (this.cache.crmTasks && (now - this.lastFetch.crmTasks) < this.cacheTTL) {
      return this.cache.crmTasks;
    }

    try {
      const config = await CRMTasksConfig.findOne({ isActive: true }).lean();
      this.cache.crmTasks = config;
      this.lastFetch.crmTasks = now;
      if (config) {
        console.log('✅ CRM Tasks Config refreshed');
      }
      return config;
    } catch (error) {
      console.error('Error refreshing CRM tasks config:', error);
      return this.cache.crmTasks || null;
    }
  }

  getCRMTasksConfig() {
    return this.cache.crmTasks || null;
  }

  /**
   * Check if a CRM task is enabled
   * @param {string} taskName - Task name: 'createBooking', 'reschedule', 'cancel', 'updateRecord', 'issueRefund'
   * @returns {boolean} - True if task is enabled (defaults to true if no config)
   */
  isCRMTaskEnabled(taskName) {
    const config = this.getCRMTasksConfig();
    if (!config) return true; // Default to enabled (backward compatible)
    
    const task = config.tasks?.[taskName];
    return task?.enabled !== false; // Default to enabled
  }

  /**
   * Check if confirmation is required for a task
   * @param {string} taskName - Task name
   * @returns {boolean} - True if confirmation required (defaults to true if no config)
   */
  requiresConfirmation(taskName) {
    const config = this.getCRMTasksConfig();
    if (!config) return true; // Default to requiring confirmation (backward compatible)
    
    const task = config.tasks?.[taskName];
    return task?.requireConfirmation !== false; // Default to requiring confirmation
  }

  /**
   * Check if dry run is enforced
   * @returns {boolean} - True if dry run enforced (defaults to true if no config)
   */
  isDryRunEnforced() {
    const config = this.getCRMTasksConfig();
    return config?.generalSettings?.dryRunEnforced !== false; // Default to enforced (backward compatible)
  }

  // Get merged config for a specific phone number (supports per-number profiles)
  getConfigForNumber(phoneNumber, languageCode = 'en') {
    const aiConfig = this.getAIConfig();
    const audioConfig = this.getAudioConfig();
    const telephonyConfig = this.getTelephonyConfig();

    // Get language-specific instructions (multilingual support enabled)
    const languageConfig = multilingualService.getLanguageConfig(languageCode);
    const languageInstructions = multilingualService.getSystemInstructions(languageCode);

    // Helper function to determine voice with proper priority
    const getVoice = (profile = null) => {
      // Priority: profile.defaultVoice > aiConfig.voice > audioConfig.defaultVoice > languageConfig.voice > default
      if (profile?.defaultVoice?.id) {
        // Preserve language field if present
        return {
          id: profile.defaultVoice.id,
          name: profile.defaultVoice.name || profile.defaultVoice.id,
          language: profile.defaultVoice.language || 'en-GB'
        };
      }
      if (aiConfig?.voice?.id) {
        // Preserve language field from database
        return {
          id: aiConfig.voice.id,
          name: aiConfig.voice.name || aiConfig.voice.id,
          language: aiConfig.voice.language || 'en-GB'
        };
      }
      if (audioConfig?.defaultVoice?.id) {
        // Preserve language field if present
        return {
          id: audioConfig.defaultVoice.id,
          name: audioConfig.defaultVoice.name || audioConfig.defaultVoice.id,
          language: audioConfig.defaultVoice.language || 'en-GB'
        };
      }
      if (languageConfig?.voice) {
        return { 
          id: languageConfig.voice, 
          name: languageConfig.name || languageConfig.voice,
          language: 'en-GB' // Default to British for English
        };
      }
      return { id: 'ash', name: 'Ash', language: 'en-GB' };
    };

    // Check for per-number profile
    if (audioConfig?.usePerNumberProfiles && audioConfig?.perNumberProfiles) {
      const profile = audioConfig.perNumberProfiles.find(
        p => p.phoneNumber === phoneNumber
      );
      
      if (profile) {
        // Get the selected voice
        const selectedVoice = getVoice(profile);
        
        // Check if voice has British English language setting
        const isBritishVoice = selectedVoice.language === 'en-GB' || selectedVoice.language?.toLowerCase() === 'en-gb';
        
        // Enhance British accent instructions if voice is configured for British English
        let enhancedInstructions = languageInstructions;
        if (isBritishVoice && languageCode === 'en') {
          const britishAccentEmphasis = `\n\nCRITICAL ACCENT REQUIREMENT: You MUST speak with a clear, authentic British English accent at all times. Use British pronunciation patterns, British intonation, and British speech rhythm. Pronounce words like a native British English speaker from England. Enunciate clearly with British English phonetics. This is essential - the accent must be distinctly British, not American. Every word you speak must reflect British English pronunciation.`;
          enhancedInstructions = `${languageInstructions}${britishAccentEmphasis}`;
        }
        
        // PHASE 1: Use minimal core prompt instead of full globalPrompt to prevent model overwhelm
        // The full globalPrompt (100k+ chars) causes code/JSON generation instead of audio
        // Detailed instructions are provided contextually via response.create instead
        const baseInstructions = promptService.getCorePrompt();
        // Combine base instructions with enhanced language-specific instructions
        const fullInstructions = `${baseInstructions}\n\n${enhancedInstructions}`;
        
        return {
          voice: selectedVoice,
          temperature: profile.temperature ?? audioConfig?.temperature ?? aiConfig?.parameters?.temperature ?? 0.8,
          vadThreshold: profile.vadThreshold ?? audioConfig?.vadThreshold ?? 500,
          startPadding: profile.startPadding ?? audioConfig?.startPadding ?? 300,
          endPadding: profile.endPadding ?? audioConfig?.endPadding ?? 500,
          confidenceThreshold: aiConfig?.uncertaintyGate?.confidenceThreshold ?? 0.8,
          minSources: aiConfig?.uncertaintyGate?.minSources ?? 1,
          instructions: fullInstructions,
          model: aiConfig?.model || { id: 'gpt-4o-realtime-preview', name: 'GPT-4o Realtime' },
          uncertaintyGateEnabled: aiConfig?.uncertaintyGate?.enabled ?? true,
          language: languageCode,
          locale: languageConfig?.code || 'en-GB'
        };
      }
    }

    // Get the selected voice for global config
    const selectedVoice = getVoice();
    
    // Check if voice has British English language setting
    const isBritishVoice = selectedVoice.language === 'en-GB' || selectedVoice.language?.toLowerCase() === 'en-gb';
    
    // Enhance British accent instructions if voice is configured for British English
    let enhancedInstructions = languageInstructions;
    if (isBritishVoice && languageCode === 'en') {
      const britishAccentEmphasis = `\n\nCRITICAL ACCENT REQUIREMENT: You MUST speak with a clear, authentic British English accent at all times. Use British pronunciation patterns, British intonation, and British speech rhythm. Pronounce words like a native British English speaker from England. Enunciate clearly with British English phonetics. This is essential - the accent must be distinctly British, not American. Every word you speak must reflect British English pronunciation.`;
      enhancedInstructions = `${languageInstructions}${britishAccentEmphasis}`;
    }

    // PHASE 1: Use minimal core prompt instead of full globalPrompt to prevent model overwhelm
    // The full globalPrompt (100k+ chars) causes code/JSON generation instead of audio
    // Detailed instructions are provided contextually via response.create instead
    const baseInstructions = promptService.getCorePrompt();
    // Combine base instructions with enhanced language-specific instructions
    const fullInstructions = `${baseInstructions}\n\n${enhancedInstructions}`;
    
    return {
      voice: selectedVoice,
      temperature: audioConfig?.temperature ?? aiConfig?.parameters?.temperature ?? 0.8,
      vadThreshold: audioConfig?.vadThreshold ?? 500,
      startPadding: audioConfig?.startPadding ?? 300,
      endPadding: audioConfig?.endPadding ?? 500,
      confidenceThreshold: aiConfig?.uncertaintyGate?.confidenceThreshold ?? 0.8,
      minSources: aiConfig?.uncertaintyGate?.minSources ?? 1,
      instructions: fullInstructions,
      model: aiConfig?.model || { id: 'gpt-4o-realtime-preview', name: 'GPT-4o Realtime' },
      uncertaintyGateEnabled: aiConfig?.uncertaintyGate?.enabled ?? true,
      language: languageCode,
      locale: languageConfig?.code || 'en-GB'
    };
  }

  destroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}

export default new ConfigManager();

