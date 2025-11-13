import AudioConfig from "../models/AudioConfig.js";

// Get current audio configuration
export const getAudioConfig = async (req, res) => {
  try {
    let config = await AudioConfig.findOne({ isActive: true });
    
    if (!config) {
      // Create default configuration if none exists
      config = new AudioConfig({
        name: "default",
        vadThreshold: 500,
        startPadding: 250,
        endPadding: 300,
        bargeInPolicy: "pause",
        noiseSuppression: true,
        noiseSuppressionAlgorithm: "basic",
        echoCancellation: true,
        automaticGainControl: false,
        audioQuality: "high",
        energyThreshold: null,
        energyThresholdAutoCalibrate: true,
        defaultVoice: {
          id: "ash",
          name: "Ash",
          language: "en-GB"
        },
        selectedModelId: null,
        temperature: 0.4,
        topP: 1.0,
        maxTokens: 150,
        speechRate: 1.0,
        usePerNumberProfiles: false,
        perNumberProfiles: []
      });
      await config.save();
    }

    res.json({
      status: "success",
      config
    });
  } catch (err) {
    console.error("Error fetching audio config:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Validate model parameters against capability registry
const validateModelParameters = async (modelId, temperature, topP, maxTokens) => {
  if (!modelId) return { valid: true }; // No validation if no model selected
  
  try {
    const modelDiscoveryService = (await import('../services/modelDiscoveryService.js')).default;
    
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

// Update audio configuration
export const updateAudioConfig = async (req, res) => {
  try {
    const { 
      vadThreshold,
      startPadding,
      endPadding,
      bargeInPolicy,
      noiseSuppression,
      noiseSuppressionAlgorithm,
      echoCancellation,
      automaticGainControl,
      audioQuality,
      energyThreshold,
      energyThresholdAutoCalibrate,
      defaultVoice,
      selectedModelId,
      temperature,
      topP,
      maxTokens,
      speechRate,
      usePerNumberProfiles,
      perNumberProfiles
    } = req.body;

    let config = await AudioConfig.findOne({ isActive: true });
    
    if (!config) {
      config = new AudioConfig();
    }

    // Validate model parameters if model is selected
    if (selectedModelId && (temperature !== undefined || topP !== undefined || maxTokens !== undefined)) {
      const validation = await validateModelParameters(selectedModelId, temperature, topP, maxTokens);
      if (!validation.valid) {
        return res.status(400).json({
          status: "error",
          message: "Model parameter validation failed",
          errors: validation.errors,
          ranges: validation.ranges
        });
      }
    }

    // Update fields
    if (vadThreshold !== undefined) config.vadThreshold = vadThreshold;
    if (startPadding !== undefined) config.startPadding = startPadding;
    if (endPadding !== undefined) config.endPadding = endPadding;
    if (bargeInPolicy !== undefined) config.bargeInPolicy = bargeInPolicy;
    if (noiseSuppression !== undefined) config.noiseSuppression = noiseSuppression;
    if (noiseSuppressionAlgorithm !== undefined) config.noiseSuppressionAlgorithm = noiseSuppressionAlgorithm;
    if (echoCancellation !== undefined) config.echoCancellation = echoCancellation;
    if (automaticGainControl !== undefined) config.automaticGainControl = automaticGainControl;
    if (audioQuality !== undefined) config.audioQuality = audioQuality;
    if (energyThreshold !== undefined) config.energyThreshold = energyThreshold;
    if (energyThresholdAutoCalibrate !== undefined) config.energyThresholdAutoCalibrate = energyThresholdAutoCalibrate;
    if (defaultVoice) {
      if (defaultVoice.id) config.defaultVoice.id = defaultVoice.id;
      if (defaultVoice.name) config.defaultVoice.name = defaultVoice.name;
      if (defaultVoice.language) config.defaultVoice.language = defaultVoice.language;
    }
    if (selectedModelId !== undefined) config.selectedModelId = selectedModelId;
    if (temperature !== undefined) config.temperature = temperature;
    if (topP !== undefined) config.topP = topP;
    if (maxTokens !== undefined) config.maxTokens = maxTokens;
    if (speechRate !== undefined) config.speechRate = speechRate;
    if (usePerNumberProfiles !== undefined) config.usePerNumberProfiles = usePerNumberProfiles;
    if (perNumberProfiles !== undefined) config.perNumberProfiles = perNumberProfiles;

    config.createdBy = req.user?.id || "admin";
    await config.save();

    res.json({
      status: "success",
      message: "Audio configuration updated successfully",
      config
    });
  } catch (err) {
    console.error("Error updating audio config:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Test audio configuration
export const testAudioConfig = async (req, res) => {
  try {
    const { voiceId, text } = req.body;
    
    if (!voiceId) {
      return res.status(400).json({ 
        status: "error", 
        message: "Voice ID is required" 
      });
    }

    // This would typically call OpenAI's TTS API for testing
    // For now, return a mock response
    const testResult = {
      voiceId,
      text: text || "Hello, this is a test of the audio configuration.",
      audioUrl: `https://api.openai.com/v1/audio/speech/test/${voiceId}`,
      duration: 2.5,
      format: "mp3",
      quality: "high",
      latency: 150 // ms
    };

    res.json({
      status: "success",
      testResult
    });
  } catch (err) {
    console.error("Error testing audio config:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Get audio quality metrics
export const getAudioMetrics = async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '24h'; // Default to 24 hours
    const callQualityService = (await import('../services/callQualityService.js')).default;
    
    const aggregatedMetrics = await callQualityService.getAggregatedMetrics(timeRange);
    
    // Format response to match expected frontend structure
    const metrics = {
      averageLatency: aggregatedMetrics.averageLatency || 0,
      packetLoss: aggregatedMetrics.averagePacketLoss || 0,
      jitter: aggregatedMetrics.averageJitter || 0,
      mosScore: aggregatedMetrics.averageMOS || 0,
      callQuality: aggregatedMetrics.averageMOS 
        ? (aggregatedMetrics.averageMOS >= 4.0 ? 'excellent' : 
           aggregatedMetrics.averageMOS >= 3.5 ? 'good' : 
           aggregatedMetrics.averageMOS >= 3.0 ? 'fair' : 'poor')
        : 'good',
      lastUpdated: aggregatedMetrics.lastUpdated,
      // Include additional statistics
      totalCalls: aggregatedMetrics.totalCalls,
      minLatency: aggregatedMetrics.minLatency,
      maxLatency: aggregatedMetrics.maxLatency,
      minJitter: aggregatedMetrics.minJitter,
      maxJitter: aggregatedMetrics.maxJitter,
      minPacketLoss: aggregatedMetrics.minPacketLoss,
      maxPacketLoss: aggregatedMetrics.maxPacketLoss,
      minMOS: aggregatedMetrics.minMOS,
      maxMOS: aggregatedMetrics.maxMOS,
      p95Latency: aggregatedMetrics.p95Latency,
      p99Latency: aggregatedMetrics.p99Latency,
      p95Jitter: aggregatedMetrics.p95Jitter,
      p99Jitter: aggregatedMetrics.p99Jitter,
      p95PacketLoss: aggregatedMetrics.p95PacketLoss,
      p99PacketLoss: aggregatedMetrics.p99PacketLoss,
      qualityDistribution: aggregatedMetrics.qualityDistribution
    };

    res.json({
      status: "success",
      metrics
    });
  } catch (err) {
    console.error("Error fetching audio metrics:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Get historical audio quality data for charts
export const getHistoricalAudioMetrics = async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '24h';
    const dataPoints = parseInt(req.query.dataPoints) || 20;
    const callQualityService = (await import('../services/callQualityService.js')).default;
    
    const historicalData = await callQualityService.getHistoricalData(timeRange, dataPoints);
    
    res.json({
      status: "success",
      data: historicalData
    });
  } catch (err) {
    console.error("Error fetching historical audio metrics:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Get recent calls with quality metrics
export const getRecentCallsWithQuality = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const qualityFilter = req.query.qualityFilter || null;
    const callQualityService = (await import('../services/callQualityService.js')).default;
    
    const calls = await callQualityService.getRecentCallsWithQuality(limit, qualityFilter);
    
    res.json({
      status: "success",
      calls
    });
  } catch (err) {
    console.error("Error fetching recent calls with quality:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
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

    const modelDiscoveryService = (await import('../services/modelDiscoveryService.js')).default;
    
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










