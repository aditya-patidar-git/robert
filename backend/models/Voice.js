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
    default: "en-US"
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
    default: "Hello, this is a voice preview sample."
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





