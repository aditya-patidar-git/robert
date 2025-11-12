import mongoose from "mongoose";
import multilingualService from "../services/multilingualService.js";

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
    const supportedLanguages = multilingualService.getSupportedLanguages();
    const defaultMappings = supportedLanguages.map(lang => ({
      languageCode: lang.code,
      languageName: lang.name,
      localeCode: lang.code,
      voiceId: lang.voice,
      voiceName: lang.voice, // Will be updated when voices are discovered
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

