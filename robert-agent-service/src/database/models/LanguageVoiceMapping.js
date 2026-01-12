import mongoose from "mongoose";

const LanguageVoiceMappingSchema = new mongoose.Schema({
  languageCode: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  languageName: { 
    type: String, 
    required: true,
    trim: true
  },
  localeCode: { 
    type: String, 
    required: true,
    trim: true
  },
  voiceId: { 
    type: String, 
    required: true,
    trim: true
  },
  voiceName: { 
    type: String,
    trim: true
  },
  openaiVoiceId: {
    type: String,
    trim: true,
    default: null // OpenAI voice ID (e.g., 'ash', 'sage', 'alloy', 'shimmer', 'verse', 'echo', 'coral', 'ballad', 'marin', 'cedar')
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { 
  timestamps: true 
});

// Initialize default mappings if collection is empty
LanguageVoiceMappingSchema.statics.initializeDefaults = async function() {
  const count = await this.countDocuments();
  if (count === 0) {
    // Import multilingualService dynamically to avoid circular dependencies
    const multilingualService = (await import('../../services/multilingualService.js')).default;
    const supportedLanguages = multilingualService.getSupportedLanguages();
    const defaultMappings = supportedLanguages.map(lang => ({
      languageCode: lang.code,
      languageName: lang.name,
      localeCode: lang.code,
      voiceId: lang.voice,
      voiceName: lang.voice,
      openaiVoiceId: lang.voice, // Use the voice from multilingualService
      isActive: true
    }));
    await this.insertMany(defaultMappings);
    console.log('✅ Initialized default language/voice mappings');
  }
};

const LanguageVoiceMapping = mongoose.model("LanguageVoiceMapping", LanguageVoiceMappingSchema);

// Initialize defaults on model load
LanguageVoiceMapping.initializeDefaults().catch(err => {
  console.error('Error initializing language/voice mappings:', err);
});

export default LanguageVoiceMapping;

