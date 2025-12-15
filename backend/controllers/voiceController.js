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
    const { voiceId, text, modelId, translateTo } = req.body;
    
    console.log('🔵 [VOICE_PREVIEW] Preview request:', { voiceId, text: text?.substring(0, 50), modelId, translateTo });
    
    if (!voiceId) {
      return res.status(400).json({ 
        status: "error", 
        message: "Voice ID is required" 
      });
    }

    // Import services
    const voiceDiscoveryService = (await import('../services/voiceDiscoveryService.js')).default;
    const audioStorageService = (await import('../services/audioStorageService.js')).default;
    
    // Get voice information
    const voice = voiceDiscoveryService.getVoice(voiceId);
    if (!voice) {
      return res.status(404).json({ 
        status: "error", 
        message: "Voice not found" 
      });
    }

    // Get primary model ID if not provided
    let primaryModelId = modelId;
    if (!primaryModelId) {
      try {
        const AudioConfig = (await import('../models/AudioConfig.js')).default;
        const audioConfig = await AudioConfig.findOne({ name: 'default', isActive: true });
        if (audioConfig?.selectedModelId) {
          primaryModelId = audioConfig.selectedModelId;
          console.log('🔵 [VOICE_PREVIEW] Using primary model from config:', primaryModelId);
        }
      } catch (configError) {
        console.warn('⚠️ [VOICE_PREVIEW] Could not fetch primary model from config:', configError.message);
      }
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        status: "error", 
        message: "OpenAI API key not configured" 
      });
    }

    // Import OpenAI
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    let previewText = text || voice.sampleText || 'Hello, this is a voice preview.';
    
    // Translate text if translateTo is provided and different from English
    if (translateTo) {
      const translateToLower = String(translateTo).toLowerCase().trim();
      const baseLang = translateToLower.split('-')[0];
      
      // Check if it's not English (en, en-us, en-gb)
      if (baseLang !== 'en') {
        try {
          // Translate the text using OpenAI
          const translationResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are a professional translator. Translate the following English text to ${baseLang}. Return only the translation, no explanations, no additional text.`
              },
              {
                role: 'user',
                content: previewText
              }
            ],
            temperature: 0.3,
            max_tokens: 200
          });
          
          const translatedText = translationResponse.choices[0]?.message?.content?.trim();
          if (translatedText && translatedText.length > 0) {
            previewText = translatedText;
          } else {
            console.warn('⚠️ [VOICE_PREVIEW] Translation returned empty, using original text');
          }
        } catch (translationError) {
          console.error('🔴 [VOICE_PREVIEW] Translation failed:', translationError.message);
          // Fallback to original text if translation fails
        }
      }
    }
    
    console.log(`🔵 [VOICE_PREVIEW] Generating TTS for voice: ${voiceId}, model: ${primaryModelId || 'default'}, text: ${previewText.substring(0, 50)}...`);

    try {
      // Determine TTS model based on primary model
      // For realtime models, use tts-1-hd for better quality
      // For other models, use tts-1
      let ttsModel = 'tts-1';
      if (primaryModelId && primaryModelId.includes('realtime')) {
        ttsModel = 'tts-1-hd';
        console.log('🔵 [VOICE_PREVIEW] Using HD TTS model for realtime model');
      }

      // Map voice ID to OpenAI voice name
      // OpenAI supports: alloy, echo, fable, onyx, nova, shimmer, ash, ballads, coral, sage, verse
      // Our voice IDs might be different, so we need to map them
      const voiceMapping = {
        'ash': 'ash',
        'cedar': 'onyx',
        'marin': 'nova',
        'nova': 'nova',
        'alloy': 'alloy',
        'echo': 'echo',
        'fable': 'fable',
        'onyx': 'onyx',
        'shimmer': 'shimmer',
        'ballads': 'ballads',
        'coral': 'coral',
        'sage': 'sage',
        'verse': 'verse'
      };
      
      const openaiVoice = voiceMapping[voiceId.toLowerCase()] || 'ash';
      console.log(`🔵 [VOICE_PREVIEW] Mapped voice ${voiceId} to OpenAI voice: ${openaiVoice}`);

      // Call OpenAI TTS API
      const mp3 = await openai.audio.speech.create({
        model: ttsModel,
        voice: openaiVoice,
        input: previewText,
      });

      // Convert the response to a buffer
      const buffer = Buffer.from(await mp3.arrayBuffer());
      
      console.log(`✅ [VOICE_PREVIEW] TTS generated successfully, size: ${buffer.length} bytes`);

      // Save audio file
      const { filename, url } = await audioStorageService.saveAudio(buffer, voiceId, previewText);
      
      console.log(`✅ [VOICE_PREVIEW] Audio saved, URL: ${url}`);

      // Return preview data with URL
      const previewData = {
        voiceId,
        text: previewText,
        audioUrl: url,
        duration: Math.ceil(buffer.length / 16000), // Rough estimate: ~16KB per second for MP3
        format: "mp3",
        modelId: primaryModelId,
        ttsModel,
        voice: {
          name: voice.name,
          language: voice.language,
          gender: voice.gender
        }
      };

      res.json({
        status: "success",
        preview: previewData
      });
      
    } catch (ttsError) {
      console.error('🔴 [VOICE_PREVIEW] OpenAI TTS API error:', ttsError);
      console.error('🔴 [VOICE_PREVIEW] Error details:', {
        message: ttsError.message,
        status: ttsError.status,
        code: ttsError.code
      });
      
      return res.status(500).json({ 
        status: "error", 
        message: `Failed to generate audio: ${ttsError.message}`,
        error: process.env.NODE_ENV === 'development' ? ttsError.stack : undefined
      });
    }
  } catch (err) {
    console.error("🔴 [VOICE_PREVIEW] Error previewing voice:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
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
