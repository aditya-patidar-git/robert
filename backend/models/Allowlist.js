import mongoose from "mongoose";

const allowlistSchema = new mongoose.Schema({
    type: { 
        type: String, 
        enum: ['email', 'domain', 'ip'], 
        required: true,
        index: true
    },
    value: { 
        type: String, 
        required: true, 
        index: true
    },
    notes: String,
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }
}, { 
    timestamps: true 
});

// Compound unique index so (type, value) is unique (same value can exist for different types)
allowlistSchema.index({ type: 1, value: 1 }, { unique: true });

export default mongoose.model("Allowlist", allowlistSchema);

