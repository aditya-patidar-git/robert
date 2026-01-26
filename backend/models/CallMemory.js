import mongoose from "mongoose";

const CallMemorySchema = new mongoose.Schema({
  callerId: {
    type: String,
    required: true,
    index: true
  },
  callSid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  summary: {
    purpose: {
      type: String,
      required: true
    },
    outcome: {
      type: String,
      enum: ['resolved', 'escalated', 'needs-follow-up', 'voicemail', 'error'],
      required: true
    },
    nextSteps: {
      type: String,
      default: ''
    }
  },
  keyFacts: [{
    type: String
  }],
  language: {
    type: String,
    default: 'en-GB'
  },
  consentGiven: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for performance (callerId, callSid, createdAt, expiresAt already have index: true in schema)
CallMemorySchema.index({ callerId: 1, createdAt: -1 }); // Compound index for caller history queries

export default mongoose.model("CallMemory", CallMemorySchema);

