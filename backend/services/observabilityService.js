/**
 * ObservabilityService - Comprehensive monitoring, metrics, and logging service
 * Provides metrics tracking, distributed tracing, structured logging, and error handling
 * for Twilio integrations and all backend controllers.
 */

class ObservabilityService {
  constructor() {
    // In-memory storage for metrics, traces, and logs
    this.metrics = new Map();
    this.traces = new Map();
    this.logs = [];
    this.traceCounter = 0;
    
    // Configuration
    this.config = {
      maxLogs: 10000, // Maximum number of logs to keep in memory
      maxTraces: 1000, // Maximum number of traces to keep in memory
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
}

// Create and export singleton instance
const observabilityService = new ObservabilityService();
export default observabilityService;
