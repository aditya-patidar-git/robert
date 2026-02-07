import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    role: { type: String, enum: ["owner", "admin"], default: "admin" },
    status: { type: String, enum: ["pending", "active", "suspended", "deleted"], default: "pending" },
    passwordHash: { type: String, required: true },
    mfaEnabled: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
}, { timestamps: true });

export default mongoose.model("User", userSchema);
