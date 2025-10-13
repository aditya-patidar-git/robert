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
  upload
} from "../controllers/openaiKbController.js";

const router = express.Router();

// OpenAI Files Routes
router.get("/files", protect, getAllFiles);
router.get("/files/:id", protect, getFile);
router.get("/files/:id/content", protect, getFileContent);
router.post("/files/upload", protect, upload.single('file'), uploadFile);
router.delete("/files/:id", protect, deleteFile);
router.post("/search", protect, searchFiles);
router.get("/vector-store/status", protect, getVectorStoreStatus);

export default router;
