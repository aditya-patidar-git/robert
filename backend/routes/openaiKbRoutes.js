import express from "express";
import {
  getAllFiles,
  getFile,
  uploadFile,
  deleteFile,
  searchFiles,
  getVectorStoreStatus,
  upload
} from "../controllers/openaiKbController.js";

const router = express.Router();

// OpenAI Files Routes
router.get("/files", getAllFiles);
router.get("/files/:id", getFile);
router.post("/files/upload", upload.single('file'), uploadFile);
router.delete("/files/:id", deleteFile);
router.post("/search", searchFiles);
router.get("/vector-store/status", getVectorStoreStatus);

export default router;
