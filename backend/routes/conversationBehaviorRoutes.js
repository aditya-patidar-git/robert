import express from "express";
import { getConfig, updateConfig } from "../controllers/conversationBehaviorController.js";
import { protect as authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/conversation-behavior/config
router.get("/config", authenticateToken, getConfig);

// POST /api/conversation-behavior/config
router.post("/config", authenticateToken, updateConfig);

export default router;

