import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['critical', 'warning', 'info'],
    default: 'warning',
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved'],
    default: 'active',
    index: true
  },
  component: {
    type: String,
    default: 'system',
    index: true
  },
  callerId: {
    type: String,
    index: true
  },
  reason: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  acknowledgedAt: {
    type: Date
  },
  acknowledgedBy: {
    type: String
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: String
  },
  source: {
    type: String,
    enum: ['agent-service', 'backend-service', 'system'],
    default: 'system',
    index: true
  }
}, {
  timestamps: true
});

// Indexes for performance
alertSchema.index({ createdAt: -1 });
alertSchema.index({ status: 1, severity: 1 });
alertSchema.index({ component: 1, status: 1 });
alertSchema.index({ source: 1, createdAt: -1 });

export default mongoose.models.Alert || mongoose.model('Alert', alertSchema);

