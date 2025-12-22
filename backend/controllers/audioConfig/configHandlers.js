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
        transcriptionModel: 'whisper-1',
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
      perNumberProfiles,
      transcriptionModel
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
    if (transcriptionModel !== undefined) config.transcriptionModel = transcriptionModel;

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

