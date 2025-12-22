import mongoose from "mongoose";

const allowlistSchema = new mongoose.Schema({
    type: { 
        type: String, 
        enum: ['email', 'domain'], 
        required: true,
        index: true
    },
    value: { 
        type: String, 
        required: true, 
        unique: true,
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

// Compound index for efficient lookups
allowlistSchema.index({ type: 1, value: 1 });

export default mongoose.model("Allowlist", allowlistSchema);

