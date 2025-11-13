import express from "express";
import {
  getTokenUsage,
  getTokenStats,
  optimizeContext,
  getContextLimit
} from "../controllers/tokenManagementController.js";

const router = express.Router();

// Get token usage for a specific call
router.get("/usage/:callSid", getTokenUsage);

// Get aggregate token usage statistics
router.get("/stats", getTokenStats);

// Get context limit for a model
router.get("/context-limit/:modelId", getContextLimit);

// Manually trigger context optimization
router.post("/optimize/:callSid", optimizeContext);

export default router;

