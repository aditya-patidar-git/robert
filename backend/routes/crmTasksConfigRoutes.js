import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import {
  getCRMTasksConfig,
  updateCRMTasksConfig
} from "../controllers/crmTasksConfigController.js";

const router = express.Router();

// Protect all routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// CRM Tasks Configuration Routes
router.get("/config/crm-tasks", getCRMTasksConfig);
router.put("/config/crm-tasks", updateCRMTasksConfig);

export default router;

