/**
 * Observability Service (Facade)
 * Provides a unified interface to all observability services
 * This is a facade that delegates to specialized services
 */

import inMemoryMetricsService from './observability/inMemoryMetricsService.js';
import loggingService from './observability/loggingService.js';
import tracingService from './observability/tracingService.js';
import alertService from './observability/alertService.js';
import callAnalyticsService from './observability/callAnalyticsService.js';

/**
 * Observability Service Facade
 * Maintains backward compatibility while delegating to specialized services
 */
class ObservabilityService {
  constructor() {
    // Delegate to specialized services
    this.metrics = inMemoryMetricsService;
    this.logs = loggingService;
    this.traces = tracingService;
    this.alerts = alertService;
    this.analytics = callAnalyticsService;
    this.startTime = Date.now();
  }

  /**
   * Get health status (safe for protected observability dashboard).
   * @returns {{ status: string, uptime: number }}
   */
  getHealth() {
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    return { status: 'ok', uptime };
  }

  // ==================== Metrics Methods ====================

  /**
   * Increment a metric counter
   * @param {string} metricName - Name of the metric to increment
   * @param {number} value - Value to increment by (default: 1)
   * @param {Object} tags - Optional tags for the metric
   */
  incrementMetric(metricName, value = 1, tags = {}) {
    return this.metrics.incrementMetric(metricName, value, tags);
  }

  /**
   * Get all metrics
   * @returns {Object} - Object containing all metrics
   */
  getMetrics() {
    return this.metrics.getMetrics();
  }

  /**
   * Get metrics by name pattern
   * @param {string} pattern - Pattern to match metric names
   * @returns {Object} - Filtered metrics
   */
  getMetricsByPattern(pattern) {
    return this.metrics.getMetricsByPattern(pattern);
  }

  // ==================== Tracing Methods ====================

  /**
   * Start a new trace for performance monitoring
   * @param {string} traceName - Name of the trace
   * @param {Object} metadata - Additional metadata for the trace
   * @returns {string} - Trace ID for correlation
   */
  startTrace(traceName, metadata = {}) {
    return this.traces.startTrace(traceName, metadata);
  }

  /**
   * End a trace with results
   * @param {string} traceId - Trace ID returned from startTrace
   * @param {Object} result - Result object with success status and optional error
   */
  endTrace(traceId, result = {}) {
    return this.traces.endTrace(traceId, result);
  }

  /**
   * Get all traces
   * @returns {Array} - Array of trace objects
   */
  getTraces() {
    return this.traces.getTraces();
  }

  /**
   * Get traces by name pattern
   * @param {string} pattern - Pattern to match trace names
   * @returns {Array} - Filtered traces
   */
  getTracesByPattern(pattern) {
    return this.traces.getTracesByPattern(pattern);
  }

  /**
   * Get trace by ID
   * @param {string} traceId - Trace ID
   * @returns {Object|null} - Trace object or null if not found
   */
  getTrace(traceId) {
    return this.traces.getTrace(traceId);
  }

  // ==================== Logging Methods ====================

  /**
   * Log an error message with context
   * @param {string} message - Error message
   * @param {Object} context - Additional context information
   */
  error(message, context = {}) {
    return this.logs.error(message, context);
  }

  /**
   * Log an info message with context
   * @param {string} message - Info message
   * @param {Object} context - Additional context information
   */
  info(message, context = {}) {
    return this.logs.info(message, context);
  }

  /**
   * Log a warning message with context
   * @param {string} message - Warning message
   * @param {Object} context - Additional context information
   */
  warn(message, context = {}) {
    return this.logs.warn(message, context);
  }

  /**
   * Log a debug message with context
   * @param {string} message - Debug message
   * @param {Object} context - Additional context information
   */
  debug(message, context = {}) {
    return this.logs.debug(message, context);
  }

  /**
   * Get all logs with optional filtering
   * @param {Object} filters - Filter options
   * @returns {Array} - Array of log entries
   */
  getLogs(filters = {}) {
    return this.logs.getLogs(filters);
  }

  // ==================== Alert Methods ====================

  /**
   * Get alerts
   * @param {Object} filters - Filter options
   * @returns {Array} - Array of alerts
   */
  getAlerts(filters = {}) {
    return this.alerts.getAlerts(filters);
  }

  /**
   * Create a new alert
   * @param {Object} alertData - Alert data
   * @returns {Object} - Created alert
   */
  createAlert(alertData) {
    return this.alerts.createAlert(alertData);
  }

