import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/rbacMiddleware.js';
import {
  getSystemMetrics,
  getSystemLogs,
  getTraces,
  getPerformanceMetrics,
  getLiveCalls,
  getCallTimeline,
  getCallToolTraces,
  getErrorBudgets,
  getAlerts,
  createAlert,
  acknowledgeAlert,
  resolveAlert,
  getHealth,
  generateReport,
  exportData
} from '../controllers/observabilityController.js';

const router = express.Router();

// Protect all observability routes + RBAC (owner and admin only)
router.use(protect);
router.use(authorizeRoles('owner', 'admin'));

// System Metrics
router.get('/metrics', getSystemMetrics);

// System Logs
router.get('/logs', getSystemLogs);

// Performance Traces
router.get('/traces', getTraces);

// Performance Metrics (with operation parameter)
router.get('/performance/:operation', getPerformanceMetrics);
// Performance Metrics (without operation parameter)
router.get('/performance', getPerformanceMetrics);

// Live Calls
router.get('/calls/live', getLiveCalls);

// Per-Call Timeline
router.get('/calls/:callSid/timeline', getCallTimeline);

// Tool Traces for Call
router.get('/calls/:callSid/tool-traces', getCallToolTraces);

// Error Budgets
router.get('/error-budgets', getErrorBudgets);

// Alerts
router.get('/alerts', getAlerts);
router.post('/alerts', createAlert);
router.post('/alerts/:alertId/acknowledge', acknowledgeAlert);
router.post('/alerts/:alertId/resolve', resolveAlert);

// Health Check
router.get('/health', getHealth);

// Reports
router.get('/reports', generateReport);

// Export Data
router.get('/export', exportData);

export default router;

