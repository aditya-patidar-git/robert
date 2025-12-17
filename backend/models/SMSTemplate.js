import mongoose from "mongoose";
import BaseTemplateSchema from "./BaseTemplate.js";

/**
 * SMS Template Schema
 * Extends BaseTemplate with SMS-specific fields
 */
const SMSTemplateSchema = new mongoose.Schema({
  body: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v) {
        // SMS character limit (1600 for concatenated messages)
        return v.length <= 1600;
      },
      message: 'SMS body must be 1600 characters or less'
    }
  } // Plain text only
});

// Combine with base schema
const FullSMSTemplateSchema = new mongoose.Schema({
  ...BaseTemplateSchema.obj,
  ...SMSTemplateSchema.obj
}, { 
  timestamps: true 
});

export default mongoose.model("SMSTemplate", FullSMSTemplateSchema);

