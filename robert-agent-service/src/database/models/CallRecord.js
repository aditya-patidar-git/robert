import mongoose from "mongoose";

const callRecordSchema = new mongoose.Schema({
  callSid: { type: String, unique: true }, // unique: true already creates an index, no need for index: true
  from: String,
  to: String,
  callStatus: {
    type: String,
    enum: [
      'queued',
      'ringing',
      'in-progress',
      'completed',
      'busy',
      'failed',
      'no-answer',
      'canceled'
    ],
    default: 'queued',
    index: true
  },
  transcript: [
    {
      role: { type: String, enum: ["user", "agent"], required: true },
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      confidence: { type: Number, min: 0, max: 1 },
      redactions: [{ type: String }]
    }
  ],
  recordingUrl: String,
  summary: String,
  entryPath: { 
    type: String, 
    enum: ['SIP', 'Streams'], 
    default: 'SIP' 
  },
  result: { 
    type: String, 
    enum: ['resolved', 'escalated', 'voicemail', 'error'],
    default: 'resolved'
  },
  confidenceScores: {
    overall: { type: Number, min: 0, max: 1 },
    transcription: { type: Number, min: 0, max: 1 },
    understanding: { type: Number, min: 0, max: 1 }
  },
  toolTraceId: String,
  provenance: [{
    fileId: String,
    fileName: String,
    similarityScore: Number,
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  escalation: {
    escalated: { type: Boolean, default: false },
    reason: String,
    targetNumber: String,
    handoverSummary: String,
    escalatedAt: Date,
    resolvedAt: Date
  },
  complaint: {
    hasComplaint: { type: Boolean, default: false },
    complaintText: String,
    complaintEmail: String,
    complaintStatus: { 
      type: String, 
      enum: ['open', 'investigating', 'resolved', 'closed'],
      default: 'open'
    },
    complaintSubmittedAt: Date,
    complaintResolvedAt: Date
  },
  language: { type: String, default: 'en-GB' },
  duration: Number,
  piiDetected: {
    phone: [String],
    email: [String],
    creditCard: [String],
    postcode: [String],
    nationalInsurance: [String],
    drivingLicense: [String]
  },
  gdprCompliant: { type: Boolean, default: true },
  consentRecorded: {
    recording: { type: Boolean, default: false },
    processing: { type: Boolean, default: false },
    timestamp: Date
  },
  recordingConsent: {
    requested: { type: Boolean, default: false },
    given: { type: Boolean, default: null }, // null = not yet responded, true = consented, false = declined
    requestedAt: { type: Date, default: null },
    respondedAt: { type: Date, default: null },
    optOutReason: { type: String, default: null }
  },
  metrics: {
    aiResponseTime: Number,
    toolExecutionTime: Number,
    totalTokens: Number,
    maxTokensUsed: Number,
    truncationCount: Number,
    averageTokensPerMessage: Number,
    contextOptimizationApplied: Boolean,
    errorCount: Number
  },
  audioQuality: {
    latency: Number,
    jitter: Number,
    packetLoss: Number,
    mosScore: Number,
    callQuality: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor'],
      default: 'good'
    },
    measuredAt: { type: Date, default: Date.now }
  },
  toolsUsed: [{
    toolName: String,
    executionTime: Number,
    success: Boolean,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

callRecordSchema.index({ createdAt: -1 });
callRecordSchema.index({ from: 1 });
callRecordSchema.index({ result: 1 });
// callStatus already has index: true in field definition, no need to duplicate
callRecordSchema.index({ 'escalation.escalated': 1 });
callRecordSchema.index({ 'complaint.hasComplaint': 1 });
callRecordSchema.index({ 'audioQuality.measuredAt': -1 });
callRecordSchema.index({ 'audioQuality.callQuality': 1 });

export default mongoose.models.CallRecord || mongoose.model("CallRecord", callRecordSchema);

