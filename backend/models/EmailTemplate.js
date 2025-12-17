import mongoose from "mongoose";
import BaseTemplateSchema from "./BaseTemplate.js";

/**
 * Email Template Schema
 * Extends BaseTemplate with email-specific fields
 */
const EmailTemplateSchema = new mongoose.Schema({
  subject: { 
    type: String, 
    required: true 
  },
  body: { 
    type: String, 
    required: true 
  } // HTML or plain text
});

// Combine with base schema
const FullEmailTemplateSchema = new mongoose.Schema({
  ...BaseTemplateSchema.obj,
  ...EmailTemplateSchema.obj
}, { 
  timestamps: true 
});

export default mongoose.model("EmailTemplate", FullEmailTemplateSchema);

