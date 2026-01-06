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

// Indexes for performance
CallMemorySchema.index({ callerId: 1, createdAt: -1 });
// expiresAt already has index: true in field definition, no need to duplicate

export default mongoose.models.CallMemory || mongoose.model("CallMemory", CallMemorySchema);

