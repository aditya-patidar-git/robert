/**
 * ObservabilityService - Comprehensive monitoring, metrics, and logging service
 * Provides metrics tracking, distributed tracing, structured logging, and error handling
 * for Twilio integrations and all backend controllers.
 */

import CallRecord from '../models/callRecord.js';
import ConversationContext from '../models/ConversationContext.js';

class ObservabilityService {
  constructor() {
    // In-memory storage for metrics, traces, and logs
    this.metrics = new Map();
    this.traces = new Map();
    this.logs = [];
    this.traceCounter = 0;
    this.alerts = new Map(); // In-memory alerts storage
    this.alertCounter = 0;
    
    // Configuration
    this.config = {
      maxLogs: 10000, // Maximum number of logs to keep in memory
      maxTraces: 1000, // Maximum number of traces to keep in memory
      maxAlerts: 500, // Maximum number of alerts to keep in memory
      logLevel: process.env.LOG_LEVEL || 'info', // Log level filtering
      enableConsole: process.env.NODE_ENV !== 'production' // Console logging in dev
    };
    
    // Log levels for filtering
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  /**
   * Increment a metric counter
   * @param {string} metricName - Name of the metric to increment
   * @param {number} value - Value to increment by (default: 1)
   * @param {Object} tags - Optional tags for the metric
   */
  incrementMetric(metricName, value = 1, tags = {}) {
    const key = this._buildMetricKey(metricName, tags);
    const currentValue = this.metrics.get(key) || 0;
    this.metrics.set(key, currentValue + value);
    
    if (this.config.enableConsole) {
      console.log(`📊 METRIC: ${metricName} += ${value}`, tags);
    }
  }

  /**
   * Start a new trace for performance monitoring
   * @param {string} traceName - Name of the trace
   * @param {Object} metadata - Additional metadata for the trace
   * @returns {string} - Trace ID for correlation
   */
  startTrace(traceName, metadata = {}) {
    const traceId = `trace_${Date.now()}_${++this.traceCounter}`;
    const trace = {
      id: traceId,
      name: traceName,
      startTime: Date.now(),
      metadata: metadata,
      endTime: null,
      duration: null,
      success: null,
      error: null
    };
    
    this.traces.set(traceId, trace);
    
    // Cleanup old traces if we exceed the limit
    if (this.traces.size > this.config.maxTraces) {
      const oldestTrace = Array.from(this.traces.values())
        .sort((a, b) => a.startTime - b.startTime)[0];
      this.traces.delete(oldestTrace.id);
    }
    
    if (this.config.enableConsole) {
      console.log(`🔍 TRACE START: ${traceName} [${traceId}]`, metadata);
    }
    
    return traceId;
  }

  /**
   * End a trace with results
   * @param {string} traceId - Trace ID returned from startTrace
   * @param {Object} result - Result object with success status and optional error
   */
  endTrace(traceId, result = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) {
      console.warn(`⚠️ Trace not found: ${traceId}`);
      return;
    }
    
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.success = result.success !== false; // Default to true unless explicitly false
    trace.error = result.error || null;
    
    if (this.config.enableConsole) {
      const status = trace.success ? '✅' : '❌';
      console.log(`${status} TRACE END: ${trace.name} [${traceId}] - ${trace.duration}ms`, {
        success: trace.success,
        error: trace.error
      });
    }
  }

  /**
   * Log an error message with context
   * @param {string} message - Error message
   * @param {Object} context - Additional context information
   */
  error(message, context = {}) {
    this._log('error', message, context);
  }

  /**
   * Log an info message with context
   * @param {string} message - Info message
   * @param {Object} context - Additional context information
   */
  info(message, context = {}) {
    this._log('info', message, context);
  }

  /**
   * Log a warning message with context
   * @param {string} message - Warning message
   * @param {Object} context - Additional context information
   */
  warn(message, context = {}) {
    this._log('warn', message, context);
  }

