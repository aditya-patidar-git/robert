import mongoose from "mongoose";

const VoiceSchema = new mongoose.Schema({
  id: { 
    type: String, 
    required: true,
    unique: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  },
  language: { 
    type: String, 
    required: true,
    default: "en-GB"
  },
  gender: { 
    type: String,
    enum: ['male', 'female', 'neutral'],
    default: 'neutral'
  },
  provider: { 
    type: String, 
    required: true,
    default: "openai"
  },
  isDefault: { 
    type: Boolean, 
    default: false
  },
  isActive: { 
    type: Boolean, 
    default: true
  },
  capabilities: {
    realtime: { 
      type: Boolean, 
      default: true
    },
    streaming: { 
      type: Boolean, 
      default: true
    },
    bargeIn: { 
      type: Boolean, 
      default: true
    }
  },
  sampleText: { 
    type: String,
    default: "Good afternoon! This is Robert from Universal Motorcycle Training. I'd like to help you with your motorcycle training needs. We offer comprehensive courses covering everything from basic handling to advanced techniques. Our schedule is flexible, and we can arrange lessons at your convenience. Would you like to book a lesson or perhaps enquire about our available courses? Please feel free to ask me any questions you might have."
  },
  createdBy: { 
    type: String, 
    default: "admin"
  }
}, { 
  timestamps: true 
});

// Ensure only one default voice per language
VoiceSchema.index({ language: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

export default mongoose.model("Voice", VoiceSchema);





