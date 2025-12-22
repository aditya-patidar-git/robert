import observabilityService from '../services/observabilityService.js';
import traceAggregationService from '../services/traceAggregationService.js';
import groundednessKPIService from '../services/groundednessKPIService.js';
import { getMeterProvider } from '../utils/telemetry.js';
import { metrics } from '@opentelemetry/api';

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

// Get trace statistics
export const getTraceStatistics = async (req, res) => {
  try {
    const filters = {};
    
    if (req.query.dateRange) {
      const [start, end] = req.query.dateRange.split(',');
      filters.dateRange = { start, end };
    }
    
    const statistics = await traceAggregationService.getTraceStatistics(filters);
    res.json({ success: true, data: statistics });
  } catch (error) {
    observabilityService.error('Get trace statistics error', { error: error.message });
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

// Get per-call timeline (using OpenTelemetry trace aggregation)
export const getCallTimeline = async (req, res) => {
  try {
    const { callSid } = req.params;
    const timeline = await traceAggregationService.getCallTimeline(callSid);
    
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

// Get groundedness metrics
export const getGroundednessMetrics = async (req, res) => {
  try {
    const { dateRange, status } = req.query;
    const filters = {};
    
    if (dateRange) {
      const [start, end] = dateRange.split(',');
      filters.dateRange = { start, end };
    }
    if (status) filters.status = status;
    
    const metrics = await groundednessKPIService.getAggregatedGroundedness(filters);
    res.json({ success: true, data: metrics });
  } catch (error) {
    observabilityService.error('Get groundedness metrics error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get RAG analytics
export const getRAGAnalytics = async (req, res) => {
  try {
    const { dateRange } = req.query;
    const filters = {};
    
    if (dateRange) {
      const [start, end] = dateRange.split(',');
      filters.dateRange = { start, end };
    }
    
    const analytics = await groundednessKPIService.getRAGAnalytics(filters);
    res.json({ success: true, data: analytics });
  } catch (error) {
    observabilityService.error('Get RAG analytics error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get tool performance metrics
export const getToolMetrics = async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    // Get metrics from OpenTelemetry if available
    const meterProvider = getMeterProvider();
    if (!meterProvider) {
      // Fallback to observability service
      const metrics = await observabilityService.getPerformanceMetrics(timeRange, 'tool');
      return res.json({ success: true, data: metrics });
    }

    // Query tool metrics from database
    const CallRecord = (await import('../models/callRecord.js')).default;
    const query = {};
    
    // Apply time range filter
    const now = new Date();
    const timeRangeMs = {
      '1h': 3600000,
      '6h': 21600000,
      '24h': 86400000,
      '7d': 604800000
    }[timeRange] || 86400000;
    
    query.createdAt = { $gte: new Date(now.getTime() - timeRangeMs) };
    
    const callRecords = await CallRecord.find(query).select('toolsUsed');
    
    const toolMetrics = {
      totalInvocations: 0,
      toolBreakdown: {},
      averageExecutionTime: 0,
      successRate: 0,
      errorRate: 0,
      totalExecutionTime: 0,
      successfulExecutions: 0,
      failedExecutions: 0
    };
    
    let totalTime = 0;
    
    for (const record of callRecords) {
      if (record.toolsUsed && record.toolsUsed.length > 0) {
        record.toolsUsed.forEach(tool => {
          toolMetrics.totalInvocations++;
          
          if (!toolMetrics.toolBreakdown[tool.toolName]) {
            toolMetrics.toolBreakdown[tool.toolName] = {
              count: 0,
              totalTime: 0,
              successes: 0,
              failures: 0
            };
          }
          
          const breakdown = toolMetrics.toolBreakdown[tool.toolName];
          breakdown.count++;
          
          if (tool.executionTime) {
            totalTime += tool.executionTime;
            breakdown.totalTime += tool.executionTime;
          }
          
          if (tool.success) {
            toolMetrics.successfulExecutions++;
            breakdown.successes++;
          } else {
            toolMetrics.failedExecutions++;
            breakdown.failures++;
          }
        });
      }
    }
    
    if (toolMetrics.totalInvocations > 0) {
      toolMetrics.averageExecutionTime = totalTime / toolMetrics.totalInvocations;
      toolMetrics.successRate = toolMetrics.successfulExecutions / toolMetrics.totalInvocations;
      toolMetrics.errorRate = toolMetrics.failedExecutions / toolMetrics.totalInvocations;
      toolMetrics.totalExecutionTime = totalTime;
    }
    
    res.json({ success: true, data: toolMetrics });
  } catch (error) {
    observabilityService.error('Get tool metrics error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get SIP metrics
export const getSIPMetrics = async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    const CallRecord = (await import('../models/callRecord.js')).default;
    const query = { entryPath: 'SIP' };
    
    // Apply time range filter
    const now = new Date();
    const timeRangeMs = {
      '1h': 3600000,
      '6h': 21600000,
      '24h': 86400000,
      '7d': 604800000
    }[timeRange] || 86400000;
    
    query.createdAt = { $gte: new Date(now.getTime() - timeRangeMs) };
    
    const sipCalls = await CallRecord.find(query).select('callSid callStatus duration createdAt');
    
    const sipMetrics = {
      totalCalls: sipCalls.length,
      callsByStatus: {},
      averageDuration: 0,
      totalDuration: 0,
      successRate: 0,
      failureRate: 0,
      completedCalls: 0,
      failedCalls: 0
    };
    
    let totalDuration = 0;
    
    for (const call of sipCalls) {
      // Count by status
      const status = call.callStatus || 'unknown';
      sipMetrics.callsByStatus[status] = (sipMetrics.callsByStatus[status] || 0) + 1;
      
      // Sum duration
      if (call.duration) {
        totalDuration += call.duration;
      }
      
      // Count successes/failures
      if (status === 'completed') {
        sipMetrics.completedCalls++;
      } else if (status === 'failed' || status === 'busy' || status === 'no-answer') {
        sipMetrics.failedCalls++;
      }
    }
    
    if (sipCalls.length > 0) {
      sipMetrics.averageDuration = totalDuration / sipCalls.length;
      sipMetrics.totalDuration = totalDuration;
      sipMetrics.successRate = sipMetrics.completedCalls / sipCalls.length;
      sipMetrics.failureRate = sipMetrics.failedCalls / sipCalls.length;
    }
    
    res.json({ success: true, data: sipMetrics });
  } catch (error) {
    observabilityService.error('Get SIP metrics error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

