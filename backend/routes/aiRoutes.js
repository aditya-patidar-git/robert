import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import {
  getConfig,
  updateConfig,
  getModels,
  getRecommendedFallbackChain,
  testPrompt
} from "../controllers/aiController.js";

const router = express.Router();

// Protect all AI routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// AI Configuration Routes
router.get("/config", getConfig);
router.put("/config", updateConfig);
router.get("/models", getModels);
router.get("/models/recommended", getRecommendedFallbackChain);
router.post("/test", testPrompt);

export default router;
