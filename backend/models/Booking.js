import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema({
    // Core booking fields
    caller_name: { type: String, required: true },
    caller_email: { type: String },
    caller_phone: { type: String },
    service_type: { 
        type: String, 
        required: true,
        enum: ['ITM', 'CBT', 'CBT_Executive', 'Gear_Conversion', 'Private_Lesson', 'TfL_1-2-1', 'TfL_Beyond_CBT', 'Full_Licence_Assessment', 'Other']
    },
    date_time: { type: Date, required: true },
    status: { 
        type: String, 
        default: "confirmed",
        enum: ['pending', 'confirmed', 'cancelled', 'completed']
    },
    
    // CRM tracking fields
    source: {
        type: String,
        default: 'crm_automation',
        enum: ['manual', 'crm_automation', 'api']
    },
    callSid: { type: String, index: true }, // Link to the call that triggered the booking
    crmBookingId: { type: String }, // ID from external CRM if available
    
    // Location and details
    centre: { 
        type: String,
        enum: ['Alperton', 'Croydon', 'Edgware', 'Eltham', 'Wimbledon', 'Dagenham', 'Hoddesdon', 'Unknown']
    },
    bikeType: { type: String }, // e.g., '125cc automatic', '50cc automatic', '125cc manual'
    
    // Session details from CRM
    sessionDetails: {
        startTime: { type: String },
        endTime: { type: String },
        instructor: { type: String },
        price: { type: Number }
    },
    
    // Payment tracking
    paymentCompleted: { type: Boolean, default: false },
    paymentMethod: { type: String },
    
    // Workflow tracking
    workflowType: { 
        type: String, 
        enum: ['new', 'existing'],
        default: 'new'
    },
    
    // Audit fields
    notes: { type: String }
}, { timestamps: true });

// Indexes for efficient queries
BookingSchema.index({ callSid: 1 });
BookingSchema.index({ source: 1 });
BookingSchema.index({ service_type: 1 });
BookingSchema.index({ createdAt: -1 });

export default mongoose.model("Booking", BookingSchema);
