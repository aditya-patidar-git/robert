import mongoose from "mongoose";

const callRecordSchema = new mongoose.Schema({
  callSid: { type: String, index: true, unique: true },
  from: String,
  to: String,
  transcript: [
    {
      role: { type: String, enum: ["user", "agent"], required: true },
      text: { type: String, required: true },
    }
  ],
  recordingUrl: String,
  summary: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("CallRecord", callRecordSchema);
