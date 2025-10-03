// Get all voices from discovery service
export const getVoices = async (req, res) => {
  try {
    const { language, forceRefresh = false } = req.query;
    
    // Import voice discovery service
    const voiceDiscoveryService = (await import('../services/voiceDiscoveryService.js')).default;
    
    // Force refresh if requested or if discovery is needed
    if (forceRefresh === 'true' || voiceDiscoveryService.isDiscoveryNeeded()) {
      await voiceDiscoveryService.discoverVoices();
    }

    let voices = voiceDiscoveryService.getVoices();
    
    // Filter by language if specified
    if (language) {
      voices = voices.filter(voice => voice.language === language);
    }

    res.json({
      status: "success",
      voices
    });
  } catch (err) {
    console.error("Error fetching voices:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Get voice by ID from discovery service
export const getVoice = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Import voice discovery service
    const voiceDiscoveryService = (await import('../services/voiceDiscoveryService.js')).default;
    
    const voice = voiceDiscoveryService.getVoice(id);
    
    if (!voice) {
      return res.status(404).json({ 
        status: "error", 
        message: "Voice not found" 
      });
    }

    res.json({
      status: "success",
      voice
    });
  } catch (err) {
    console.error("Error fetching voice:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Create new voice
export const createVoice = async (req, res) => {
  try {
    const { 
      id, 
      name, 
      description, 
      language, 
      gender, 
      provider, 
      capabilities, 
      sampleText 
    } = req.body;

    if (!id || !name) {
      return res.status(400).json({ 
        status: "error", 
        message: "ID and name are required" 
      });
    }

    // Check if voice ID already exists
    const existingVoice = await Voice.findOne({ id });
    if (existingVoice) {
      return res.status(400).json({ 
        status: "error", 
        message: "Voice ID already exists" 
      });
    }

    const voice = new Voice({
      id,
      name,
      description,
      language: language || "en-US",
      gender: gender || "neutral",
      provider: provider || "openai",
      capabilities: capabilities || {
        realtime: true,
        streaming: true,
        bargeIn: true
      },
      sampleText: sampleText || "Hello, this is a voice preview sample.",
      createdBy: req.user?.id || "admin"
    });

    await voice.save();

    res.status(201).json({
      status: "success",
      message: "Voice created successfully",
      voice
    });
  } catch (err) {
    console.error("Error creating voice:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Update voice
export const updateVoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      language, 
      gender, 
      capabilities, 
      sampleText, 
      isActive 
    } = req.body;

    const voice = await Voice.findOne({ id });
    if (!voice) {
      return res.status(404).json({ 
        status: "error", 
        message: "Voice not found" 
      });
    }

    // Update fields
    if (name) voice.name = name;
    if (description !== undefined) voice.description = description;
    if (language) voice.language = language;
    if (gender) voice.gender = gender;
    if (capabilities) voice.capabilities = { ...voice.capabilities, ...capabilities };
    if (sampleText) voice.sampleText = sampleText;
    if (isActive !== undefined) voice.isActive = isActive;

    await voice.save();

    res.json({
      status: "success",
      message: "Voice updated successfully",
      voice
    });
  } catch (err) {
    console.error("Error updating voice:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Delete voice
export const deleteVoice = async (req, res) => {
  try {
    const { id } = req.params;
    const voice = await Voice.findOne({ id });
    
    if (!voice) {
      return res.status(404).json({ 
        status: "error", 
        message: "Voice not found" 
      });
    }

    // Check if voice is default for its language
    if (voice.isDefault) {
      return res.status(400).json({ 
        status: "error", 
        message: "Cannot delete default voice. Set another voice as default first." 
      });
    }

    await Voice.findOneAndDelete({ id });

    res.json({
      status: "success",
      message: "Voice deleted successfully"
    });
  } catch (err) {
    console.error("Error deleting voice:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Preview voice using discovered voices
export const previewVoice = async (req, res) => {
  try {
    const { voiceId, text } = req.body;
    
    if (!voiceId) {
      return res.status(400).json({ 
        status: "error", 
        message: "Voice ID is required" 
      });
    }

    // Import voice discovery service
    const voiceDiscoveryService = (await import('../services/voiceDiscoveryService.js')).default;
    
    const voice = voiceDiscoveryService.getVoice(voiceId);
    if (!voice) {
      return res.status(404).json({ 
        status: "error", 
        message: "Voice not found" 
      });
    }

    // This would typically call OpenAI's TTS API or similar
    // For now, return a mock audio response
    const mockAudioData = {
      voiceId,
      text: text || voice.sampleText,
      audioUrl: `https://api.openai.com/v1/audio/speech/preview/${voiceId}`,
      duration: 2.5,
      format: "mp3",
      voice: {
        name: voice.name,
        language: voice.language,
        gender: voice.gender
      }
    };

    res.json({
      status: "success",
      preview: mockAudioData
    });
  } catch (err) {
    console.error("Error previewing voice:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Set default voice
export const setDefaultVoice = async (req, res) => {
  try {
    const { id } = req.params;
    const voice = await Voice.findOne({ id });
    
    if (!voice) {
      return res.status(404).json({ 
        status: "error", 
        message: "Voice not found" 
      });
    }

    // Remove default from other voices in the same language
    await Voice.updateMany(
      { language: voice.language, isDefault: true },
      { isDefault: false }
    );

    // Set this voice as default
    voice.isDefault = true;
    await voice.save();

    res.json({
      status: "success",
      message: "Default voice updated successfully",
      voice
    });
  } catch (err) {
    console.error("Error setting default voice:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};
