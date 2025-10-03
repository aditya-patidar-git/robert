import mongoose from "mongoose";

const callRecordSchema = new mongoose.Schema({
  callSid: { type: String, index: true, unique: true },
  from: String,
  to: String,
  transcript: [
    {
      role: { type: String, enum: ["user", "agent"], required: true },
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      confidence: { type: Number, min: 0, max: 1 },
      redactions: [{ type: String }] // PII redaction markers
    }
  ],
  recordingUrl: String,
  summary: String,
  // Enhanced fields per documentation requirements
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
  duration: Number, // in seconds
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes for performance
callRecordSchema.index({ createdAt: -1 });
callRecordSchema.index({ from: 1 });
callRecordSchema.index({ result: 1 });
callRecordSchema.index({ 'escalation.escalated': 1 });
callRecordSchema.index({ 'complaint.hasComplaint': 1 });

export default mongoose.model("CallRecord", callRecordSchema);
