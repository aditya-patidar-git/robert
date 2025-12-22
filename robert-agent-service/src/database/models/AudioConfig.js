import mongoose from "mongoose";

const AudioConfigSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    default: "default"
  },
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
  noiseSuppression: { 
    type: Boolean, 
    default: true
  },
  noiseSuppressionAlgorithm: {
    type: String,
    enum: ['basic', 'rnnoise', 'webrtc'],
    default: 'basic'
  },
  echoCancellation: { 
    type: Boolean, 
    default: true
  },
  automaticGainControl: {
    type: Boolean,
    default: false
  },
  audioQuality: { 
    type: String,
    enum: ['standard', 'high', 'premium'],
    default: 'high'
  },
  energyThreshold: {
    type: Number,
    default: null,
    min: 0,
    max: 100
  },
  energyThresholdAutoCalibrate: {
    type: Boolean,
    default: true
  },
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
  selectedModelId: {
    type: String,
    default: null
  },
  // Transcription Model Selection
  transcriptionModel: {
    type: String,
    enum: ['whisper-1', 'gpt-4o-transcribe'],
    default: 'whisper-1'
  },
  temperature: { 
    type: Number, 
    default: 0.4,
    min: 0,
    max: 2
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
  usePerNumberProfiles: {
    type: Boolean,
    default: false
  },
  perNumberProfiles: [{
    phoneNumber: {
      type: String,
      required: true
    },
    profileName: {
      type: String,
      default: 'Default'
    },
    vadThreshold: Number,
    startPadding: Number,
    endPadding: Number,
    bargeInPolicy: {
      type: String,
      enum: ['pause', 'stop']
    },
    noiseSuppression: Boolean,
    noiseSuppressionAlgorithm: {
      type: String,
      enum: ['basic', 'rnnoise', 'webrtc']
    },
    echoCancellation: Boolean,
    automaticGainControl: Boolean,
    audioQuality: {
      type: String,
      enum: ['standard', 'high', 'premium']
    },
    energyThreshold: Number,
    energyThresholdAutoCalibrate: Boolean,
    temperature: Number,
    topP: Number,
    maxTokens: Number,
    speechRate: Number,
    defaultVoice: {
      id: String,
      name: String,
      language: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
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

