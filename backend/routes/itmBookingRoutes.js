import express from "express";
import { testITMBooking } from "../controllers/itmBookingController.js";

const router = express.Router();

router.post("/test-booking", testITMBooking);

export default router;

