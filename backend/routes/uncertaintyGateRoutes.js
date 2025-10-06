import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import { validateResults, generateUncertaintyResponse, trackUncertaintyEvent, getConfiguration, updateConfiguration } from "../controllers/uncertaintyGateController.js";

const router = express.Router();

// Protect all uncertainty gate routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// Uncertainty Gate Routes
router.post("/validate", validateResults);
router.post("/response", generateUncertaintyResponse);
router.post("/track", trackUncertaintyEvent);
router.get("/config", getConfiguration);
router.put("/config", updateConfiguration);

export default router;