  /**
   * Acknowledge an alert
   * @param {string} alertId - Alert ID
   * @param {string} userId - User ID who acknowledged
   * @returns {Object|null} - Updated alert or null if not found
   */
  acknowledgeAlert(alertId, userId) {
    return this.alerts.acknowledgeAlert(alertId, userId);
  }

  /**
   * Resolve an alert
   * @param {string} alertId - Alert ID
   * @param {string} userId - User ID who resolved
   * @returns {Object|null} - Updated alert or null if not found
   */
  resolveAlert(alertId, userId) {
    return this.alerts.resolveAlert(alertId, userId);
  }

  // ==================== Analytics Methods ====================

  /**
   * Get system metrics with time range filtering
   * @param {string} timeRange - Time range (1h, 6h, 24h, 7d)
   * @returns {Object} - System metrics aggregated by time range
   */
  async getSystemMetrics(timeRange = '1h') {
    const inMemoryMetrics = this.metrics.getMetrics();
    return this.analytics.getSystemMetrics(timeRange, inMemoryMetrics);
  }

  /**
   * Get performance metrics by operation
   * @param {string} timeRange - Time range (1h, 6h, 24h, 7d)
   * @param {string} operation - Optional operation name filter
   * @returns {Object} - Performance metrics with hourly call data
   */
  async getPerformanceMetrics(timeRange = '1h', operation = null) {
    return this.analytics.getPerformanceMetrics(timeRange, operation);
  }

  /**
   * Get live/active calls
   * @returns {Array} - Array of active call records
   */
  async getLiveCalls() {
    return this.analytics.getLiveCalls();
  }

  /**
   * Get per-call timeline
   * @param {string} callSid - Call SID
   * @returns {Object} - Call timeline with events
   */
  async getCallTimeline(callSid) {
    return this.analytics.getCallTimeline(callSid);
  }

  /**
   * Get tool execution traces for a call
   * @param {string} callSid - Call SID
   * @returns {Array} - Array of tool execution traces
   */
  async getCallToolTraces(callSid) {
    return this.analytics.getCallToolTraces(callSid);
  }

  /**
   * Get error budgets
   * @param {string} timeRange - Time range (1h, 6h, 24h, 7d)
   * @returns {Object} - Error budget information
   */
  async getErrorBudgets(timeRange = '24h') {
    return this.analytics.getErrorBudgets(timeRange, (filters) => this.logs.getLogs(filters));
  }

  // ==================== Export Methods ====================

  /**
   * Export observability data
   * @param {string} format - Export format ('json' or 'csv')
   * @param {Object} filters - Filter options
   * @returns {string} - Exported data as string
   */
  exportData(format = 'json', filters = {}) {
    const data = {
      metrics: this.metrics.getMetrics(),
      logs: this.logs.getLogs(filters),
      traces: this.traces.getTraces(),
      alerts: this.alerts.getAlerts(filters),
      timestamp: new Date().toISOString()
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csvLines = [];
      
      // Metrics CSV
      csvLines.push('Type,Metric,Value');
      Object.entries(data.metrics).forEach(([key, value]) => {
        csvLines.push(`metric,${key},${value}`);
      });
      
      // Logs CSV
      csvLines.push('\nType,Timestamp,Level,Message');
      data.logs.forEach(log => {
        csvLines.push(`log,${log.timestamp},${log.level},"${log.message.replace(/"/g, '""')}"`);
      });
      
      // Traces CSV
      csvLines.push('\nType,ID,Name,Duration,Success');
      data.traces.forEach(trace => {
        csvLines.push(`trace,${trace.id},${trace.name},${trace.duration || 0},${trace.success}`);
      });
      
      // Alerts CSV
      csvLines.push('\nType,ID,Title,Severity,Status');
      data.alerts.forEach(alert => {
        csvLines.push(`alert,${alert.id},${alert.title},${alert.severity},${alert.status}`);
      });
      
      return csvLines.join('\n');
    }

    // Default to JSON
    return JSON.stringify(data, null, 2);
  }

  // ==================== Reset Methods ====================

  /**
   * Reset all metrics
   */
  resetMetrics() {
    this.metrics.resetMetrics();
  }

  /**
   * Reset all logs
   */
  resetLogs() {
    this.logs.resetLogs();
  }

  /**
   * Reset all traces
   */
  resetTraces() {
    this.traces.resetTraces();
  }
}

// Export singleton instance
const observabilityService = new ObservabilityService();
export default observabilityService;
