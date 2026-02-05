import mongoose from "mongoose";

const TelephonyConfigSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    default: "default"
  },
  numbers: [{
    number: { 
      type: String, 
      required: true
    },
    route: { 
      type: String,
      enum: ['ai_agent', 'transfer', 'voicemail', 'after_hours'],
      default: 'ai_agent'
    },
    status: { 
      type: String,
      enum: ['active', 'inactive', 'maintenance'],
      default: 'active'
    },
    description: String,
    createdAt: { 
      type: Date, 
      default: Date.now 
    }
  }],
  outboundCallerId: { 
    type: String,
    required: true,
    default: "+442045726060"
  },
  transferNumbers: [{
    number: { 
      type: String, 
      required: true
    },
    name: String,
    department: String,
    isActive: { 
      type: Boolean, 
      default: true 
    }
  }],
  afterHoursPolicy: {
    enabled: { 
      type: Boolean, 
      default: true
    },
    startTime: { 
      type: String, 
      default: "18:00"
    },
    endTime: { 
      type: String, 
      default: "09:00"
    },
    timezone: { 
      type: String, 
      default: "Europe/London"
    },
    message: { 
      type: String,
      default: "Thank you for calling Universal Motorcycle Training. Our office hours are Monday to Friday, 9 AM to 6 PM. Please call back during business hours or leave a message."
    },
    action: { 
      type: String,
      enum: ['voicemail', 'transfer', 'ai_agent'],
      default: 'voicemail'
    }
  },
  voicemailSettings: {
    enabled: { 
      type: Boolean, 
      default: true
    },
    greeting: { 
      type: String,
      default: "Please leave your name, number, and a brief message after the tone."
    },
    maxDuration: { 
      type: Number, 
      default: 300
    },
    emailNotification: { 
      type: Boolean, 
      default: true
    },
    emailRecipients: [String]
  },
  sipSettings: {
    primaryPath: { 
      type: String,
      enum: ['sip', 'media_streams'],
      default: 'sip'
    },
    fallbackPath: { 
      type: String,
      enum: ['sip', 'media_streams'],
      default: 'media_streams'
    },
    codec: { 
      type: String,
      enum: ['opus', 'pcm', 'g722'],
      default: 'opus'
    },
    region: { 
      type: String,
      default: 'europe'
    }
  },
  recordingSettings: {
    enabled: { 
      type: Boolean, 
      default: true
    },
    consentRequired: { 
      type: Boolean, 
      default: true
    },
    consentMessage: { 
      type: String,
      default: "For training and quality, this call may be recorded and handled in line with our Privacy Policy."
    },
    retentionDays: { 
      type: Number, 
      default: 90
    },
    storageLocation: { 
      type: String,
      default: 'twilio'
    }
  },
  isActive: { 
    type: Boolean, 
    default: true
  },
  routingEnabled: {
    type: Boolean,
    default: true
  },
  // General System Settings
  maxConcurrentCalls: {
    type: Number,
    default: 50
  },
  callTimeout: {
    type: Number,
    default: 300
  },
  retryAttempts: {
    type: Number,
    default: 3
  },
  logLevel: {
    type: String,
    enum: ['debug', 'info', 'warn', 'error'],
    default: 'info'
  },
  createdBy: { 
    type: String, 
    default: "admin"
  }
}, { 
  timestamps: true 
});

export default mongoose.model("TelephonyConfig", TelephonyConfigSchema);

