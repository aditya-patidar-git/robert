import mongoose from "mongoose";

const PromptSchema = new mongoose.Schema({
  title: { type: String, required: true },     // short name of prompt
  content: { type: String, required: true },   // actual text/instructions
  createdBy: { type: String, default: "admin" } // who created it
}, { timestamps: true });

export default mongoose.model("Prompt", PromptSchema);
