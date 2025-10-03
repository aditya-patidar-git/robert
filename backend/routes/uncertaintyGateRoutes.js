import express from "express";
import { validateResults, generateUncertaintyResponse, trackUncertaintyEvent, getConfiguration, updateConfiguration } from "../controllers/uncertaintyGateController.js";

const router = express.Router();

// Uncertainty Gate Routes
router.post("/validate", validateResults);
router.post("/response", generateUncertaintyResponse);
router.post("/track", trackUncertaintyEvent);
router.get("/config", getConfiguration);
router.put("/config", updateConfiguration);

export default router;
