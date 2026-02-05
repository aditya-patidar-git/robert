import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
    actorId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: false, // Optional for system/GDPR events
        index: true
    },
    actorType: {
        type: String,
        enum: ['user', 'system', 'caller', 'agent'],
        default: 'user'
    },
    action: { 
        type: String, 
        required: true, 
        index: true
    },
    targetType: { 
        type: String, 
        enum: ['user', 'config', 'call', 'kb', 'allowlist', 'audit', 'gdpr', 'dsar', 'consent', 'breach', 'compliance', 'retention'], 
        index: true
    },
    targetId: { 
        type: String,
        index: true
    },
    ip: String,
    userAgent: String,
    diff: { 
        type: mongoose.Schema.Types.Mixed 
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    },
    // GDPR-specific fields
    eventType: {
        type: String,
        index: true
    },
    eventData: {
        type: mongoose.Schema.Types.Mixed
    },
    system: {
        type: String,
        default: 'robert-admin'
    }
}, { 
    timestamps: true 
});

// Compound indexes for efficient queries
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);

