import mongoose from "mongoose";

const PromptVersionSchema = new mongoose.Schema({
  promptId: {
    type: String,
    required: true,
    default: 'global',
    index: true
  },
  version: {
    type: Number,
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  previousContent: {
    type: String,
    default: ''
  },
  createdBy: {
    type: String,
    required: true,
    default: 'admin'
  },
  changeReason: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: false,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
PromptVersionSchema.index({ promptId: 1, version: -1 });
PromptVersionSchema.index({ isActive: 1, promptId: 1 });

// Prevent duplicate versions
PromptVersionSchema.index({ promptId: 1, version: 1 }, { unique: true });

export default mongoose.model("PromptVersion", PromptVersionSchema);

