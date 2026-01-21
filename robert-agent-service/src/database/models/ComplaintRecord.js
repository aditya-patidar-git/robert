import mongoose from "mongoose";

const complaintRecordSchema = new mongoose.Schema({
  callId: { 
    type: String, 
    required: true, 
    index: true 
  },
  callSid: { 
    type: String, 
    required: true, 
    index: true 
  },
  callerId: { 
    type: String, 
    required: true 
  },
  complaintText: { 
    type: String, 
    required: true 
  },
  complaintType: {
    type: String,
    enum: [
      'service_quality',
      'ai_understanding',
      'response_time',
      'technical_issue',
      'billing',
      'booking',
      'instructor_conduct',
      'safety_concern',
      'discrimination',
      'legal',
      'media',
      'other'
    ],
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'investigating', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  assignedTo: String, // Manager email
  complaintEmail: { 
    type: String, 
    default: 'complaints@universalmct.co.uk'
  },
  referenceId: {
    type: String,
    index: true
  },
  submittedAt: { 
    type: Date, 
    default: Date.now 
  },
  resolvedAt: Date,
  resolution: String,
  followUpRequired: { 
    type: Boolean, 
    default: false 
  },
  followUpDate: Date,
  escalationRequired: { 
    type: Boolean, 
    default: false 
  },
  escalatedTo: String,
  escalatedAt: Date,
  // GDPR compliance
  dataRetentionUntil: Date,
  redacted: { 
    type: Boolean, 
    default: false 
  },
  redactedAt: Date,
  // Audit trail
  createdBy: String, // User ID or 'AI Agent'
  lastModifiedBy: String,
  modificationHistory: [{
    modifiedBy: String,
    modifiedAt: { 
      type: Date, 
      default: Date.now 
    },
    changes: String,
    reason: String
  }]
}, {
  timestamps: true
});

// Indexes for performance
complaintRecordSchema.index({ status: 1, priority: 1 });
complaintRecordSchema.index({ submittedAt: -1 });
complaintRecordSchema.index({ callerId: 1 });
complaintRecordSchema.index({ complaintType: 1 });
complaintRecordSchema.index({ referenceId: 1 }); // Index for fast lookup by reference ID

export default mongoose.model("ComplaintRecord", complaintRecordSchema);

