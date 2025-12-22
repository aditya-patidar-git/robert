import mongoose from "mongoose";

const dsarRequestSchema = new mongoose.Schema({
    requestId: { 
        type: String, 
        unique: true, 
        required: true,
        index: true
    },
    requestorEmail: { 
        type: String, 
        required: true,
        index: true
    },
    requestorPhone: String,
    requestType: { 
        type: String,
        enum: ['export', 'delete', 'rectification'], 
        required: true,
        index: true
    },
    status: { 
        type: String,
        enum: ['pending', 'processing', 'completed', 'rejected'], 
        default: 'pending',
        index: true
    },
    userIdentifier: { 
        type: String, 
        required: true,
        index: true
    }, // phone or email
    verificationMethod: { 
        type: String,
        enum: ['email', 'phone', 'manual'] 
    },
    verificationCode: String,
    verifiedAt: Date,
    requestedAt: { 
        type: Date, 
        default: Date.now 
    },
    completedAt: Date,
    exportUrl: String, // S3 or secure download link
    exportExpiresAt: Date,
    notes: String,
    processedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }
}, { 
    timestamps: true 
});

// Compound indexes for efficient queries
dsarRequestSchema.index({ requestorEmail: 1, status: 1 });
dsarRequestSchema.index({ userIdentifier: 1, status: 1 });
dsarRequestSchema.index({ status: 1, requestedAt: -1 });
dsarRequestSchema.index({ exportExpiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired exports

export default mongoose.model("DSARRequest", dsarRequestSchema);

