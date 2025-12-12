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

// Static method to initialize default tool configs
ToolConfigSchema.statics.initializeDefaults = async function() {
  const defaultTools = [
    {
      toolName: 'web_search',
      description: 'Search the web for time-sensitive information not in knowledge base',
      enabled: true,
      rateLimit: { limit: 100, windowMs: 60000 },
      domains: ['universalmct.co.uk', 'dvsa.gov.uk', 'gov.uk']
    },
    {
      toolName: 'calendar',
      description: 'Manage calendar events and availability',
      enabled: true,
      rateLimit: { limit: 50, windowMs: 60000 },
      domains: []
    },
    {
      toolName: 'email',
      description: 'Send and manage emails',
      enabled: true,
      rateLimit: { limit: 30, windowMs: 60000 },
      domains: []
    },
    {
      toolName: 'crm',
      description: 'Access CRM system for customer management',
      enabled: true,
      rateLimit: { limit: 20, windowMs: 60000 },
      domains: ['takeabyte.co.uk']
    },
    {
      toolName: 'crm_browser',
      description: 'Perform CRM tasks using browser automation',
      enabled: true,
      rateLimit: { limit: 10, windowMs: 60000 },
      domains: ['takeabyte.co.uk']
    },
    {
      toolName: 'payments',
      description: 'Process payments and refunds',
      enabled: true,
      rateLimit: { limit: 10, windowMs: 60000 },
      domains: []
    },
    {
      toolName: 'file_search',
      description: 'Search the knowledge base for relevant information',
      enabled: true,
      rateLimit: { limit: 100, windowMs: 60000 },
      domains: []
    },
    {
      toolName: 'transfer_call',
      description: 'Transfer call to human agent',
      enabled: true,
      rateLimit: { limit: 50, windowMs: 60000 },
      domains: []
    },
    {
      toolName: 'kba_verification',
      description: 'Verify caller identity using Knowledge-Based Authentication',
      enabled: true,
      rateLimit: { limit: 100, windowMs: 60000 },
      domains: []
    },
    {
      toolName: 'complaint_submission',
      description: 'Submit a formal complaint',
      enabled: true,
      rateLimit: { limit: 20, windowMs: 60000 },
      domains: []
    },
    {
      toolName: 'client_verification',
      description: 'Verify caller identity by comparing spoken details against CRM',
      enabled: true,
      rateLimit: { limit: 100, windowMs: 60000 },
      domains: []
    }
  ];

  for (const tool of defaultTools) {
    await this.findOneAndUpdate(
      { toolName: tool.toolName },
      tool,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
};

export default mongoose.models.ToolConfig || mongoose.model("ToolConfig", ToolConfigSchema);

