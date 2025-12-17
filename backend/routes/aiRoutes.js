import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import {
  getConfig,
  updateConfig,
  getModels,
  getRecommendedFallbackChain,
  testPrompt,
  getModelParameters,
  getModelCapabilities
} from "../controllers/ai/index.js";
import {
  getModelHistory,
  getAllModelHistory,
  getModelAlerts,
  refreshModels
} from "../controllers/modelDiscoveryController.js";

const router = express.Router();

// Protect all AI routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// AI Configuration Routes
router.get("/config", getConfig);
router.put("/config", updateConfig);
router.get("/models", getModels);
router.get("/models/recommended", getRecommendedFallbackChain);
router.get("/models/parameters", getModelParameters);
router.get("/models/capabilities", getModelCapabilities);
router.get("/models/history", getAllModelHistory);
router.get("/models/history/:modelId", getModelHistory);
router.get("/models/alerts", getModelAlerts);
router.post("/models/refresh", refreshModels);
router.post("/test", testPrompt);

export default router;
