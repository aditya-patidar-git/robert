import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import {
  handleTwilioPayCallback,
  handleTwilioPayStatus,
  createPaymentLink,
  getPaymentStatus
} from "../controllers/paymentController.js";

const router = express.Router();

// Public routes (webhooks from Twilio)
router.post("/twilio-pay/status", handleTwilioPayStatus);
router.post("/twilio-pay/callback", handleTwilioPayCallback);

// Protected routes (admin only)
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

router.post("/link", createPaymentLink);
router.get("/status/:paymentId", getPaymentStatus);

export default router;

