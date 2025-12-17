import mongoose from "mongoose";

/**
 * Base Template Schema
 * Common fields for EmailTemplate and SMSTemplate
 */
const BaseTemplateSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  category: { 
    type: String, 
    enum: ['booking_confirmation', 'booking_cancellation', 'payment_link', 'terms_conditions', 'custom'], 
    required: true 
  },
  courseType: { 
    type: String, 
    enum: ['ITM', 'CBT', 'CBT_EXECUTIVE', 'PRIVATE_LESSON', 'GEAR_CONVERSION', 'TFL_1_2_1', 'TFL_BEYOND_CBT', 'FULL_LICENCE_ASSESSMENT', 'all'], 
    default: 'all' 
  },
  variables: [{
    name: { type: String, required: true },
    description: String,
    example: String
  }],
  isActive: { 
    type: Boolean, 
    default: true 
  },
  version: { 
    type: Number, 
    default: 1 
  },
  createdBy: { 
    type: String, 
    default: "admin" 
  },
  updatedBy: { 
    type: String, 
    default: "admin" 
  }
}, { 
  timestamps: true,
  discriminatorKey: 'templateType'
});

export default BaseTemplateSchema;

