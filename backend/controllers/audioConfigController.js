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
        echoCancellation: true,
        audioQuality: "high",
        defaultVoice: {
          id: "ash",
          name: "Ash",
          language: "en-GB"
        },
        temperature: 0.4,
        topP: 1.0,
        maxTokens: 150,
        speechRate: 1.0
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
      echoCancellation,
      audioQuality,
      defaultVoice,
      temperature,
      topP,
      maxTokens,
      speechRate
    } = req.body;

    let config = await AudioConfig.findOne({ isActive: true });
    
    if (!config) {
      config = new AudioConfig();
    }

    // Update fields
    if (vadThreshold !== undefined) config.vadThreshold = vadThreshold;
    if (startPadding !== undefined) config.startPadding = startPadding;
    if (endPadding !== undefined) config.endPadding = endPadding;
    if (bargeInPolicy !== undefined) config.bargeInPolicy = bargeInPolicy;
    if (noiseSuppression !== undefined) config.noiseSuppression = noiseSuppression;
    if (echoCancellation !== undefined) config.echoCancellation = echoCancellation;
    if (audioQuality !== undefined) config.audioQuality = audioQuality;
    if (defaultVoice) {
      if (defaultVoice.id) config.defaultVoice.id = defaultVoice.id;
      if (defaultVoice.name) config.defaultVoice.name = defaultVoice.name;
      if (defaultVoice.language) config.defaultVoice.language = defaultVoice.language;
    }
    if (temperature !== undefined) config.temperature = temperature;
    if (topP !== undefined) config.topP = topP;
    if (maxTokens !== undefined) config.maxTokens = maxTokens;
    if (speechRate !== undefined) config.speechRate = speechRate;

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
    // This would typically fetch real-time audio quality metrics
    // For now, return mock data
    const metrics = {
      averageLatency: 120, // ms
      packetLoss: 0.1, // %
      jitter: 5.2, // ms
      mosScore: 4.2, // Mean Opinion Score
      callQuality: "excellent",
      lastUpdated: new Date()
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





