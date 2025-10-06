import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import { getDriftStatus, startDriftDetection, getFilesWithDrift, clearDriftFlags } from "../controllers/driftController.js";

const router = express.Router();

// Protect all drift routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// Drift Detection Routes
router.get("/status", getDriftStatus);
router.post("/detect", startDriftDetection);
router.get("/files", getFilesWithDrift);
router.post("/clear", clearDriftFlags);

export default router;





