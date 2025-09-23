import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema({
    caller_name: { type: String, required: true },
    caller_email: { type: String },
    caller_phone: { type: String },
    service_type: { type: String, required: true },
    date_time: { type: Date, required: true },
    status: { type: String, default: "pending" } // pending, confirmed, rescheduled
}, { timestamps: true });

export default mongoose.model("Booking", BookingSchema);
