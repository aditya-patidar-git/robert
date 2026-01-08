import mongoose from "mongoose";

const FlowParameterOverrideSchema = new mongoose.Schema({
  flowType: {
    type: String,
    required: true,
    enum: ['information', 'booking', 'complaint', 'human_transfer', 'default'],
    unique: true,
    index: true
  },
  enabled: {
    type: Boolean,
    default: true,
    index: true
  },
  parameters: {
    temperature: {
      type: Number,
      min: 0,
      max: 2
    },
    topP: {
      type: Number,
      min: 0,
      max: 1
    },
    maxTokens: {
      type: Number,
      min: 1
    }
  },
  model: {
    id: {
      type: String,
      default: null
    },
    name: {
      type: String,
      default: null
    }
  },
  priority: {
    type: Number,
    default: 0,
    index: true
  },
  conditions: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
FlowParameterOverrideSchema.index({ flowType: 1, enabled: 1 });
FlowParameterOverrideSchema.index({ priority: -1, enabled: 1 });

export default mongoose.model("FlowParameterOverride", FlowParameterOverrideSchema);

