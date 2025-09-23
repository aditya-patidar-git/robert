import Booking from "../models/Booking.js";

// Create Booking
export const createBooking = async (req, res) => {
    try {
        const { caller_name, caller_email, caller_phone, service_type, date_time } = req.body;

        const booking = new Booking({
            caller_name,
            caller_email,
            caller_phone,
            service_type,
            date_time
        });

        await booking.save();

        res.status(201).json({
            status: "success",
            booking_id: booking._id,
            confirmation_message: "Booking created successfully"
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
};

// Reschedule Booking
export const rescheduleBooking = async (req, res) => {
    try {
        const { booking_id, new_date_time } = req.body;
        const booking = await Booking.findById(booking_id);
        if (!booking) return res.status(404).json({ status: "error", message: "Booking not found" });

        booking.date_time = new_date_time;
        booking.status = "rescheduled";
        await booking.save();

        res.json({
            status: "success",
            confirmation_message: "Booking rescheduled successfully"
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
};

// Update Customer
export const updateCustomer = async (req, res) => {
    try {
        const { customer_id, fields_to_update } = req.body;
        const booking = await Booking.findById(customer_id);
        if (!booking) return res.status(404).json({ status: "error", message: "Customer not found" });

        Object.keys(fields_to_update).forEach(key => {
            booking[key] = fields_to_update[key];
        });
        await booking.save();

        res.json({
            status: "success",
            updated_fields: Object.keys(fields_to_update)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
};

// Verify Operation (Dry-run simulation)
export const verifyOperation = async (req, res) => {
    try {
        const { operation_type, operation_details } = req.body;

        // Simple simulation
        res.json({
            status: "success",
            verification_status: "passed",
            diff_summary: `Dry-run for ${operation_type} looks good`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "Verification failed" });
    }
};
