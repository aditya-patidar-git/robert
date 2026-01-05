import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/rbacMiddleware.js';
import {
  getSystemMetrics,
  getSystemLogs,
  getTraces,
  getTraceStatistics,
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
  exportData,
  getGroundednessMetrics,
  getRAGAnalytics,
  getToolMetrics,
  getSIPMetrics,
  getVoiceInsights,
  getVoiceInsightsSLO,
  getCallVoiceInsights
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
router.get('/traces/statistics', getTraceStatistics);

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

// Groundedness & RAG Metrics
router.get('/groundedness', getGroundednessMetrics);
router.get('/rag-analytics', getRAGAnalytics);

// Tool & SIP Metrics
router.get('/tools/metrics', getToolMetrics);
router.get('/sip/metrics', getSIPMetrics);

// Voice Insights
router.get('/voice-insights', getVoiceInsights);
router.get('/voice-insights/slo', getVoiceInsightsSLO);
router.get('/voice-insights/calls/:callSid', getCallVoiceInsights);

export default router;

