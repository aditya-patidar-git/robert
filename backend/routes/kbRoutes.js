import express from "express";
import multer from "multer";
import path from "path";
import {
  getAllArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  searchArticles
} from "../controllers/kbController.js";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 // 1MB limit
  }
});

// Knowledge Base Routes
router.get("/articles", getAllArticles);
router.get("/articles/:id", getArticle);
router.post("/articles", upload.single('file'), createArticle);
router.put("/articles/:id", updateArticle);
router.delete("/articles/:id", deleteArticle);
router.get("/search", searchArticles);

export default router;
