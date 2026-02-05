// AI Configuration Defaults
export const AI_CONFIG_DEFAULTS = {
  temperature: 0.4,
  topP: 1.0,
  maxTokens: 150,
  speechRate: 1.0,
  defaultModel: 'gpt-realtime',
  defaultVoice: { 
    id: 'ash', 
    name: 'Ash', 
    language: 'en-GB' 
  }
};

// Audio Configuration Defaults
export const AUDIO_CONFIG_DEFAULTS = {
  vadThreshold: 500,
  startPadding: 250,
  endPadding: 300,
  bargeInPolicy: 'pause',
  noiseSuppression: true,
  noiseSuppressionAlgorithm: 'basic',
  echoCancellation: true,
  automaticGainControl: false,
  audioQuality: 'high',
  energyThreshold: null, // null = auto-calibrate
  energyThresholdAutoCalibrate: true
};

// Telephony Configuration Defaults
export const TELEPHONY_CONFIG_DEFAULTS = {
  outboundCallerId: '+442045726060',
  afterHoursPolicy: {
    enabled: true,
    startTime: '18:00',
    endTime: '09:00',
    timezone: 'Europe/London',
    message: 'Thank you for calling Universal Motorcycle Training. Our office hours are Monday to Friday, 9 AM to 6 PM. Please call back during business hours or leave a message.',
    action: 'voicemail'
  },
  voicemailSettings: {
    enabled: true,
    greeting: 'Please leave your name, number, and a brief message after the tone.',
    maxDuration: 300,
    emailNotification: true,
    emailRecipients: []
  },
  sipSettings: {
    primaryPath: 'sip',
    fallbackPath: 'media_streams',
    codec: 'opus',
    region: 'europe'
  }
};

// Privacy Configuration Defaults
export const PRIVACY_CONFIG_DEFAULTS = {
  transcriptRetention: 90,
  recordingRetention: 90,
  metadataRetention: 90
};

// Query Refresh Intervals (in milliseconds)
export const QUERY_INTERVALS = {
  MODEL_CAPABILITIES: 300000, // 5 minutes
  AI_MODELS: 300000, // 5 minutes
  SYSTEM_METRICS: 30000, // 30 seconds
  MCP_TOOLS: 300000, // 5 minutes
  LANGUAGE_VOICE_MAPPINGS: 300000 // 5 minutes
};

// Model Parameter Ranges
export const MODEL_PARAMETER_RANGES = {
  temperature: { min: 0, max: 1, step: 0.1, default: 0.4 },
  topP: { min: 0, max: 1, step: 0.1, default: 1.0 },
  maxTokens: { min: 50, max: 500, step: 10, default: 150 },
  speechRate: { min: 0.5, max: 2.0, step: 0.1, default: 1.0 }
};

// Audio Parameter Ranges
export const AUDIO_PARAMETER_RANGES = {
  vadThreshold: { min: 100, max: 2000, step: 50, default: 500 },
  startPadding: { min: 0, max: 1000, step: 50, default: 250 },
  endPadding: { min: 0, max: 1500, step: 50, default: 300 },
  energyThreshold: { min: 0, max: 100, step: 5, default: 50 }
};

// MCP Tools Defaults
export const MCP_TOOLS_DEFAULTS = {
  globalRateLimit: 100,
  defaultRateLimit: 100,
  minRateLimit: 1,
  maxRateLimit: 1000
};

// CRM Tasks Defaults
export const CRM_TASKS_DEFAULTS = {
  createBooking: { enabled: true, requireConfirmation: true },
  cancel: { enabled: true, requireConfirmation: true },
  updateRecord: { enabled: true, requireConfirmation: false },
  issueRefund: { enabled: false, requireConfirmation: true },
  dryRunEnforced: true,
  auditLogging: true
};

