import mongoose from "mongoose";

const ModelHistorySchema = new mongoose.Schema({
  modelId: { 
    type: String, 
    required: true,
    index: true
  },
  modelName: String,
  discoveredAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  capabilities: {
    contextLimit: Number,
    supportsTools: Boolean,
    supportsAudio: Boolean,
    supportsRealtime: Boolean,
    supportsFileSearch: Boolean,
    supportsMultimodal: Boolean
  },
  status: { 
    type: String, 
    enum: ['available', 'deprecated', 'removed'], 
    default: 'available',
    index: true
  },
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    changedAt: { type: Date, default: Date.now }
  }],
  lastSeen: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  timestamps: true 
});

// Index for efficient queries
ModelHistorySchema.index({ modelId: 1, discoveredAt: -1 });
ModelHistorySchema.index({ status: 1, lastSeen: -1 });

export default mongoose.model("ModelHistory", ModelHistorySchema);

