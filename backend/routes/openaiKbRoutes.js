import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getAllFiles,
  getFile,
  uploadFile,
  deleteFile,
  searchFiles,
  getVectorStoreStatus,
  getFileContent,
  updateFileTags,
  reingestFile,
  detectFileDrift,
  upload
} from "../controllers/openaiKb/index.js";

const router = express.Router();

// OpenAI Files Routes
// Static routes first
router.get("/files", protect, getAllFiles);
router.post("/files/upload", protect, upload.single('file'), uploadFile);
router.post("/search", protect, searchFiles);
router.get("/vector-store/status", protect, getVectorStoreStatus);

// More specific routes with additional path segments (must come before generic :id routes)
router.get("/files/:id/content", protect, getFileContent);
router.put("/files/:id/tags", protect, updateFileTags);
router.post("/files/:id/reingest", protect, reingestFile);
router.post("/files/:id/detect-drift", protect, detectFileDrift);

// Generic :id routes (must come last)
router.get("/files/:id", protect, getFile);
router.delete("/files/:id", protect, deleteFile);

export default router;
