import AudioConfig from "../../models/AudioConfig.js";

// Validate model parameters against capability registry
const validateModelParameters = async (modelId, temperature, topP, maxTokens) => {
  if (!modelId) return { valid: true }; // No validation if no model selected
  
  try {
    const modelDiscoveryService = (await import('../../services/modelDiscoveryService.js')).default;
    
    // Ensure models are discovered
    if (modelDiscoveryService.isDiscoveryNeeded()) {
      await modelDiscoveryService.discoverModels();
    }
    
    const modelParams = modelDiscoveryService.getModelParameters(modelId);
    const errors = [];
    
    if (temperature !== undefined) {
      if (temperature < modelParams.temperature.min || temperature > modelParams.temperature.max) {
        errors.push(`Temperature must be between ${modelParams.temperature.min} and ${modelParams.temperature.max}`);
      }
    }
    
    if (topP !== undefined) {
      if (topP < modelParams.top_p.min || topP > modelParams.top_p.max) {
        errors.push(`TopP must be between ${modelParams.top_p.min} and ${modelParams.top_p.max}`);
      }
    }
    
    if (maxTokens !== undefined) {
      if (maxTokens < modelParams.max_tokens.min || maxTokens > modelParams.max_tokens.max) {
        errors.push(`MaxTokens must be between ${modelParams.max_tokens.min} and ${modelParams.max_tokens.max}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      ranges: modelParams
    };
  } catch (err) {
    console.error("Error validating model parameters:", err);
    return { valid: true, warning: "Could not validate against model registry" };
  }
};

// Get model parameter ranges for a specific model
export const getModelParameterRanges = async (req, res) => {
  try {
    const { modelId } = req.query;
    
    if (!modelId) {
      return res.status(400).json({
        status: "error",
        message: "modelId is required"
      });
    }

    const modelDiscoveryService = (await import('../../services/modelDiscoveryService.js')).default;
    
    // Ensure models are discovered
    if (modelDiscoveryService.isDiscoveryNeeded()) {
      await modelDiscoveryService.discoverModels();
    }
    
    const parameters = modelDiscoveryService.getModelParameters(modelId);
    const model = modelDiscoveryService.getModelCapability(modelId);
    
    res.json({
      status: "success",
      parameters,
      model: model ? {
        id: model.id,
        name: model.name,
        capabilities: model.capabilities
      } : null
    });
  } catch (err) {
    console.error("Error getting model parameter ranges:", err);
    res.status(500).json({
      status: "error",
      message: err.message || "Internal server error"
    });
  }
};

// Get per-number audio profile
export const getNumberProfile = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    const config = await AudioConfig.findOne({ isActive: true });
    if (!config) {
      return res.status(404).json({
        status: "error",
        message: "Audio configuration not found"
      });
    }

    const profile = config.perNumberProfiles.find(p => p.phoneNumber === phoneNumber);
    
    if (!profile) {
      return res.status(404).json({
        status: "error",
        message: "Profile not found for this number"
      });
    }

    res.json({
      status: "success",
      profile
    });
  } catch (err) {
    console.error("Error getting number profile:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Create or update per-number audio profile
export const saveNumberProfile = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const profileData = req.body;

    let config = await AudioConfig.findOne({ isActive: true });
    if (!config) {
      config = new AudioConfig({ name: "default" });
    }

    // Validate model parameters if provided
    if (profileData.selectedModelId && (profileData.temperature !== undefined || profileData.topP !== undefined || profileData.maxTokens !== undefined)) {
      const validation = await validateModelParameters(
        profileData.selectedModelId,
        profileData.temperature,
        profileData.topP,
        profileData.maxTokens
      );
      if (!validation.valid) {
        return res.status(400).json({
          status: "error",
          message: "Model parameter validation failed",
          errors: validation.errors,
          ranges: validation.ranges
        });
      }
    }

    // Find existing profile or create new
    const existingIndex = config.perNumberProfiles.findIndex(p => p.phoneNumber === phoneNumber);
    
    const profile = {
      phoneNumber,
      profileName: profileData.profileName || 'Default',
      ...profileData,
      createdAt: existingIndex >= 0 ? config.perNumberProfiles[existingIndex].createdAt : new Date()
    };

    if (existingIndex >= 0) {
      config.perNumberProfiles[existingIndex] = profile;
    } else {
      config.perNumberProfiles.push(profile);
    }

    config.usePerNumberProfiles = true;
    await config.save();

    res.json({
      status: "success",
      message: "Number profile saved successfully",
      profile
    });
  } catch (err) {
    console.error("Error saving number profile:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Delete per-number audio profile
export const deleteNumberProfile = async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    const config = await AudioConfig.findOne({ isActive: true });
    if (!config) {
      return res.status(404).json({
        status: "error",
        message: "Audio configuration not found"
      });
    }

    config.perNumberProfiles = config.perNumberProfiles.filter(p => p.phoneNumber !== phoneNumber);
    
    // If no profiles left, disable per-number profiles
    if (config.perNumberProfiles.length === 0) {
      config.usePerNumberProfiles = false;
    }
    
    await config.save();

    res.json({
      status: "success",
      message: "Number profile deleted successfully"
    });
  } catch (err) {
    console.error("Error deleting number profile:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

