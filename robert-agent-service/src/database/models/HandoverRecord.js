import mongoose from "mongoose";

const HandoverRecordSchema = new mongoose.Schema({
  callSid: {
    type: String,
    required: true,
    index: true
  },
  originalCallerId: {
    type: String,
    required: true
  },
  targetNumber: {
    type: String,
    required: true,
    default: '+442036918807'
  },
  agentCallSid: {
    type: String,
    default: null
  },
  handoverSummary: {
    type: String,
    required: true
  },
  conferenceName: {
    type: String,
    default: null
  },
  kbaMethod: {
    type: String,
    default: null
  },
  actionsTaken: {
    type: String,
    default: ''
  },
  desiredOutcome: {
    type: String,
    default: null
  },
  handoverStatus: {
    type: String,
    enum: ['initiated', 'agent_answered', 'bridged', 'completed', 'failed'],
    default: 'initiated'
  },
  bridgedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  fallbackReason: {
    type: String,
    default: null
  },
  dtmfSent: {
    type: Boolean,
    default: false
  },
  dtmfDigits: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for performance
HandoverRecordSchema.index({ callSid: 1, createdAt: -1 });
HandoverRecordSchema.index({ handoverStatus: 1 });

export default mongoose.model("HandoverRecord", HandoverRecordSchema);

