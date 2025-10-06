import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import { getReingestStatus, startReingest, getFilesNeedingReingest, scheduleReingest } from "../controllers/reingestController.js";

const router = express.Router();

// Protect all reingest routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// Reingest Routes
router.get("/status", getReingestStatus);
router.post("/start", startReingest);
router.get("/files", getFilesNeedingReingest);
router.post("/schedule", scheduleReingest);

export default router;





