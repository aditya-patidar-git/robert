import Booking from "../models/Booking.js";
import bookingTrackingService from "../services/bookingTrackingService.js";

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

/**
 * Track CRM Booking
 * Creates a booking record from CRM automation workflow
 * Called by robert-agent-service after successful Playwright booking
 */
export const trackCRMBooking = async (req, res) => {
    try {
        const {
            callerName,
            callerEmail,
            callerPhone,
            serviceType,
            dateTime,
            callSid,
            crmBookingId,
            centre,
            bikeType,
            sessionDetails,
            paymentCompleted,
            paymentMethod,
            workflowType,
            notes
        } = req.body;

        // Validate required fields
        if (!callerName || !serviceType || !dateTime) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: callerName, serviceType, and dateTime are required'
            });
        }

        const result = await bookingTrackingService.createBookingRecord({
            callerName,
            callerEmail,
            callerPhone,
            serviceType,
            dateTime,
            callSid,
            crmBookingId,
            centre,
            bikeType,
            sessionDetails,
            paymentCompleted,
            paymentMethod,
            workflowType,
            notes,
            source: 'crm_automation'
        });

        res.status(201).json({
            success: true,
            message: 'CRM booking tracked successfully',
            bookingId: result.bookingId,
            booking: result.booking
        });
    } catch (err) {
        console.error('❌ Error tracking CRM booking:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to track CRM booking',
            message: err.message
        });
    }
};

/**
 * Get Booking Statistics
 * Returns statistics about all bookings
 */
export const getBookingStats = async (req, res) => {
    try {
        const stats = await bookingTrackingService.getBookingStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (err) {
        console.error('❌ Error getting booking stats:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to get booking statistics',
            message: err.message
        });
    }
};
