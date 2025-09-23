import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import { getUsers, createUser, approveUser, blockUser, excludeUser, deleteUser } from "../controllers/userController.js";
import { addPrompt, getPrompts, updatePrompt } from "../controllers/promptController.js";

const router = express.Router();

// Protect all routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// Users
router.get("/users", getUsers);
router.post("/users", createUser);
router.patch("/users/:id/approve", approveUser);
router.patch("/users/:id/block", blockUser);
router.patch("/users/:id/exclude", excludeUser);
router.delete("/users/:id", deleteUser);

// Global Prompt
router.post("/prompt", addPrompt);
router.get("/prompt", getPrompts);
router.put("/prompt/:id", updatePrompt);

export default router;

