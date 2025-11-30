import mongoose from "mongoose";

const KBASessionSchema = new mongoose.Schema({
  callSid: {
    type: String,
    required: true,
    index: true
  },
  callerId: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  postcode: {
    type: String,
    required: true
  },
  bookingReference: {
    type: String,
    default: null
  },
  otpCode: {
    type: String, // Hashed OTP code
    default: null
  },
  otpSentAt: {
    type: Date,
    default: null
  },
  otpVerified: {
    type: Boolean,
    default: false
  },
  otpVerifiedAt: {
    type: Date,
    default: null
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'verified_with_otp', 'failed'],
    default: 'pending'
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for performance
KBASessionSchema.index({ callSid: 1, createdAt: -1 });
KBASessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for automatic deletion

export default mongoose.model("KBASession", KBASessionSchema);

