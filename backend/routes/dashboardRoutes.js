import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/rbacMiddleware.js';
import {
  getDashboardAnalytics,
  toggleRouting,
  dismissAlert
} from '../controllers/dashboardController.js';

const router = express.Router();

// Protect all dashboard routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// Dashboard Analytics - Main endpoint for all dashboard data
router.get('/analytics', getDashboardAnalytics);

// Toggle routing status
router.post('/routing/toggle', toggleRouting);

// Dismiss an alert
router.patch('/alerts/:alertId/dismiss', dismissAlert);

export default router;
