import mongoose from "mongoose";

const unansweredQuestionSchema = new mongoose.Schema({
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
  question: { 
    type: String, 
    required: true,
    trim: true
  },
  context: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'answered', 'dismissed'],
    default: 'pending',
    index: true
  },
  answer: {
    type: String,
    trim: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  failureReason: {
    type: String,
    enum: [
      'uncertainty_gate_failed',
      'file_search_failed',
      'web_search_failed',
      'both_searches_failed',
      'low_confidence',
      'no_results',
      'user_transfer_request'
    ]
  },
  searchResults: {
    fileSearchResults: Number,
    webSearchResults: Number,
    fileSearchConfidence: Number,
    webSearchConfidence: Number
  },
  answeredBy: String,
  answeredAt: Date,
  addedToKnowledgeBase: {
    type: Boolean,
    default: false
  },
  knowledgeBaseFileId: String,
  tags: [{
    type: String,
    trim: true
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
    index: true
  },
  questionHash: {
    type: String,
    index: true
  },
  occurrenceCount: {
    type: Number,
    default: 1
  },
  lastOccurredAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
unansweredQuestionSchema.index({ status: 1, createdAt: -1 });
unansweredQuestionSchema.index({ callSid: 1 });
unansweredQuestionSchema.index({ questionHash: 1 });
unansweredQuestionSchema.index({ priority: 1, status: 1 });

export default mongoose.model("UnansweredQuestion", unansweredQuestionSchema);
