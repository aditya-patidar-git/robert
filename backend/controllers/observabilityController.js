import observabilityService from '../services/observabilityService.js';

// Get system metrics
export const getSystemMetrics = async (req, res) => {
  try {
    const { timeRange = '1h' } = req.query;
    const metrics = await observabilityService.getSystemMetrics(timeRange);
    res.json({ success: true, data: metrics });
  } catch (error) {
    observabilityService.error('Get system metrics error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get system logs
export const getSystemLogs = async (req, res) => {
  try {
    const filters = {
      level: req.query.level,
      since: req.query.since,
      until: req.query.until,
      message: req.query.message,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) delete filters[key];
    });
    
    const logs = observabilityService.getLogs(filters);
    res.json({ success: true, data: logs });
  } catch (error) {
    observabilityService.error('Get system logs error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get performance traces
export const getTraces = async (req, res) => {
  try {
    const { pattern } = req.query;
    const traces = pattern
      ? observabilityService.getTracesByPattern(pattern)
      : observabilityService.getTraces();
    res.json({ success: true, data: traces });
  } catch (error) {
    observabilityService.error('Get traces error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get performance metrics by operation
export const getPerformanceMetrics = async (req, res) => {
  try {
    const { timeRange = '1h' } = req.query;
    // Check both route parameter and query string for operation
    const operation = req.params.operation || req.query.operation;
    const metrics = await observabilityService.getPerformanceMetrics(timeRange, operation);
    res.json({ success: true, data: metrics });
  } catch (error) {
    observabilityService.error('Get performance metrics error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get live/active calls
export const getLiveCalls = async (req, res) => {
  try {
    const calls = await observabilityService.getLiveCalls();
    res.json({ success: true, data: calls });
  } catch (error) {
    observabilityService.error('Get live calls error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get per-call timeline
export const getCallTimeline = async (req, res) => {
  try {
    const { callSid } = req.params;
    const timeline = await observabilityService.getCallTimeline(callSid);
    
    if (!timeline) {
      return res.status(404).json({ success: false, error: 'Call not found' });
    }
    
    res.json({ success: true, data: timeline });
  } catch (error) {
    observabilityService.error('Get call timeline error', { callSid: req.params.callSid, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get tool traces for a call
export const getCallToolTraces = async (req, res) => {
  try {
    const { callSid } = req.params;
    const traces = await observabilityService.getCallToolTraces(callSid);
    res.json({ success: true, data: traces });
  } catch (error) {
    observabilityService.error('Get call tool traces error', { callSid: req.params.callSid, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get error budgets
export const getErrorBudgets = async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    const budgets = await observabilityService.getErrorBudgets(timeRange);
    res.json({ success: true, data: budgets });
  } catch (error) {
    observabilityService.error('Get error budgets error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get alerts
export const getAlerts = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      severity: req.query.severity,
      since: req.query.since,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) delete filters[key];
    });
    
    const alerts = observabilityService.getAlerts(filters);
    res.json({ success: true, data: alerts });
  } catch (error) {
    observabilityService.error('Get alerts error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create alert
export const createAlert = async (req, res) => {
  try {
    const { title, message, severity, component, metadata } = req.body;
    const alert = observabilityService.createAlert({
      title,
      message,
      severity,
      component,
      metadata
    });
    res.status(201).json({ success: true, data: alert });
  } catch (error) {
    observabilityService.error('Create alert error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Acknowledge alert
export const acknowledgeAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const userId = req.user?.id || 'system';
    const alert = observabilityService.acknowledgeAlert(alertId, userId);
    
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    
    res.json({ success: true, data: alert });
  } catch (error) {
    observabilityService.error('Acknowledge alert error', { alertId: req.params.alertId, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Resolve alert
export const resolveAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const userId = req.user?.id || 'system';
    const alert = observabilityService.resolveAlert(alertId, userId);
    
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    
    res.json({ success: true, data: alert });
  } catch (error) {
    observabilityService.error('Resolve alert error', { alertId: req.params.alertId, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get health check
export const getHealth = async (req, res) => {
  try {
    const health = observabilityService.getHealth();
    res.json({ success: true, data: health });
  } catch (error) {
    observabilityService.error('Get health error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Generate report
export const generateReport = async (req, res) => {
  try {
    const { timeRange = '24h', format = 'json' } = req.query;
    const report = await observabilityService.exportData(format, { timeRange });
    res.json({ success: true, data: report });
  } catch (error) {
    observabilityService.error('Generate report error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Export observability data
export const exportData = async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const filters = {
      level: req.query.level,
      since: req.query.since,
      until: req.query.until,
      tracePattern: req.query.tracePattern
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) delete filters[key];
    });
    
    const exportResult = observabilityService.exportData(format, filters);
    
    // Set appropriate content type and headers
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      res.send(exportResult.data);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      res.json(exportResult.data);
    }
  } catch (error) {
    observabilityService.error('Export data error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

