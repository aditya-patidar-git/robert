import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import {
  sendAbuseAlert,
  testAlertConfiguration,
  sendTestAlert
} from "../controllers/alertController.js";

const router = express.Router();

// Abuse alert endpoint (called by agent service - no auth required for internal calls)
// In production, this should be protected with API key or internal network restriction
router.post("/abuse", sendAbuseAlert);

// Admin endpoints (protected)
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

router.get("/test-config", testAlertConfiguration);
router.post("/test", sendTestAlert);

export default router;

