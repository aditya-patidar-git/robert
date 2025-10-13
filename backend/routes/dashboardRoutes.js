import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/rbacMiddleware.js';
import {
  getDashboardAnalytics
} from '../controllers/dashboardController.js';

const router = express.Router();

// Protect all dashboard routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// Dashboard Analytics - Main endpoint for all dashboard data
router.get('/analytics', getDashboardAnalytics);

export default router;
