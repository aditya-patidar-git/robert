import express from 'express';
import { testITMBooking } from '../controllers/itmBookingController.js';

const router = express.Router();

// Public route - no authentication required for testing
router.post('/test-booking', testITMBooking);

export default router;
