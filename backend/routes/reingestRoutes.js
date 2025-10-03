import express from "express";
import { getReingestStatus, startReingest, getFilesNeedingReingest, scheduleReingest } from "../controllers/reingestController.js";

const router = express.Router();

// Reingest Routes
router.get("/status", getReingestStatus);
router.post("/start", startReingest);
router.get("/files", getFilesNeedingReingest);
router.post("/schedule", scheduleReingest);

export default router;