  /**
   * Log a debug message with context
   * @param {string} message - Debug message
   * @param {Object} context - Additional context information
   */
  debug(message, context = {}) {
    this._log('debug', message, context);
  }

  /**
   * Internal logging method
   * @private
   */
  _log(level, message, context) {
    // Check if we should log this level
    if (this.logLevels[level] > this.logLevels[this.config.logLevel]) {
      return;
    }
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message,
      context: context,
      traceId: context.traceId || null
    };
    
    this.logs.push(logEntry);
    
    // Cleanup old logs if we exceed the limit
    if (this.logs.length > this.config.maxLogs) {
      this.logs = this.logs.slice(-this.config.maxLogs);
    }
    
    if (this.config.enableConsole) {
      const emoji = this._getLogEmoji(level);
      console.log(`${emoji} [${level.toUpperCase()}] ${message}`, context);
    }
  }

  /**
   * Get emoji for log level
   * @private
   */
  _getLogEmoji(level) {
    const emojis = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      debug: '🐛'
    };
    return emojis[level] || '📝';
  }

  /**
   * Build metric key with tags
   * @private
   */
  _buildMetricKey(metricName, tags) {
    if (Object.keys(tags).length === 0) {
      return metricName;
    }
    const tagString = Object.entries(tags)
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join(',');
    return `${metricName}{${tagString}}`;
  }

  /**
   * Get all metrics
   * @returns {Object} - Object containing all metrics
   */
  getMetrics() {
    const metricsObj = {};
    for (const [key, value] of this.metrics.entries()) {
      metricsObj[key] = value;
    }
    return metricsObj;
  }

  /**
   * Get metrics by name pattern
   * @param {string} pattern - Pattern to match metric names
   * @returns {Object} - Filtered metrics
   */
  getMetricsByPattern(pattern) {
    const filtered = {};
    for (const [key, value] of this.metrics.entries()) {
      if (key.includes(pattern)) {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  /**
   * Get all logs with optional filtering
   * @param {Object} filters - Filter options
   * @returns {Array} - Array of log entries
   */
  getLogs(filters = {}) {
    let filteredLogs = [...this.logs];
    
    if (filters.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filters.level);
    }
    
    if (filters.since) {
      const sinceTime = new Date(filters.since).getTime();
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp).getTime() >= sinceTime
      );
    }
    
    if (filters.until) {
      const untilTime = new Date(filters.until).getTime();
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp).getTime() <= untilTime
      );
    }
    
    if (filters.message) {
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(filters.message.toLowerCase())
      );
    }
    
    if (filters.limit) {
      filteredLogs = filteredLogs.slice(-filters.limit);
    }
    
    return filteredLogs;
  }

  /**
   * Get all traces
   * @returns {Array} - Array of trace objects
   */
  getTraces() {
    return Array.from(this.traces.values());
  }

  /**
   * Get traces by name pattern
   * @param {string} pattern - Pattern to match trace names
   * @returns {Array} - Filtered traces
   */
  getTracesByPattern(pattern) {
    return Array.from(this.traces.values())
      .filter(trace => trace.name.includes(pattern));
  }

  /**
   * Get trace by ID
   * @param {string} traceId - Trace ID
   * @returns {Object|null} - Trace object or null if not found
   */
  getTrace(traceId) {
    return this.traces.get(traceId) || null;
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    this.metrics.clear();
    if (this.config.enableConsole) {
      console.log('🔄 METRICS RESET');
    }
  }

  /**
   * Reset all traces
   */
  resetTraces() {
    this.traces.clear();
    if (this.config.enableConsole) {
      console.log('🔄 TRACES RESET');
    }
  }

  /**
   * Reset all logs
   */
  resetLogs() {
    this.logs = [];
    if (this.config.enableConsole) {
      console.log('🔄 LOGS RESET');
    }
  }

  /**
   * Reset all observability data
   */
  reset() {
    this.resetMetrics();
    this.resetTraces();
    this.resetLogs();
  }

  /**
   * Get service health status
   * @returns {Object} - Health status information
   */
  getHealth() {
    return {
      status: 'healthy',
      metrics: this.metrics.size,
      traces: this.traces.size,
      logs: this.logs.length,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get service statistics
   * @returns {Object} - Service statistics
   */
  getStats() {
    const traces = Array.from(this.traces.values());
    const completedTraces = traces.filter(t => t.endTime !== null);
    const avgDuration = completedTraces.length > 0 
      ? completedTraces.reduce((sum, t) => sum + t.duration, 0) / completedTraces.length 
      : 0;
    
    const logsByLevel = {};
    this.logs.forEach(log => {
      logsByLevel[log.level] = (logsByLevel[log.level] || 0) + 1;
    });
    
    return {
      metrics: {
        total: this.metrics.size,
        top: this._getTopMetrics(5)
      },
      traces: {
        total: this.traces.size,
        completed: completedTraces.length,
        averageDuration: Math.round(avgDuration),
        successRate: completedTraces.length > 0 
          ? (completedTraces.filter(t => t.success).length / completedTraces.length * 100).toFixed(2) + '%'
          : 'N/A'
      },
      logs: {
        total: this.logs.length,
        byLevel: logsByLevel,
        recent: this.logs.slice(-10)
      }
    };
  }

  /**
   * Get top metrics by value
   * @private
   */
  _getTopMetrics(limit) {
    return Array.from(this.metrics.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, value]) => ({ metric: key, value }));
  }

  /**
   * Get system metrics with time range filtering
   * @param {string} timeRange - Time range (1h, 6h, 24h, 7d)
   * @returns {Object} - System metrics aggregated by time range
   */
  async getSystemMetrics(timeRange = '1h') {
    const timeRangeMs = this._parseTimeRange(timeRange);
    const since = new Date(Date.now() - timeRangeMs);

    try {
      // Get call metrics from database
      const calls = await CallRecord.find({
        createdAt: { $gte: since }
      }).select('callStatus result metrics audioQuality duration createdAt');

      const totalCalls = calls.length;
      const completedCalls = calls.filter(c => c.callStatus === 'completed').length;
      const failedCalls = calls.filter(c => c.callStatus === 'failed' || c.result === 'error').length;
      const errorRate = totalCalls > 0 ? (failedCalls / totalCalls) * 100 : 0;

      // Calculate average latency
      const latencies = calls
        .map(c => c.audioQuality?.latency || c.metrics?.aiResponseTime)
        .filter(l => l != null);
      const avgLatency = latencies.length > 0
        ? Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length)
        : 0;

      // Calculate average MOS score
      const mosScores = calls
        .map(c => c.audioQuality?.mosScore)
        .filter(m => m != null);
      const avgMOS = mosScores.length > 0
        ? (mosScores.reduce((sum, m) => sum + m, 0) / mosScores.length).toFixed(1)
        : '0.0';

      // Get in-memory metrics
      const inMemoryMetrics = this.getMetrics();

      return {
        calls: {
          total: totalCalls,
          completed: completedCalls,
          failed: failedCalls,
          errorRate: errorRate.toFixed(2) + '%'
        },
        performance: {
          avgLatency: avgLatency,
          avgMOS: avgMOS,
          p95Latency: this._calculatePercentile(latencies, 95),
          p99Latency: this._calculatePercentile(latencies, 99)
        },
        system: inMemoryMetrics,
        timeRange: timeRange,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.error('Error getting system metrics', { error: error.message });
      return {
        calls: { total: 0, completed: 0, failed: 0, errorRate: '0%' },
        performance: { avgLatency: 0, avgMOS: '0.0', p95Latency: 0, p99Latency: 0 },
        system: this.getMetrics(),
        timeRange: timeRange,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get performance metrics by operation
   * @param {string} timeRange - Time range (1h, 6h, 24h, 7d)
   * @param {string} operation - Optional operation name filter
   * @returns {Object} - Performance metrics
   */
  async getPerformanceMetrics(timeRange = '1h', operation = null) {
    const timeRangeMs = this._parseTimeRange(timeRange);
    const since = new Date(Date.now() - timeRangeMs);

    try {
      // Get traces for the time range
      const traces = Array.from(this.traces.values())
        .filter(t => t.startTime >= since.getTime())
        .filter(t => !operation || t.name.includes(operation));

      const completedTraces = traces.filter(t => t.endTime !== null);
      
      // Group by hour for chart data
      const hourlyData = this._groupTracesByHour(completedTraces, since);

      return {
        traces: {
          total: traces.length,
          completed: completedTraces.length,
          failed: completedTraces.filter(t => !t.success).length
        },
        performance: {
          avgDuration: completedTraces.length > 0
            ? Math.round(completedTraces.reduce((sum, t) => sum + t.duration, 0) / completedTraces.length)
            : 0,
          p95Duration: this._calculatePercentile(
            completedTraces.map(t => t.duration),
            95
          ),
          p99Duration: this._calculatePercentile(
            completedTraces.map(t => t.duration),
            99
          )
        },
        hourlyData: hourlyData,
        operation: operation,
        timeRange: timeRange
      };
    } catch (error) {
      this.error('Error getting performance metrics', { error: error.message });
      return {
        traces: { total: 0, completed: 0, failed: 0 },
        performance: { avgDuration: 0, p95Duration: 0, p99Duration: 0 },
        hourlyData: [],
        operation: operation,
        timeRange: timeRange
      };
    }
  }

  /**
   * Get live/active calls
   * @returns {Array} - Array of active call records
   */
  async getLiveCalls() {
    try {
      const activeStatuses = ['queued', 'ringing', 'in-progress'];
      const calls = await CallRecord.find({
        callStatus: { $in: activeStatuses }
      })
        .select('callSid from to callStatus createdAt duration metrics audioQuality language')
        .sort({ createdAt: -1 })
        .limit(100);

      return calls.map(call => ({
        callSid: call.callSid,
        from: call.from,
        to: call.to,
        status: call.callStatus,
        duration: call.duration || Math.floor((Date.now() - call.createdAt.getTime()) / 1000),
        latency: call.audioQuality?.latency || call.metrics?.aiResponseTime || 0,
        mosScore: call.audioQuality?.mosScore || null,
        language: call.language,
        startedAt: call.createdAt
      }));
    } catch (error) {
      this.error('Error getting live calls', { error: error.message });
      return [];
    }
  }

  /**
   * Get per-call timeline
   * @param {string} callSid - Call SID
   * @returns {Object} - Call timeline with events
   */
  async getCallTimeline(callSid) {
    try {
      const call = await CallRecord.findOne({ callSid }).select(
        'callSid from to callStatus createdAt updatedAt transcript duration metrics audioQuality escalation complaint toolsUsed provenance'
      );

      if (!call) {
        return null;
      }

      const context = await ConversationContext.findOne({ callSid }).select('messages summaries truncationHistory');

      const timeline = [];

      // Call start
      timeline.push({
        timestamp: call.createdAt,
        type: 'call_start',
        data: { from: call.from, to: call.to, entryPath: call.entryPath }
      });

      // Transcript events
      if (call.transcript && call.transcript.length > 0) {
        call.transcript.forEach((turn, index) => {
          timeline.push({
            timestamp: turn.timestamp,
            type: 'transcript',
            data: {
              role: turn.role,
              text: turn.text.substring(0, 100) + (turn.text.length > 100 ? '...' : ''),
              confidence: turn.confidence
            }
          });
        });
      }

      // Tool executions
      if (call.toolsUsed && call.toolsUsed.length > 0) {
        call.toolsUsed.forEach(tool => {
          timeline.push({
            timestamp: tool.timestamp,
            type: 'tool_execution',
            data: {
              toolName: tool.toolName,
              executionTime: tool.executionTime,
              success: tool.success
            }
          });
        });
      }

      // KB retrievals
      if (call.provenance && call.provenance.length > 0) {
        call.provenance.forEach(prov => {
          timeline.push({
            timestamp: prov.timestamp,
            type: 'kb_retrieval',
            data: {
              fileName: prov.fileName,
              similarityScore: prov.similarityScore
            }
          });
        });
      }

      // Escalation
      if (call.escalation && call.escalation.escalated) {
        timeline.push({
          timestamp: call.escalation.escalatedAt,
          type: 'escalation',
          data: {
            reason: call.escalation.reason,
            targetNumber: call.escalation.targetNumber
          }
        });
      }

      // Complaint
      if (call.complaint && call.complaint.hasComplaint) {
        timeline.push({
          timestamp: call.complaint.complaintSubmittedAt,
          type: 'complaint',
          data: {
            status: call.complaint.complaintStatus
          }
        });
      }

      // Context truncations
      if (context && context.truncationHistory) {
        context.truncationHistory.forEach(trunc => {
          timeline.push({
            timestamp: trunc.timestamp,
            type: 'context_truncation',
            data: {
              tokensBefore: trunc.tokensBefore,
              tokensAfter: trunc.tokensAfter,
              strategy: trunc.strategy
            }
          });
        });
      }

      // Call end
      if (call.callStatus === 'completed' || call.callStatus === 'failed') {
        timeline.push({
          timestamp: call.updatedAt,
          type: 'call_end',
          data: {
            status: call.callStatus,
            result: call.result,
            duration: call.duration
          }
        });
      }

      // Sort by timestamp
      timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      return {
        callSid: call.callSid,
        from: call.from,
        to: call.to,
        status: call.callStatus,
        duration: call.duration,
        timeline: timeline,
        summary: {
          totalEvents: timeline.length,
          transcriptTurns: call.transcript?.length || 0,
          toolExecutions: call.toolsUsed?.length || 0,
          kbRetrievals: call.provenance?.length || 0
        }
      };
    } catch (error) {
      this.error('Error getting call timeline', { callSid, error: error.message });
      return null;
    }
  }

  /**
   * Get tool execution traces for a call
   * @param {string} callSid - Call SID
   * @returns {Array} - Array of tool execution traces
   */
  async getCallToolTraces(callSid) {
    try {
      const call = await CallRecord.findOne({ callSid }).select('toolsUsed toolTraceId');
      const context = await ConversationContext.findOne({ callSid }).select('messages');

      const traces = [];

      // Get tool executions from call record
      if (call && call.toolsUsed) {
        call.toolsUsed.forEach(tool => {
          traces.push({
            toolName: tool.toolName,
            timestamp: tool.timestamp,
            executionTime: tool.executionTime,
            success: tool.success,
            source: 'call_record'
          });
        });
      }

      // Get tool calls from conversation context
      if (context && context.messages) {
        context.messages.forEach((msg, index) => {
          if (msg.role === 'tool' || (msg.toolCalls && msg.toolCalls.length > 0)) {
            const toolCalls = msg.toolCalls || [{ name: 'unknown', id: msg.toolCallId }];
            toolCalls.forEach(toolCall => {
              traces.push({
                toolName: toolCall.name || toolCall.function?.name || 'unknown',
                timestamp: msg.timestamp,
                toolCallId: toolCall.id || msg.toolCallId,
                content: msg.content?.substring(0, 200),
                source: 'conversation_context',
                messageIndex: index
              });
            });
          }
        });
      }

      // Sort by timestamp
      traces.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      return traces;
    } catch (error) {
      this.error('Error getting call tool traces', { callSid, error: error.message });
      return [];
    }
  }

  /**
   * Get error budgets
   * @param {string} timeRange - Time range (1h, 6h, 24h, 7d)
   * @returns {Object} - Error budget information
   */
  async getErrorBudgets(timeRange = '24h') {
    const timeRangeMs = this._parseTimeRange(timeRange);
    const since = new Date(Date.now() - timeRangeMs);

    try {
      const calls = await CallRecord.find({
        createdAt: { $gte: since }
      }).select('callStatus result metrics errorCount');

      const totalCalls = calls.length;
      const failedCalls = calls.filter(c => 
        c.callStatus === 'failed' || c.result === 'error'
      ).length;
      const errorRate = totalCalls > 0 ? (failedCalls / totalCalls) * 100 : 0;

      // Error budget: 99% success rate target
      const targetErrorRate = 1.0; // 1% error rate target
      const errorBudget = targetErrorRate - errorRate;
      const budgetRemaining = Math.max(0, errorBudget);
      const budgetConsumed = Math.max(0, errorRate - targetErrorRate);

      // Get error logs
      const errorLogs = this.getLogs({ level: 'error', since: since.toISOString() });
      const errorCount = errorLogs.length;

      return {
        timeRange: timeRange,
        calls: {
          total: totalCalls,
          successful: totalCalls - failedCalls,
          failed: failedCalls,
          errorRate: errorRate.toFixed(2) + '%'
        },
        errorBudget: {
          target: targetErrorRate + '%',
          current: errorRate.toFixed(2) + '%',
          remaining: budgetRemaining.toFixed(2) + '%',
          consumed: budgetConsumed.toFixed(2) + '%',
          status: errorRate <= targetErrorRate ? 'within_budget' : 'exceeded'
        },
        errors: {
          total: errorCount,
          byComponent: this._groupErrorsByComponent(errorLogs)
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.error('Error getting error budgets', { error: error.message });
      return {
        timeRange: timeRange,
        calls: { total: 0, successful: 0, failed: 0, errorRate: '0%' },
        errorBudget: {
          target: '1%',
          current: '0%',
          remaining: '1%',
          consumed: '0%',
          status: 'within_budget'
        },
        errors: { total: 0, byComponent: {} },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get alerts
   * @param {Object} filters - Filter options
   * @returns {Array} - Array of alerts
   */
  getAlerts(filters = {}) {
    let alerts = Array.from(this.alerts.values());

    if (filters.status) {
      alerts = alerts.filter(a => a.status === filters.status);
    }

    if (filters.severity) {
      alerts = alerts.filter(a => a.severity === filters.severity);
    }

    if (filters.since) {
      const sinceTime = new Date(filters.since).getTime();
      alerts = alerts.filter(a => new Date(a.createdAt).getTime() >= sinceTime);
    }

    // Sort by createdAt descending
    alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (filters.limit) {
      alerts = alerts.slice(0, filters.limit);
    }

    return alerts;
  }

  /**
   * Create a new alert
   * @param {Object} alertData - Alert data
   * @returns {Object} - Created alert
   */
  createAlert(alertData) {
    const alertId = `alert_${Date.now()}_${++this.alertCounter}`;
    const alert = {
      id: alertId,
      title: alertData.title || 'Alert',
      message: alertData.message || '',
      severity: alertData.severity || 'warning', // critical, warning, info
      status: 'active', // active, acknowledged, resolved
      component: alertData.component || 'system',
      metadata: alertData.metadata || {},
      createdAt: new Date().toISOString(),
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolvedBy: null
    };

    this.alerts.set(alertId, alert);

    // Cleanup old alerts if we exceed the limit
    if (this.alerts.size > this.config.maxAlerts) {
      const oldestAlert = Array.from(this.alerts.values())
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
      this.alerts.delete(oldestAlert.id);
    }

    this.warn('Alert created', { alertId, severity: alert.severity, title: alert.title });

    return alert;
  }

  /**
   * Acknowledge an alert
   * @param {string} alertId - Alert ID
   * @param {string} userId - User ID who acknowledged
   * @returns {Object|null} - Updated alert or null if not found
   */
  acknowledgeAlert(alertId, userId) {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return null;
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = userId;

    this.info('Alert acknowledged', { alertId, userId });

    return alert;
  }

  /**
   * Resolve an alert
   * @param {string} alertId - Alert ID
   * @param {string} userId - User ID who resolved
   * @returns {Object|null} - Updated alert or null if not found
   */
  resolveAlert(alertId, userId) {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return null;
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();
    alert.resolvedBy = userId;

    this.info('Alert resolved', { alertId, userId });

    return alert;
  }

  /**
   * Export observability data
   * @param {string} format - Export format (json, csv)
   * @param {Object} filters - Filter options
   * @returns {Object} - Export data
   */
  exportData(format = 'json', filters = {}) {
    const data = {
      timestamp: new Date().toISOString(),
      metrics: this.getMetrics(),
      logs: this.getLogs(filters),
      traces: filters.tracePattern
        ? this.getTracesByPattern(filters.tracePattern)
        : this.getTraces(),
      alerts: this.getAlerts(filters)
    };

    if (format === 'csv') {
      // Convert to CSV format (simplified)
      return {
        format: 'csv',
        data: this._convertToCSV(data),
        filename: `observability_export_${Date.now()}.csv`
      };
    }

    return {
      format: 'json',
      data: data,
      filename: `observability_export_${Date.now()}.json`
    };
  }

  /**
   * Parse time range string to milliseconds
   * @private
   */
  _parseTimeRange(timeRange) {
    const ranges = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    return ranges[timeRange] || ranges['1h'];
  }

  /**
   * Calculate percentile
   * @private
   */
  _calculatePercentile(values, percentile) {
    if (!values || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  /**
   * Group traces by hour for chart data
   * @private
   */
  _groupTracesByHour(traces, since) {
    const hourlyData = {};
    traces.forEach(trace => {
      const hour = new Date(trace.startTime).toISOString().substring(0, 13) + ':00';
      if (!hourlyData[hour]) {
        hourlyData[hour] = {
          time: hour,
          avgLatency: 0,
          p95Latency: 0,
          p99Latency: 0,
          count: 0,
          durations: []
        };
      }
      hourlyData[hour].durations.push(trace.duration);
      hourlyData[hour].count++;
    });

    return Object.values(hourlyData).map(hour => {
      const sorted = [...hour.durations].sort((a, b) => a - b);
      return {
        time: hour.time.substring(11, 16), // HH:MM format
        avgLatency: Math.round(hour.durations.reduce((sum, d) => sum + d, 0) / hour.durations.length),
        p95Latency: this._calculatePercentile(sorted, 95),
        p99Latency: this._calculatePercentile(sorted, 99),
        count: hour.count
      };
    }).sort((a, b) => a.time.localeCompare(b.time));
  }

  /**
   * Group errors by component
   * @private
   */
  _groupErrorsByComponent(errorLogs) {
    const byComponent = {};
    errorLogs.forEach(log => {
      const component = log.context?.component || 'unknown';
      byComponent[component] = (byComponent[component] || 0) + 1;
    });
    return byComponent;
  }

  /**
   * Convert data to CSV format
   * @private
   */
  _convertToCSV(data) {
    // Simplified CSV conversion - in production, use a proper CSV library
    let csv = 'Timestamp,Level,Message,Component\n';
    data.logs.forEach(log => {
      const component = log.context?.component || 'unknown';
      csv += `"${log.timestamp}","${log.level}","${log.message.replace(/"/g, '""')}","${component}"\n`;
    });
    return csv;
  }
}

// Create and export singleton instance
const observabilityService = new ObservabilityService();
export default observabilityService;
