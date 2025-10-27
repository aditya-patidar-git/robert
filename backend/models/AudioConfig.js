import mongoose from "mongoose";

const AudioConfigSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    default: "default"
  },
  // Voice Activity Detection Settings
  vadThreshold: { 
    type: Number, 
    default: 500,
    min: 100,
    max: 2000
  },
  startPadding: { 
    type: Number, 
    default: 250,
    min: 0,
    max: 1000
  },
  endPadding: { 
    type: Number, 
    default: 300,
    min: 0,
    max: 1500
  },
  bargeInPolicy: { 
    type: String,
    enum: ['pause', 'stop'],
    default: 'pause'
  },
  // Audio Quality Settings
  noiseSuppression: { 
    type: Boolean, 
    default: true
  },
  echoCancellation: { 
    type: Boolean, 
    default: true
  },
  audioQuality: { 
    type: String,
    enum: ['standard', 'high', 'premium'],
    default: 'high'
  },
  // Voice Settings
  defaultVoice: {
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
      default: "en-GB"
    }
  },
  // Model Parameters
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
  },
  // System Settings
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

export default mongoose.model("AudioConfig", AudioConfigSchema);









