import mongoose from "mongoose";

const ToolConfigSchema = new mongoose.Schema({
  toolName: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  description: {
    type: String,
    default: ""
  },
  enabled: {
    type: Boolean,
    default: true,
    index: true
  },
  rateLimit: {
    limit: {
      type: Number,
      default: 100,
      min: 1,
      max: 1000
    },
    windowMs: {
      type: Number,
      default: 60000, // 1 minute
      min: 1000
    }
  },
  domains: [{
    type: String,
    trim: true
  }],
  maxTime: {
    type: Number,
    default: null, // null means no limit
    min: 1000
  },
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: {
    type: Date,
    default: null
  },
  updatedBy: {
    type: String,
    default: "admin"
  }
}, {
  timestamps: true
});

// Index for faster queries
ToolConfigSchema.index({ enabled: 1, toolName: 1 });
ToolConfigSchema.index({ updatedAt: -1 });

export default mongoose.models.ToolConfig || mongoose.model("ToolConfig", ToolConfigSchema);

