import express from "express";
import {
  getAllTools,
  getToolStatus,
  updateToolConfig,
  enableTool,
  disableTool,
  updateRateLimit,
  updateDomainAllowlist,
  getToolMetrics,
  initializeDefaults
} from "../controllers/toolConfigController.js";
import { protect as authenticateToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";

const router = express.Router();

// All routes require authentication and admin/owner role
router.use(authenticateToken);
router.use(authorizeRoles("owner", "admin"));

// Tool configuration routes
router.get("/", getAllTools);
router.get("/initialize", initializeDefaults);
router.get("/:toolName/status", getToolStatus);
router.get("/:toolName/metrics", getToolMetrics);
router.put("/:toolName", updateToolConfig);
router.post("/:toolName/enable", enableTool);
router.post("/:toolName/disable", disableTool);
router.put("/:toolName/rate-limit", updateRateLimit);
router.put("/:toolName/domains", updateDomainAllowlist);

export default router;

