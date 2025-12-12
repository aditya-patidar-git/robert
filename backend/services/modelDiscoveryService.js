import OpenAI from 'openai';
import dotenv from 'dotenv';
import AIConfig from '../models/AIConfig.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class ModelDiscoveryService {
  constructor() {
    this.capabilityRegistry = new Map();
    this.lastDiscovery = null;
    this.discoveryInterval = 60 * 60 * 1000; // 1 hour
  }

  // Discover and cache model capabilities from OpenAI /v1/models API
  async discoverModels() {
    try {
      console.log('🔍 Starting model discovery from OpenAI /v1/models...');
      
      if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY is not set. Cannot discover models.');
        console.log('⚠️ Returning fallback models due to missing API key');
        return this.getFallbackModels();
      }

      const response = await openai.models.list();
      const models = response.data.map(model => ({
        id: model.id,
        name: model.id,
        capabilities: this.mapModelCapabilities(model),
        contextLimit: this.getContextLimit(model.id),
        supportsTools: this.supportsTools(model.id),
        supportsAudio: this.supportsAudio(model.id),
        supportsRealtime: this.supportsRealtime(model.id),
        defaultTemperature: 0.4,
        defaultTopP: 1.0,
        rateLimits: this.getRateLimits(model.id),
        knownLimitations: this.getKnownLimitations(model.id)
      }));

      // Update capability registry
      this.capabilityRegistry.clear();
      models.forEach(model => {
        this.capabilityRegistry.set(model.id, model);
      });

      this.lastDiscovery = new Date();
      
      console.log(`✅ Discovered ${models.length} models from OpenAI API`);
      return models;
    } catch (error) {
      console.error('Error discovering models from OpenAI:', error);
      throw new Error(`Model discovery failed: ${error.message}`);
    }
  }

  // Get cached model capabilities
  getModelCapabilities() {
    return Array.from(this.capabilityRegistry.values());
  }

  // Map model capabilities based on model ID
  mapModelCapabilities(model) {
    return {
      realtime: this.supportsRealtime(model.id),
      streaming: true, // Most models support streaming
      fileSearch: this.supportsFileSearch(model.id),
      functionCalling: this.supportsTools(model.id),
      audio: this.supportsAudio(model.id),
      multimodal: this.supportsMultimodal(model.id)
    };
  }

  // Check if model supports realtime audio
  supportsRealtime(modelId) {
    return modelId.includes('realtime') || modelId.includes('gpt-realtime');
  }

  // Check if model supports audio
  supportsAudio(modelId) {
    return this.supportsRealtime(modelId) || modelId.includes('whisper') || modelId.includes('tts');
  }

  // Check if model supports tools/function calling
  supportsTools(modelId) {
    return !modelId.includes('whisper') && !modelId.includes('tts') && !modelId.includes('embedding');
  }

  // Check if model supports file search
  supportsFileSearch(modelId) {
    return this.supportsTools(modelId) && !modelId.includes('whisper') && !modelId.includes('tts');
  }

  // Check if model supports multimodal
  supportsMultimodal(modelId) {
    return modelId.includes('vision') || modelId.includes('4o') || this.supportsRealtime(modelId);
  }

  // Get context limit based on model
  getContextLimit(modelId) {
    if (modelId.includes('gpt-4o')) return 128000;
    if (modelId.includes('gpt-4')) return 128000;
    if (modelId.includes('gpt-3.5')) return 16385;
    if (this.supportsRealtime(modelId)) return 128000;
    return 4096; // Default fallback
  }

  // Get rate limits (mock implementation)
  getRateLimits(modelId) {
    return {
      requestsPerMinute: 500,
      tokensPerMinute: 150000,
      requestsPerDay: 10000
    };
  }

  // Get known limitations
  getKnownLimitations(modelId) {
    const limitations = [];
    if (this.supportsRealtime(modelId)) {
      limitations.push('Requires realtime audio setup');
    }
    if (modelId.includes('whisper')) {
      limitations.push('Audio input only, no text output');
    }
    if (modelId.includes('tts')) {
      limitations.push('Text input only, no text output');
    }
    return limitations;
  }

  // Get specific model capabilities
  getModelCapability(modelId) {
    return this.capabilityRegistry.get(modelId);
  }

  // Check if discovery is needed
  isDiscoveryNeeded() {
    if (!this.lastDiscovery) return true;
    return (Date.now() - this.lastDiscovery.getTime()) > this.discoveryInterval;
  }

  // Get models with specific capabilities
  getModelsByCapability(capability) {
    const models = this.getModelCapabilities();
    return models.filter(model => {
      switch (capability) {
        case 'audio':
          return model.capabilities.audio;
        case 'tools':
          return model.capabilities.tools;
        case 'realtime':
          return model.capabilities.realtime;
        case 'file_search':
          return model.capabilities.file_search;
        case 'streaming':
          return model.capabilities.streaming;
        default:
          return false;
      }
    });
  }

  // Get recommended models for different use cases
  getRecommendedModels() {
    const models = this.getModelCapabilities();
    
    return {
      realtime: models.filter(m => m.capabilities.realtime && m.capabilities.audio),
      transcription: models.filter(m => m.id.includes('whisper') || m.id.includes('transcribe')),
      text_generation: models.filter(m => m.capabilities.tools && !m.capabilities.audio),
      file_search: models.filter(m => m.capabilities.file_search)
    };
  }

  // Build fallback chain for a use case
  buildFallbackChain(useCase = 'realtime') {
    const recommended = this.getRecommendedModels();
    const models = recommended[useCase] || recommended.realtime;
    
    // Sort by preference (realtime first, then by context limit)
    const sorted = models.sort((a, b) => {
      if (a.capabilities.realtime && !b.capabilities.realtime) return -1;
      if (!a.capabilities.realtime && b.capabilities.realtime) return 1;
      return b.context_limit - a.context_limit;
    });

    return sorted.map(model => model.id);
  }

  // Validate model selection
  validateModelSelection(modelId, useCase = 'realtime') {
    const model = this.getModelCapability(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found in capability registry`);
    }

    const requirements = {
      realtime: ['audio', 'realtime', 'tools'],
      transcription: ['audio'],
      text_generation: ['tools'],
      file_search: ['file_search', 'tools']
    };

    const required = requirements[useCase] || requirements.realtime;
    const missing = required.filter(req => !model.capabilities[req]);

    if (missing.length > 0) {
      throw new Error(`Model ${modelId} missing required capabilities: ${missing.join(', ')}`);
    }

    return true;
  }

  // Get model parameters for a specific model
  getModelParameters(modelId) {
    const model = this.getModelCapability(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Determine if this is a realtime model
    const isRealtimeModel = this.supportsRealtime(modelId);
    
    // For max_tokens, use reasonable response generation limits
    // Realtime models typically have lower response limits
    const maxTokensLimit = isRealtimeModel 
      ? Math.min(4096, model.contextLimit || 128000)
      : Math.min(8192, model.contextLimit || 128000);

    return {
      temperature: {
        default: model.defaultTemperature || 0.4,
        min: 0,
        max: 1,
        step: 0.1
      },
      top_p: {
        default: model.defaultTopP || 1.0,
        min: 0,
        max: 1,
        step: 0.1
      },
      max_tokens: {
        default: Math.min(150, Math.floor((model.contextLimit || 128000) * 0.1)),
        min: 1,
        max: maxTokensLimit,
        step: 1
      },
      context_limit: model.contextLimit || 128000
    };
  }

  // Update AI configuration with discovered models
  async updateAIConfigWithModels() {
    try {
      const models = this.getModelCapabilities();
      const realtimeModels = this.getModelsByCapability('realtime');
      
      if (realtimeModels.length === 0) {
        console.warn('⚠️ No realtime models found');
        return;
      }

      // Get or create default AI config
      let config = await AIConfig.findOne({ isActive: true });
      const defaultVoiceId = 'ash';
      
      if (!config) {
        // Convert model IDs to objects with voice
        const fallbackChainModelIds = this.buildFallbackChain('realtime');
        const fallbackChain = fallbackChainModelIds.map(modelId => ({
          modelId,
          voiceId: defaultVoiceId
        }));
        
        config = new AIConfig({
          name: 'default',
          globalPrompt: 'You are Robert, Universal Motorcycle Training\'s AI phone agent.',
          parameters: {
            temperature: 0.4,
            topP: 1.0,
            maxTokens: 150,
            speechRate: 1.0
          },
          model: {
            id: realtimeModels[0].id,
            name: realtimeModels[0].name,
            fallbackChain
          },
          voice: {
            id: defaultVoiceId,
            name: 'Ash',
            language: 'en-US'
          },
          uncertaintyGate: {
            enabled: true,
            confidenceThreshold: 0.8,
            minSources: 1
          }
        });
      } else {
        // Update existing config with new model info
        // Convert model IDs to objects with voice, preserving existing voice IDs where possible
        const fallbackChainModelIds = this.buildFallbackChain('realtime');
        const currentVoiceId = config.voice?.id || defaultVoiceId;
        
        // Preserve existing voice assignments if model exists in both old and new chain
        const existingChainMap = new Map();
        if (Array.isArray(config.model.fallbackChain)) {
          config.model.fallbackChain.forEach(item => {
            const modelId = typeof item === 'string' ? item : item.modelId;
            const voiceId = typeof item === 'string' ? currentVoiceId : item.voiceId;
            if (modelId) {
              existingChainMap.set(modelId, voiceId);
            }
          });
        }
        
        config.model.fallbackChain = fallbackChainModelIds.map(modelId => ({
          modelId,
          voiceId: existingChainMap.get(modelId) || currentVoiceId
        }));
        
        if (!realtimeModels.find(m => m.id === config.model.id)) {
          config.model.id = realtimeModels[0].id;
          config.model.name = realtimeModels[0].name;
        }
      }

      await config.save();
      console.log('✅ AI config updated with discovered models');
      return config;
    } catch (error) {
      console.error('Error updating AI config:', error);
      throw new Error(`Failed to update AI config: ${error.message}`);
    }
  }

  // Start periodic discovery
  startPeriodicDiscovery() {
    console.log('🔄 Starting periodic model discovery...');
    
    // Run immediately
    this.discoverModels().catch(console.error);
    
    // Then run every hour
    setInterval(() => {
      if (this.isDiscoveryNeeded()) {
        this.discoverModels().catch(console.error);
      }
    }, this.discoveryInterval);
  }

  // Get discovery status
  getDiscoveryStatus() {
    return {
      lastDiscovery: this.lastDiscovery,
      nextDiscovery: this.lastDiscovery ? 
        new Date(this.lastDiscovery.getTime() + this.discoveryInterval) : 
        new Date(),
      modelsCount: this.capabilityRegistry.size,
      isDiscoveryNeeded: this.isDiscoveryNeeded()
    };
  }

  // Force discovery (for testing)
  async forceDiscovery() {
    console.log('🔄 Forcing model discovery...');
    return await this.discoverModels();
  }

  // Get fallback models when API key is missing
  getFallbackModels() {
    console.log('📋 Using fallback models (API key not available)');
    return [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        capabilities: {
          realtime: false,
          streaming: true,
          fileSearch: true,
          functionCalling: true,
          audio: false,
          multimodal: true
        },
        contextLimit: 128000,
        supportsTools: true,
        supportsAudio: false,
        supportsRealtime: false,
        defaultTemperature: 0.4,
        defaultTopP: 1.0,
        rateLimits: {
          requestsPerMinute: 500,
          tokensPerMinute: 150000,
          requestsPerDay: 10000
        },
        knownLimitations: []
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        capabilities: {
          realtime: false,
          streaming: true,
          fileSearch: true,
          functionCalling: true,
          audio: false,
          multimodal: true
        },
        contextLimit: 128000,
        supportsTools: true,
        supportsAudio: false,
        supportsRealtime: false,
        defaultTemperature: 0.4,
        defaultTopP: 1.0,
        rateLimits: {
          requestsPerMinute: 500,
          tokensPerMinute: 150000,
          requestsPerDay: 10000
        },
        knownLimitations: []
      },
      {
        id: "gpt-realtime",
        name: "GPT Realtime",
        capabilities: {
          realtime: true,
          streaming: true,
          fileSearch: true,
          functionCalling: true,
          audio: true,
          multimodal: true
        },
        contextLimit: 128000,
        supportsTools: true,
        supportsAudio: true,
        supportsRealtime: true,
        defaultTemperature: 0.4,
        defaultTopP: 1.0,
        rateLimits: {
          requestsPerMinute: 500,
          tokensPerMinute: 150000,
          requestsPerDay: 10000
        },
        knownLimitations: ['Requires realtime audio setup']
      }
    ];
  }
}

export default new ModelDiscoveryService();
