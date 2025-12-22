import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import {
  getSystemConfig,
  updateSystemConfig,
  getMCPTools,
  executeMCPTool,
  getAvailableModels,
  updateModelConfig
} from "../controllers/systemController.js";
import {
  getSyncStatus,
  getConfigSyncStatus,
  refreshConfig
} from "../controllers/configSyncController.js";

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

// Config Sync Routes
router.get("/config-sync/status", getSyncStatus);
router.get("/config-sync/status/:configType", getConfigSyncStatus);
router.post("/config-sync/refresh", refreshConfig);

export default router;

