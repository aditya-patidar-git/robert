import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import { trackFileUsage, getCallProvenance, getFileProvenance, getProvenanceAnalytics, getFileUsageStats, exportProvenanceData, cleanupOldRecords } from "../controllers/provenanceController.js";

const router = express.Router();

// Protect all provenance routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// Provenance Routes
router.post("/track", trackFileUsage);
router.get("/call/:callId", getCallProvenance);
router.get("/file/:fileId", getFileProvenance);
router.get("/analytics", getProvenanceAnalytics);
router.get("/stats/:fileId", getFileUsageStats);
router.get("/export", exportProvenanceData);
router.post("/cleanup", cleanupOldRecords);

export default router;





