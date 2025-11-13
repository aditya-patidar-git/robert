import express from "express";
import {
  getAllComplaints,
  getComplaint,
  updateComplaintStatus,
  assignComplaint,
  updateComplaintPriority,
  getComplaintStats
} from "../controllers/complaintController.js";
import { protect as authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Complaint management routes
router.get("/", getAllComplaints);
router.get("/stats", getComplaintStats);
router.get("/:id", getComplaint);
router.patch("/:id/status", updateComplaintStatus);
router.patch("/:id/assign", assignComplaint);
router.patch("/:id/priority", updateComplaintPriority);

export default router;

