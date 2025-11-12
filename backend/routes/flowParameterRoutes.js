import express from "express";
import {
  getAllFlowParameters,
  getFlowParameter,
  createOrUpdateFlowParameter,
  deleteFlowParameter,
  detectFlowType
} from "../controllers/flowParameterController.js";

const router = express.Router();

// Get all flow parameter overrides
router.get("/", getAllFlowParameters);

// Detect flow type from text (for testing)
router.post("/detect", detectFlowType);

// Get specific flow parameter override
router.get("/:flowType", getFlowParameter);

// Create or update flow parameter override
router.put("/:flowType", createOrUpdateFlowParameter);
router.post("/:flowType", createOrUpdateFlowParameter);

// Delete flow parameter override
router.delete("/:flowType", deleteFlowParameter);

export default router;

