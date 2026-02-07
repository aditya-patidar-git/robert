import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import { getUsers, createUser, updateUser, approveUser, blockUser, excludeUser, deleteUser } from "../controllers/userController.js";
import { addPrompt, getPrompts, updatePrompt } from "../controllers/promptController.js";
import { getAllowlist, addToAllowlist, removeFromAllowlist, checkAllowlist } from "../controllers/allowlistController.js";
import { getAuditLogs, getAuditLog, exportAuditLogs, runAuditRetention } from "../controllers/auditLogController.js";

const router = express.Router();

// Protect all routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// Users
router.get("/users", getUsers);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.patch("/users/:id/approve", approveUser);
router.patch("/users/:id/block", blockUser);
router.patch("/users/:id/exclude", excludeUser);
router.delete("/users/:id", deleteUser);

// Allowlist
router.get("/allowlist", getAllowlist);
router.post("/allowlist", addToAllowlist);
router.delete("/allowlist/:id", removeFromAllowlist);
router.get("/allowlist/check", checkAllowlist);

// Audit Logs
router.get("/audit", getAuditLogs);
router.get("/audit/export", exportAuditLogs);
router.post("/audit/retention-run", runAuditRetention);
router.get("/audit/:id", getAuditLog);

// Global Prompt
router.post("/prompt", addPrompt);
router.get("/prompt", getPrompts);
router.put("/prompt/:id", updatePrompt);

export default router;

