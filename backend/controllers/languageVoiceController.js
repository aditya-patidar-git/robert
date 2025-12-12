import LanguageVoiceMapping from "../models/LanguageVoiceMapping.js";
import voiceDiscoveryService from "../services/voiceDiscoveryService.js";

// Get all language/voice mappings
export const getLanguageMappings = async (req, res) => {
  try {
    console.log('🔍 [LANGUAGE-VOICE] getLanguageMappings endpoint called');
    
    // Ensure defaults are initialized
    await LanguageVoiceMapping.initializeDefaults();
    
    const mappings = await LanguageVoiceMapping.find().sort({ languageName: 1 });
    console.log(`📊 Found ${mappings.length} language/voice mappings in database`);
    
    if (mappings.length === 0) {
      console.warn('⚠️ No language/voice mappings found in database!');
      return res.json({
        status: "success",
        mappings: []
      });
    }
    
    // Enrich with voice names from discovery service
    const enrichedMappings = await Promise.all(
      mappings.map(async (mapping) => {
        try {
          const voice = voiceDiscoveryService.getVoice(mapping.voiceId);
          if (voice) {
            return {
              ...mapping.toObject(),
              voiceName: voice.name || mapping.voiceName
            };
          }
        } catch (err) {
          // Voice not found in discovery service, use stored name
        }
        return mapping.toObject();
      })
    );
    
    console.log(`✅ Returning ${enrichedMappings.length} language/voice mappings to frontend`);
    console.log(`📋 Language codes:`, enrichedMappings.map(m => m.languageCode).join(', '));
    
    res.json({
      status: "success",
      mappings: enrichedMappings
    });
  } catch (error) {
    console.error("❌ Error getting language mappings:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      status: "error",
      message: error.message || "Internal server error"
    });
  }
};

// Get specific language mapping
export const getLanguageMapping = async (req, res) => {
  try {
    const { languageCode } = req.params;
    
    let mapping = await LanguageVoiceMapping.findOne({ languageCode });
    
    // If not found, initialize defaults and try again
    if (!mapping) {
      await LanguageVoiceMapping.initializeDefaults();
      mapping = await LanguageVoiceMapping.findOne({ languageCode });
    }
    
    if (!mapping) {
      return res.status(404).json({
        status: "error",
        message: "Language mapping not found"
      });
    }
    
    // Enrich with voice name
    try {
      const voice = voiceDiscoveryService.getVoice(mapping.voiceId);
      if (voice) {
        mapping.voiceName = voice.name || mapping.voiceName;
      }
    } catch (err) {
      // Voice not found, use stored name
    }
    
    res.json({
      status: "success",
      mapping: mapping.toObject()
    });
  } catch (error) {
    console.error("Error getting language mapping:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Internal server error"
    });
  }
};

// Update language/voice mapping
export const updateLanguageMapping = async (req, res) => {
  try {
    const { languageCode } = req.params;
    const { voiceId, voiceName, isActive } = req.body;
    
    if (!voiceId) {
      return res.status(400).json({
        status: "error",
        message: "Voice ID is required"
      });
    }
    
    // Ensure defaults are initialized
    await LanguageVoiceMapping.initializeDefaults();
    
    let mapping = await LanguageVoiceMapping.findOne({ languageCode });
    
    if (!mapping) {
      return res.status(404).json({
        status: "error",
        message: "Language mapping not found"
      });
    }
    
    // Update voice ID
    mapping.voiceId = voiceId;
    
    // Update voice name from discovery service if available
    try {
      const voice = voiceDiscoveryService.getVoice(voiceId);
      if (voice) {
        mapping.voiceName = voice.name || voiceName || mapping.voiceName;
      } else if (voiceName) {
        mapping.voiceName = voiceName;
      }
    } catch (err) {
      if (voiceName) {
        mapping.voiceName = voiceName;
      }
    }
    
    // Update active status if provided
    if (isActive !== undefined) {
      mapping.isActive = isActive;
    }
    
    await mapping.save();
    
    res.json({
      status: "success",
      message: "Language mapping updated successfully",
      mapping: mapping.toObject()
    });
  } catch (error) {
    console.error("Error updating language mapping:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Internal server error"
    });
  }
};

// Bulk update language mappings
export const bulkUpdateLanguageMappings = async (req, res) => {
  try {
    const { mappings } = req.body;
    
    if (!Array.isArray(mappings)) {
      return res.status(400).json({
        status: "error",
        message: "Mappings must be an array"
      });
    }
    
    // Ensure defaults are initialized
    await LanguageVoiceMapping.initializeDefaults();
    
    const updatePromises = mappings.map(async ({ languageCode, voiceId, voiceName, isActive }) => {
      if (!languageCode || !voiceId) {
        return null;
      }
      
      const mapping = await LanguageVoiceMapping.findOne({ languageCode });
      if (!mapping) {
        return null;
      }
      
      mapping.voiceId = voiceId;
      
      // Update voice name from discovery service if available
      try {
        const voice = voiceDiscoveryService.getVoice(voiceId);
        if (voice) {
          mapping.voiceName = voice.name || voiceName || mapping.voiceName;
        } else if (voiceName) {
          mapping.voiceName = voiceName;
        }
      } catch (err) {
        if (voiceName) {
          mapping.voiceName = voiceName;
        }
      }
      
      if (isActive !== undefined) {
        mapping.isActive = isActive;
      }
      
      return mapping.save();
    });
    
    await Promise.all(updatePromises.filter(p => p !== null));
    
    res.json({
      status: "success",
      message: "Language mappings updated successfully"
    });
  } catch (error) {
    console.error("Error bulk updating language mappings:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Internal server error"
    });
  }
};

