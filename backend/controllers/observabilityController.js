import observabilityService from '../services/observabilityService.js';
import traceAggregationService from '../services/traceAggregationService.js';
import groundednessKPIService from '../services/groundednessKPIService.js';
import voiceInsightsService from '../services/voiceInsightsService.js';
import Alert from '../models/Alert.js';
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

// Get performance traces (database-backed via traceAggregationService)
export const getTraces = async (req, res) => {
  try {
    const { search, dateRange, status, entryPath, limit } = req.query;
    const filters = {};
    
    // Parse date range
    if (dateRange) {
      const [start, end] = dateRange.split(',');
      filters.dateRange = { start, end };
    }
    
    // Add search and other filters
    if (search) filters.search = search;
    if (status) filters.status = status;
    if (entryPath) filters.entryPath = entryPath;
    
    // Get traces from traceAggregationService for database-backed call timelines
    const traces = await traceAggregationService.getTraces(filters, parseInt(limit) || 100);
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

// Get alerts (from database)
export const getAlerts = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      severity: req.query.severity,
      component: req.query.component,
      source: req.query.source,
      since: req.query.since,
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };
    
    // Build MongoDB query
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.severity) query.severity = filters.severity;
    if (filters.component) query.component = filters.component;
    if (filters.source) query.source = filters.source;
    if (filters.since) {
      query.createdAt = { $gte: new Date(filters.since) };
    }
    
    // Fetch from database
    let alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 100)
      .lean();
    
    // Also get in-memory alerts for immediate UI access (merge with database alerts)
    const inMemoryAlerts = observabilityService.getAlerts({ limit: 50 });
    
    // Combine and deduplicate (prefer database alerts)
    const alertMap = new Map();
    
    // Add database alerts first
    alerts.forEach(alert => {
      alertMap.set(alert._id.toString(), {
        ...alert,
        id: alert._id.toString(),
        source: 'database'
      });
    });
    
    // Add in-memory alerts that aren't in database
    inMemoryAlerts.forEach(alert => {
      if (!alertMap.has(alert.id)) {
        alertMap.set(alert.id, {
          ...alert,
          source: 'in-memory'
        });
      }
    });
    
    const combinedAlerts = Array.from(alertMap.values())
      .sort((a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp));
    
    res.json({ success: true, data: combinedAlerts });
  } catch (error) {
    observabilityService.error('Get alerts error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create alert (writes to database)
export const createAlert = async (req, res) => {
  try {
    const alertData = req.body;
    
    // Create in database
    const alert = new Alert({
      title: alertData.title,
      message: alertData.message,
      severity: alertData.severity || 'warning',
      component: alertData.component || 'system',
      callerId: alertData.callerId,
      reason: alertData.reason,
      source: alertData.source || 'backend-service',
      metadata: alertData.metadata || {}
    });
    
    await alert.save();
    
    // Also create in-memory for immediate UI access
    observabilityService.createAlert({
      ...alertData,
      id: alert._id.toString()
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
    
    // Try database first
    let alert = await Alert.findById(alertId);
    
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      alert.resolvedBy = userId;
      await alert.save();
      
      return res.json({ success: true, data: alert });
    }
    
    // Fallback to in-memory alert
    const inMemoryAlert = observabilityService.resolveAlert(alertId, userId);
    
    if (!inMemoryAlert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    
    res.json({ success: true, data: inMemoryAlert });
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
    
    const callRecords = await CallRecord.find(query).select('toolsUsed callSid createdAt');
    
    const toolMetrics = {
      totalCalls: callRecords.length,
      callsWithTools: 0,
      callsWithoutTools: 0,
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
        toolMetrics.callsWithTools++;
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
          
          if (tool.success !== false) { // Default to success if not explicitly false
            toolMetrics.successfulExecutions++;
            breakdown.successes++;
          } else {
            toolMetrics.failedExecutions++;
            breakdown.failures++;
          }
        });
      } else {
        toolMetrics.callsWithoutTools++;
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

// Get Voice Insights aggregated metrics
export const getVoiceInsights = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'hour', phoneNumber, entryPath } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'startDate and endDate query parameters are required' 
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid date format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)' 
      });
    }

    const filters = {};
    if (phoneNumber) filters.phoneNumber = phoneNumber;
    if (entryPath) filters.entryPath = entryPath;

    const result = await voiceInsightsService.getAggregatedMetrics(
      start, 
      end, 
      groupBy, 
      filters
    );

    res.json(result);
  } catch (error) {
    observabilityService.error('Get voice insights error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get Voice Insights SLO compliance
export const getVoiceInsightsSLO = async (req, res) => {
  try {
    const { period = '24h' } = req.query;
    const result = await voiceInsightsService.getSLOCompliance(period);
    res.json(result);
  } catch (error) {
    observabilityService.error('Get voice insights SLO error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get Voice Insights for specific call
export const getCallVoiceInsights = async (req, res) => {
  try {
    const { callSid } = req.params;
    if (!callSid) {
      return res.status(400).json({ 
        success: false, 
        error: 'callSid parameter is required' 
      });
    }

    const result = await voiceInsightsService.getCallMetrics(callSid);
    res.json(result);
  } catch (error) {
    observabilityService.error('Get call voice insights error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

