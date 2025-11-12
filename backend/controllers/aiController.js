import AIConfig from "../models/AIConfig.js";

// Helper function to migrate old string format to new object format
const migrateFallbackChain = (fallbackChain, defaultVoiceId = 'ash') => {
  if (!Array.isArray(fallbackChain)) {
    return [];
  }
  
  return fallbackChain.map(item => {
    // If already in new format (object with modelId and voiceId), return as is
    if (typeof item === 'object' && item !== null && item.modelId && item.voiceId) {
      return item;
    }
    // If old format (string), convert to new format
    if (typeof item === 'string') {
      return {
        modelId: item,
        voiceId: defaultVoiceId
      };
    }
    // Invalid format, skip
    return null;
  }).filter(item => item !== null);
};

// Get current AI configuration
export const getConfig = async (req, res) => {
  try {
    let config = await AIConfig.findOne({ isActive: true });
    
    if (!config) {
      // Create default configuration if none exists
      const defaultVoiceId = 'ash';
      config = new AIConfig({
        name: "default",
        globalPrompt: "You are Robert, a helpful AI assistant for Universal Motorcycle Training. Be polite, professional, and helpful.",
        parameters: {
          temperature: 0.4,
          topP: 1.0,
          maxTokens: 150,
          speechRate: 1.0
        },
        model: {
          id: "gpt-realtime",
          name: "GPT Realtime",
          fallbackChain: [
            { modelId: "gpt-realtime", voiceId: defaultVoiceId },
            { modelId: "gpt-4o", voiceId: defaultVoiceId }
          ]
        },
        voice: {
          id: defaultVoiceId,
          name: "Ash",
          language: "en-US"
        },
        uncertaintyGate: {
          enabled: true,
          confidenceThreshold: 0.8,
          minSources: 1
        }
      });
      await config.save();
    } else {
      // Migrate old format to new format if needed
      const currentVoiceId = config.voice?.id || 'ash';
      const migratedChain = migrateFallbackChain(config.model.fallbackChain, currentVoiceId);
      
      // If migration occurred, update and save
      if (migratedChain.length !== config.model.fallbackChain.length || 
          config.model.fallbackChain.some((item, index) => {
            if (typeof item === 'string') return true;
            if (typeof item === 'object' && (!item.modelId || !item.voiceId)) return true;
            return false;
          })) {
        config.model.fallbackChain = migratedChain;
        await config.save();
      }
    }

    res.json({
      status: "success",
      config
    });
  } catch (err) {
    console.error("Error fetching AI config:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Update AI configuration
export const updateConfig = async (req, res) => {
  try {
    const { 
      globalPrompt, 
      parameters, 
      model, 
      voice, 
      uncertaintyGate 
    } = req.body;

    let config = await AIConfig.findOne({ isActive: true });
    
    if (!config) {
      config = new AIConfig();
    }

    // Update fields
    if (globalPrompt !== undefined) config.globalPrompt = globalPrompt;
    if (parameters) {
      if (parameters.temperature !== undefined) config.parameters.temperature = parameters.temperature;
      if (parameters.topP !== undefined) config.parameters.topP = parameters.topP;
      if (parameters.maxTokens !== undefined) config.parameters.maxTokens = parameters.maxTokens;
      if (parameters.speechRate !== undefined) config.parameters.speechRate = parameters.speechRate;
    }
    if (model) {
      if (model.id) config.model.id = model.id;
      if (model.name) config.model.name = model.name;
      // Always save fallback chain (even if empty array) to ensure database persistence
      if (model.fallbackChain !== undefined) {
        if (Array.isArray(model.fallbackChain)) {
          // Validate and normalize fallback chain format
          const currentVoiceId = voice?.id || config.voice?.id || 'ash';
          config.model.fallbackChain = model.fallbackChain.map(item => {
            // If already in correct format, return as is
            if (typeof item === 'object' && item !== null && item.modelId && item.voiceId) {
              return {
                modelId: item.modelId,
                voiceId: item.voiceId
              };
            }
            // If old string format, convert to new format
            if (typeof item === 'string') {
              return {
                modelId: item,
                voiceId: currentVoiceId
              };
            }
            // Invalid format, skip
            return null;
          }).filter(item => item !== null);
        } else {
          config.model.fallbackChain = [];
        }
      }
    }
    if (voice) {
      if (voice.id) config.voice.id = voice.id;
      if (voice.name) config.voice.name = voice.name;
      if (voice.language) config.voice.language = voice.language;
    }
    if (uncertaintyGate) {
      if (uncertaintyGate.enabled !== undefined) config.uncertaintyGate.enabled = uncertaintyGate.enabled;
      if (uncertaintyGate.confidenceThreshold !== undefined) config.uncertaintyGate.confidenceThreshold = uncertaintyGate.confidenceThreshold;
      if (uncertaintyGate.minSources !== undefined) config.uncertaintyGate.minSources = uncertaintyGate.minSources;
    }

    config.createdBy = req.user?.id || "admin";
    await config.save();

    res.json({
      status: "success",
      message: "AI configuration updated successfully",
      config
    });
  } catch (err) {
    console.error("Error updating AI config:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Get available models from discovery service
export const getModels = async (req, res) => {
  try {
    const { forceRefresh = false } = req.query;
    
    // Import model discovery service
    const modelDiscoveryService = (await import('../services/modelDiscoveryService.js')).default;
    
    // Force refresh if requested or if discovery is needed
    if (forceRefresh === 'true' || modelDiscoveryService.isDiscoveryNeeded()) {
      await modelDiscoveryService.discoverModels();
    }

    const models = modelDiscoveryService.getModelCapabilities();

    res.json({
      status: "success",
      models
    });
  } catch (err) {
    console.error("Error fetching models:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Get recommended fallback chain
export const getRecommendedFallbackChain = async (req, res) => {
  try {
    const modelDiscoveryService = (await import('../services/modelDiscoveryService.js')).default;
    
    // Ensure models are discovered
    if (modelDiscoveryService.isDiscoveryNeeded()) {
      await modelDiscoveryService.discoverModels();
    }
    
    const fallbackChain = modelDiscoveryService.buildFallbackChain('realtime');
    
    res.json({
      status: "success",
      fallbackChain
    });
  } catch (err) {
    console.error("Error generating fallback chain:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Test AI prompt
export const testPrompt = async (req, res) => {
  try {
    const { prompt, parameters } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        status: "error", 
        message: "Prompt is required" 
      });
    }

    // This would typically call OpenAI API with the test prompt
    // For now, return a mock response
    const mockResponse = {
      response: "This is a test response from the AI model. The actual implementation would call OpenAI's API with the provided prompt and parameters.",
      tokens: {
        prompt: prompt.length,
        completion: 50,
        total: prompt.length + 50
      },
      latency: 1.2,
      model: parameters?.model || "gpt-realtime"
    };

    res.json({
      status: "success",
      result: mockResponse
    });
  } catch (err) {
    console.error("Error testing prompt:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error"  
    });
  }
};

// Get model parameters for a specific model
export const getModelParameters = async (req, res) => {
  try {
    const { modelId } = req.query;
    if (!modelId) {
      return res.status(400).json({ 
        status: "error", 
        message: "modelId is required" 
      });
    }
    const modelDiscoveryService = (await import('../services/modelDiscoveryService.js')).default;
    
    // Ensure models are discovered
    if (modelDiscoveryService.isDiscoveryNeeded()) {
      await modelDiscoveryService.discoverModels();
    }
    
    const parameters = modelDiscoveryService.getModelParameters(modelId);
    res.json({ status: "success", parameters });
  } catch (err) {
    console.error("Error getting model parameters:", err);
    res.status(500).json({ 
      status: "error", 
      message: err.message || "Internal server error" 
    });
  }
};

// Get all model capabilities and discovery status
export const getModelCapabilities = async (req, res) => {
  try {
    const modelDiscoveryService = (await import('../services/modelDiscoveryService.js')).default;
    
    // Ensure models are discovered
    if (modelDiscoveryService.isDiscoveryNeeded()) {
      await modelDiscoveryService.discoverModels();
    }
    
    const capabilities = modelDiscoveryService.getModelCapabilities();
    const discoveryStatus = modelDiscoveryService.getDiscoveryStatus();
    
    res.json({
      status: "success",
      capabilities,
      discoveryStatus
    });
  } catch (error) {
    console.error("Error getting model capabilities:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Internal server error"
    });
  }
};
