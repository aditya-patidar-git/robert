import express from "express";
import {
  searchFiles,
  searchFilesByTags,
  getFileContent,
  getVectorStoreStatus,
  testSearch
} from "../controllers/fileSearchController.js";

const router = express.Router();

// File Search Routes
router.post("/search", searchFiles);
router.post("/search-by-tags", searchFilesByTags);
router.get("/file/:fileId", getFileContent);
router.get("/vector-store/status", getVectorStoreStatus);
router.post("/test", testSearch);

export default router;





