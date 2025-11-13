import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import {
  getPrivacyConfig,
  updatePrivacyConfig
} from "../controllers/privacyConfigController.js";

const router = express.Router();

// Protect all routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// Privacy Configuration Routes
router.get("/config/privacy", getPrivacyConfig);
router.put("/config/privacy", updatePrivacyConfig);

export default router;

