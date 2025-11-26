import mongoose from "mongoose";

const AIConfigSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    default: "default"
  },
  globalPrompt: { 
    type: String, 
    required: true
  },
  parameters: {
    temperature: { 
      type: Number, 
      default: 0.4,
      min: 0,
      max: 1
    },
    topP: { 
      type: Number, 
      default: 1.0,
      min: 0,
      max: 1
    },
    maxTokens: { 
      type: Number, 
      default: 150,
      min: 50,
      max: 500
    },
    speechRate: { 
      type: Number, 
      default: 1.0,
      min: 0.5,
      max: 2.0
    }
  },
  model: {
    id: { 
      type: String, 
      required: true,
      default: "gpt-realtime"
    },
    name: { 
      type: String, 
      required: true,
      default: "GPT Realtime"
    },
    fallbackChain: [{
      modelId: {
        type: String,
        required: true
      },
      voiceId: {
        type: String,
        required: true
      }
    }]
  },
  voice: {
    id: { 
      type: String, 
      required: true,
      default: "ash"
    },
    name: { 
      type: String, 
      required: true,
      default: "Ash"
    },
    language: { 
      type: String, 
      default: "en-US"
    }
  },
  uncertaintyGate: {
    enabled: { 
      type: Boolean, 
      default: true
    },
    confidenceThreshold: { 
      type: Number, 
      default: 0.8,
      min: 0,
      max: 1
    },
    minSources: { 
      type: Number, 
      default: 1,
      min: 1
    }
  },
  isActive: { 
    type: Boolean, 
    default: true
  },
  createdBy: { 
    type: String, 
    default: "admin"
  }
}, { 
  timestamps: true 
});

export default mongoose.model("AIConfig", AIConfigSchema);

