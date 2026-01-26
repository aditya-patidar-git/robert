import mongoose from "mongoose";

const ConversationContextSchema = new mongoose.Schema({
  callSid: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  modelId: {
    type: String,
    required: true
  },
  contextLimit: {
    type: Number,
    required: true
  },
  currentTokens: {
    type: Number,
    default: 0
  },
  messages: [{
    role: {
      type: String,
      enum: ['system', 'user', 'assistant', 'tool'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    priority: {
      type: Number,
      default: 5
    },
    tokenCount: {
      type: Number,
      default: 0
    },
    isSummary: {
      type: Boolean,
      default: false
    },
    originalMessageIds: [{
      type: String
    }],
    toolCalls: [{
      type: mongoose.Schema.Types.Mixed
    }],
    toolCallId: String
  }],
  summaries: [{
    originalRange: {
      start: { type: Number },
      end: { type: Number }
    },
    summary: {
      type: String,
      required: true
    },
    tokenCount: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  truncationHistory: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    tokensBefore: {
      type: Number,
      required: true
    },
    tokensAfter: {
      type: Number,
      required: true
    },
    messagesRemoved: {
      type: Number,
      default: 0
    },
    strategy: {
      type: String,
      enum: ['none', 'priority-based', 'truncation-with-summarization', 'aggressive'],
      default: 'priority-based'
    }
  }]
}, {
  timestamps: true
});

// Indexes for performance (callSid already has index: true in schema)
ConversationContextSchema.index({ createdAt: -1 });
ConversationContextSchema.index({ modelId: 1 });

export default mongoose.models.ConversationContext || mongoose.model("ConversationContext", ConversationContextSchema);

