import express from "express";
import {
  getVectorStoreStatus,
  searchVectorStore,
  testFileSearch,
  getModelCapabilities,
  getModelParameters,
  startMigration,
  getMigrationStatus,
  syncFile,
  validateVectorStore,
  cleanupOrphanedFiles
} from "../controllers/vectorStoreController.js";

const router = express.Router();

// Vector Store Routes
router.get("/status", getVectorStoreStatus);
router.get("/search", searchVectorStore);
router.post("/test-search", testFileSearch);

// Model Discovery Routes
router.get("/models", getModelCapabilities);
router.get("/models/:modelId/parameters", getModelParameters);

// Migration Routes
router.post("/migrate", startMigration);
router.get("/migration/status", getMigrationStatus);
router.post("/sync/:fileId", syncFile);

// Validation Routes
router.get("/validate", validateVectorStore);
router.post("/cleanup", cleanupOrphanedFiles);

export default router;





