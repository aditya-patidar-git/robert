import express from "express";
import {
  getConfig,
  updateConfig,
  getModels,
  testPrompt
} from "../controllers/aiController.js";

const router = express.Router();

// AI Configuration Routes
router.get("/config", getConfig);
router.put("/config", updateConfig);
router.get("/models", getModels);
router.post("/test", testPrompt);

export default router;
