import express from "express";
import {
    createBooking,
    rescheduleBooking,
    updateCustomer,
    verifyOperation
} from "../controllers/bookingController.js";

const router = express.Router();

router.post("/create", createBooking);
router.post("/reschedule", rescheduleBooking);
router.post("/update", updateCustomer);
router.post("/verify", verifyOperation);

export default router;
