import express from 'express';
import {
    getAllMetrics,
    getMetric,
    recordMetric,
    getLogs,
    getTraces,
    getPerformanceData,
    getAlerts,
    acknowledgeAlert,
    resolveAlert,
    createAlert,
    healthCheck,
    generateReport,
    startTrace,
    endTrace,
    recordPerformance
} from '../controllers/observabilityController.js';

const router = express.Router();

// Metrics
router.get('/metrics', getAllMetrics);
router.get('/metrics/:metricName', getMetric);
router.post('/metrics', recordMetric);

// Logs
router.get('/logs', getLogs);

// Traces
router.get('/traces', getTraces);
router.post('/traces', startTrace);
router.post('/traces/:traceId/end', endTrace);

// Performance
router.get('/performance/:operation', getPerformanceData);
router.post('/performance', recordPerformance);

// Alerts
router.get('/alerts', getAlerts);
router.post('/alerts', createAlert);
router.post('/alerts/:alertId/acknowledge', acknowledgeAlert);
router.post('/alerts/:alertId/resolve', resolveAlert);

// Health & Reports
router.get('/health', healthCheck);
router.get('/reports', generateReport);

export default router;
