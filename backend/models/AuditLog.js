import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
    actorId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true
    },
    action: { 
        type: String, 
        required: true, 
        index: true
    },
    targetType: { 
        type: String, 
        enum: ['user', 'config', 'call', 'kb', 'allowlist', 'audit'], 
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

