import express from "express";
import {
  getAllTranscripts,
  getTranscript,
  searchTranscripts,
  exportTranscripts,
  deleteTranscript,
  submitComplaint,
  getEscalationTimeline
} from "../controllers/transcriptController.js";
import { protect as authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Transcript management routes
router.get("/", getAllTranscripts);
router.get("/search", searchTranscripts);
router.get("/export", exportTranscripts);
router.get("/:id", getTranscript);
router.delete("/:id", deleteTranscript);

// Complaint routes
router.post("/complaint", submitComplaint);

// Escalation routes
router.get("/:callId/escalations", getEscalationTimeline);

export default router;
