import express from "express";
import {
    createBooking,
    updateCustomer,
    verifyOperation,
    trackCRMBooking,
    getBookingStats
} from "../controllers/bookingController.js";

const router = express.Router();

// Standard booking operations
router.post("/create", createBooking);
router.post("/update", updateCustomer);
router.post("/verify", verifyOperation);

// CRM booking tracking (called by robert-agent-service)
router.post("/track-crm", trackCRMBooking);

// Booking statistics
router.get("/stats", getBookingStats);

export default router;
