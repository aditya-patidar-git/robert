import mongoose from "mongoose";

const escalationLogSchema = new mongoose.Schema({
  callId: { type: String, required: true, index: true },
  callSid: { type: String, required: true, index: true },
  from: { type: String, required: true }, // "AI Agent"
  to: { type: String, required: true }, // "Human Agent" or "Supervisor"
  reason: { 
    type: String, 
    required: true,
    enum: [
      'complex_query',
      'customer_complaint', 
      'technical_issue',
      'safety_concern',
      'discrimination',
      'legal_threat',
      'low_confidence',
      'user_request'
    ]
  },
  summary: { type: String, required: true },
  targetNumber: { type: String, default: '+442036918807' }, // From documentation
  handoverSummary: String,
  escalationStatus: { 
    type: String, 
    enum: ['initiated', 'in_progress', 'completed', 'failed'],
    default: 'initiated'
  },
  initiatedAt: { type: Date, default: Date.now },
  completedAt: Date,
  duration: Number, // seconds
  metadata: {
    confidenceScore: Number,
    uncertaintyGateTriggered: Boolean,
    kbSourcesUsed: [String],
    toolsAttempted: [String]
  }
}, {
  timestamps: true
});

// Indexes for performance
escalationLogSchema.index({ callId: 1, initiatedAt: -1 });
escalationLogSchema.index({ escalationStatus: 1 });
escalationLogSchema.index({ reason: 1 });

export default mongoose.model("EscalationLog", escalationLogSchema);





