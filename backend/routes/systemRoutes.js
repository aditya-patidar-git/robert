import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import {
  getSystemConfig,
  updateSystemConfig,
  getMCPTools,
  executeMCPTool,
  getAvailableModels,
  updateModelConfig,
  createBackup,
  restoreBackup
} from "../controllers/systemController.js";

const router = express.Router();

// Protect all routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// System Configuration Routes
router.get("/config", getSystemConfig);
router.put("/config", updateSystemConfig);

// MCP Tools Routes (proxied)
router.get("/mcp-tools", getMCPTools);
router.post("/mcp-tools/execute", executeMCPTool);

// Models Routes (proxied)
router.get("/models", getAvailableModels);
router.put("/models/:modelId", updateModelConfig);

// Backup Routes (placeholders)
router.post("/backup", createBackup);
router.post("/restore/:backupId", restoreBackup);

export default router;

