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
      language: language || "en-GB",
      gender: gender || "neutral",
      provider: provider || "openai",
      capabilities: capabilities || {
        realtime: true,
        streaming: true,
        bargeIn: true
      },
      sampleText: sampleText || "Good afternoon! This is Robert from Universal Motorcycle Training. I'd like to help you with your motorcycle training needs. We offer comprehensive courses covering everything from basic handling to advanced techniques. Our schedule is flexible, and we can arrange lessons at your convenience. Would you like to book a lesson or perhaps enquire about our available courses? Please feel free to ask me any questions you might have.",
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

    let previewText = text || voice.sampleText || 'Good afternoon! This is Robert from Universal Motorcycle Training. I\'d like to help you with your motorcycle training needs. We offer comprehensive courses covering everything from basic handling to advanced techniques. Our schedule is flexible, and we can arrange lessons at your convenience. Would you like to book a lesson or perhaps enquire about our available courses? Please feel free to ask me any questions you might have.';
    
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
    
    console.log(`🔵 [VOICE_PREVIEW] Generating audio preview for voice: ${voiceId}, model: ${primaryModelId || 'default'}, text: ${previewText.substring(0, 50)}...`);

    try {
      // Map voice ID to OpenAI voice name for Chat Completions API with audio
      // Chat Completions API supports: alloy, echo, fable, onyx, nova, shimmer, coral, verse, ballad, ash, sage, marin, cedar
      // Note: 'ballads' (plural) must be 'ballad' (singular) for Chat Completions API
      // Note: 'marin' and 'cedar' are supported directly in Chat Completions API
      const voiceMapping = {
        'ash': 'ash',
        'cedar': 'cedar',  // Direct support in Chat Completions API
        'marin': 'marin',  // Direct support in Chat Completions API
        'nova': 'nova',
        'alloy': 'alloy',
        'echo': 'echo',
        'fable': 'fable',
        'onyx': 'onyx',
        'shimmer': 'shimmer',
        'ballads': 'ballad',  // Must be singular 'ballad' for Chat Completions API
        'coral': 'coral',
        'sage': 'sage',
        'verse': 'verse'
      };
      
      const openaiVoice = voiceMapping[voiceId.toLowerCase()] || 'ash';
      console.log(`🔵 [VOICE_PREVIEW] Mapped voice ${voiceId} to OpenAI voice: ${openaiVoice}`);
      console.log(`🔵 [VOICE_PREVIEW] Voice language from discovery service: ${voice.language}`);
      console.log(`🔵 [VOICE_PREVIEW] translateTo parameter: ${translateTo}`);

      // Determine system instructions based on language for accent control
      // Priority: translateTo parameter (for Language/Voice Mapping previews) > voice.language (from database)
      // Use very explicit and strong instructions for accent control
      let systemInstructions = 'You are a helpful assistant that can generate audio from text. Speak clearly and naturally.';
      
      // Determine which language code to use for accent control
      let accentLanguage = null;
      if (translateTo) {
        const translateToLower = String(translateTo).toLowerCase().trim();
        if (translateToLower === 'en-gb') {
          accentLanguage = 'en-GB';
        } else if (translateToLower === 'en-us') {
          accentLanguage = 'en-US';
        }
      }
      
      // Fall back to voice.language if translateTo doesn't specify an English variant
      if (!accentLanguage) {
        if (voice.language === 'en-GB' || voice.language?.toLowerCase() === 'en-gb') {
          accentLanguage = 'en-GB';
        } else if (voice.language === 'en-US' || voice.language?.toLowerCase() === 'en-us') {
          accentLanguage = 'en-US';
        }
      }

      if (accentLanguage === 'en-GB') {
        systemInstructions = 'You are a helpful assistant that can generate audio from text. CRITICAL: You MUST speak with a clear, authentic British English accent. Use British pronunciation patterns, British intonation, and British speech rhythm. Pronounce words like a native British English speaker from England. Enunciate clearly with British English phonetics. This is essential - the accent must be distinctly British, not American.';
        console.log('🔵 [VOICE_PREVIEW] Using STRONG British English accent instructions (from ' + (translateTo ? 'translateTo parameter' : 'voice.language') + ')');
      } else if (accentLanguage === 'en-US') {
        systemInstructions = 'You are a helpful assistant that can generate audio from text. Speak in a clear American English accent with proper pronunciation.';
        console.log('🔵 [VOICE_PREVIEW] Using American English accent instructions (from ' + (translateTo ? 'translateTo parameter' : 'voice.language') + ')');
      } else {
        console.log(`⚠️ [VOICE_PREVIEW] Unknown language: ${accentLanguage || voice.language}, using default instructions`);
      }

      // Use Chat Completions API with audio output for accurate accent control
      // This matches what the realtime API uses and allows accent control via system instructions
      console.log('🔵 [VOICE_PREVIEW] Using Chat Completions API with audio output for accent-accurate preview');
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-audio-preview',
        modalities: ['text', 'audio'],
        audio: {
          voice: openaiVoice,
          format: 'mp3'
        },
        messages: [
          {
            role: 'system',
            content: systemInstructions
          },
          {
            role: 'user',
            content: previewText
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      // Extract audio data from response
      const audioData = completion.choices[0]?.message?.audio?.data;
      if (!audioData) {
        throw new Error('No audio data in Chat Completions response');
      }

      // Decode base64 audio to buffer
      const buffer = Buffer.from(audioData, 'base64');
      
      console.log(`✅ [VOICE_PREVIEW] Audio generated successfully, size: ${buffer.length} bytes`);

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
        audioModel: 'gpt-4o-audio-preview',
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
      
    } catch (audioError) {
      console.error('🔴 [VOICE_PREVIEW] OpenAI Chat Completions API error:', audioError);
      console.error('🔴 [VOICE_PREVIEW] Error details:', {
        message: audioError.message,
        status: audioError.status,
        code: audioError.code
      });
      
      return res.status(500).json({ 
        status: "error", 
        message: `Failed to generate audio: ${audioError.message}`,
        error: process.env.NODE_ENV === 'development' ? audioError.stack : undefined
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
