import express from "express";
import {
  getCallerMemories,
  deleteCallerMemories,
  cleanupExpiredMemories,
  getMemoryStats
} from "../controllers/memoryController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/rbacMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get memories for a caller (admin, supervisor, agent)
router.get("/:callerId", requireRole(["admin", "supervisor", "agent"]), getCallerMemories);

// Delete memories for a caller (DSAR support - admin only)
router.delete("/:callerId", requireRole(["admin"]), deleteCallerMemories);

// Cleanup expired memories (admin only)
router.get("/retention/cleanup", requireRole(["admin"]), cleanupExpiredMemories);

// Get memory statistics (admin, supervisor)
router.get("/stats/summary", requireRole(["admin", "supervisor"]), getMemoryStats);

export default router;

