import express from "express";
import { getDriftStatus, startDriftDetection, getFilesWithDrift, clearDriftFlags } from "../controllers/driftController.js";

const router = express.Router();

// Drift Detection Routes
router.get("/status", getDriftStatus);
router.post("/detect", startDriftDetection);
router.get("/files", getFilesWithDrift);
router.post("/clear", clearDriftFlags);

export default router;
