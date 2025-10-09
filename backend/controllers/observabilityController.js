import observabilityService from '../services/observabilityService.js';

// Get all metrics
export const getAllMetrics = async (req, res) => {
    try {
        const metrics = observabilityService.getAllMetrics();
        res.json({ success: true, metrics });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get specific metric
export const getMetric = async (req, res) => {
    try {
        const { metricName } = req.params;
        const value = observabilityService.getMetric(metricName);
        
        res.json({ success: true, metricName, value });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Record metric
export const recordMetric = async (req, res) => {
    try {
        const { metricName, value, tags } = req.body;
        
        if (!metricName || value === undefined) {
            return res.status(400).json({ success: false, error: 'Metric name and value are required' });
        }
        
        observabilityService.recordMetric(metricName, value, tags);
        
        res.json({ success: true, message: 'Metric recorded' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get logs
export const getLogs = async (req, res) => {
    try {
        const { level, limit } = req.query;
        
        // In a real implementation, this would filter logs by level and limit
        const logs = observabilityService.logs || [];
        
        let filteredLogs = logs;
        if (level) {
            filteredLogs = logs.filter(log => log.level === level);
        }
        
        if (limit) {
            filteredLogs = filteredLogs.slice(-parseInt(limit));
        }
        
        res.json({ success: true, logs: filteredLogs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get traces
export const getTraces = async (req, res) => {
    try {
        const { operation, limit } = req.query;
        
        // In a real implementation, this would filter traces by operation and limit
        const traces = observabilityService.traces || [];
        
        let filteredTraces = traces;
        if (operation) {
            filteredTraces = traces.filter(trace => trace.operationName === operation);
        }
        
        if (limit) {
            filteredTraces = filteredTraces.slice(-parseInt(limit));
        }
        
        res.json({ success: true, traces: filteredTraces });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get performance data
export const getPerformanceData = async (req, res) => {
    try {
        const { operation } = req.params;
        
        const performanceData = observabilityService.getPerformanceData(operation);
        const summary = observabilityService.getPerformanceSummary(operation);
        
        res.json({ success: true, operation, performanceData, summary });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get alerts
export const getAlerts = async (req, res) => {
    try {
        const { status } = req.query;
        
        let alerts;
        if (status === 'active') {
            alerts = observabilityService.getActiveAlerts();
        } else {
            alerts = observabilityService.alerts || [];
        }
        
        res.json({ success: true, alerts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Acknowledge alert
export const acknowledgeAlert = async (req, res) => {
    try {
        const { alertId } = req.params;
        const { acknowledgedBy } = req.body;
        
        if (!acknowledgedBy) {
            return res.status(400).json({ success: false, error: 'Acknowledged by is required' });
        }
        
        observabilityService.acknowledgeAlert(alertId, acknowledgedBy);
        
        res.json({ success: true, message: 'Alert acknowledged' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Resolve alert
export const resolveAlert = async (req, res) => {
    try {
        const { alertId } = req.params;
        const { resolvedBy } = req.body;
        
        if (!resolvedBy) {
            return res.status(400).json({ success: false, error: 'Resolved by is required' });
        }
        
        observabilityService.resolveAlert(alertId, resolvedBy);
        
        res.json({ success: true, message: 'Alert resolved' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Create alert
export const createAlert = async (req, res) => {
    try {
        const { alertType, severity, message, context } = req.body;
        
        if (!alertType || !severity || !message) {
            return res.status(400).json({ success: false, error: 'Alert type, severity, and message are required' });
        }
        
        const alert = observabilityService.createAlert(alertType, severity, message, context);
        
        res.json({ success: true, alert });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Health check
export const healthCheck = async (req, res) => {
    try {
        const healthCheck = await observabilityService.performHealthCheck();
        
        res.json({ success: true, healthCheck });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Generate report
export const generateReport = async (req, res) => {
    try {
        const { period } = req.query;
        
        const report = observabilityService.generateReport(period);
        
        res.json({ success: true, report });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Start trace
export const startTrace = async (req, res) => {
    try {
        const { operationName, context } = req.body;
        
        if (!operationName) {
            return res.status(400).json({ success: false, error: 'Operation name is required' });
        }
        
        const traceId = observabilityService.startTrace(operationName, context);
        
        res.json({ success: true, traceId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// End trace
export const endTrace = async (req, res) => {
    try {
        const { traceId } = req.params;
        const { result } = req.body;
        
        observabilityService.endTrace(traceId, result);
        
        res.json({ success: true, message: 'Trace ended' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Record performance
export const recordPerformance = async (req, res) => {
    try {
        const { operation, duration, metadata } = req.body;
        
        if (!operation || !duration) {
            return res.status(400).json({ success: false, error: 'Operation and duration are required' });
        }
        
        observabilityService.recordPerformance(operation, duration, metadata);
        
        res.json({ success: true, message: 'Performance recorded' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
