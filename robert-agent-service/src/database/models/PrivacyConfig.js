import mongoose from "mongoose";

const PrivacyConfigSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    default: "default"
  },
  // Consent Script
  consentScript: {
    type: String,
    default: "For training and quality, this call may be recorded and handled in line with our Privacy Policy."
  },
  // Data Retention Settings
  retentionSettings: {
    transcriptRetention: {
      type: Number,
      default: 90, // days
      min: 7,
      max: 365
    },
    recordingRetention: {
      type: Number,
      default: 90, // days
      min: 7,
      max: 180
    },
    metadataRetention: {
      type: Number,
      default: 365, // days
      min: 30,
      max: 730
    }
  },
  // Consent Settings
  consentSettings: {
    optOutAllowed: {
      type: Boolean,
      default: true
    },
    optOutEmailRoute: {
      type: String,
      default: "complaints@universalmct.co.uk"
    },
    requireExplicitConsent: {
      type: Boolean,
      default: true
    }
  },
  // Recording Consent Settings
  recording: {
    requireExplicitConsent: {
      type: Boolean,
      default: true
    },
    continueWithoutRecording: {
      type: Boolean,
      default: true
    },
    optOutEmailRoute: {
      type: String,
      default: "complaints@universalmct.co.uk"
    }
  },
  transcriptRedaction: {
    maskPIIAtSave: { type: Boolean, default: false }
  },
  // Privacy Policy & Legal
  privacyPolicy: {
    url: {
      type: String,
      default: ""
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  // Lawful Basis for Processing
  lawfulBasis: {
    consent: {
      type: Boolean,
      default: true
    },
    legitimateInterest: {
      type: Boolean,
      default: true
    },
    contract: {
      type: Boolean,
      default: false
    },
    legalObligation: {
      type: Boolean,
      default: false
    },
    vitalInterests: {
      type: Boolean,
      default: false
    },
    publicTask: {
      type: Boolean,
      default: false
    }
  },
  // UK GDPR Compliance
  ukGdprCompliance: {
    dataProtectionOfficer: {
      name: String,
      email: String
    },
    icoRegistrationNumber: String,
    dataProcessingLocation: {
      type: String,
      default: "UK"
    }
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

export default mongoose.models.PrivacyConfig || mongoose.model("PrivacyConfig", PrivacyConfigSchema);

