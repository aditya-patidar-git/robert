import fs from 'fs';
import path from 'path';

class ObservabilityService {
  constructor() {
    this.metrics = new Map();
    this.logs = [];
    this.traces = [];
    this.alerts = [];
    this.performanceData = new Map();
    this.initializeMetrics();
  }

  initializeMetrics() {
    // System metrics
    this.metrics.set('system.cpu_usage', 0);
    this.metrics.set('system.memory_usage', 0);
    this.metrics.set('system.disk_usage', 0);
    this.metrics.set('system.network_io', 0);
    
    // Application metrics
    this.metrics.set('app.active_calls', 0);
    this.metrics.set('app.total_calls', 0);
    this.metrics.set('app.successful_calls', 0);
    this.metrics.set('app.failed_calls', 0);
    this.metrics.set('app.avg_response_time', 0);
    this.metrics.set('app.error_rate', 0);
    
    // AI metrics
    this.metrics.set('ai.total_requests', 0);
    this.metrics.set('ai.successful_requests', 0);
    this.metrics.set('ai.failed_requests', 0);
    this.metrics.set('ai.avg_processing_time', 0);
    this.metrics.set('ai.tool_usage', new Map());
    
    // Telephony metrics
    this.metrics.set('telephony.inbound_calls', 0);
    this.metrics.set('telephony.outbound_calls', 0);
    this.metrics.set('telephony.transfers', 0);
    this.metrics.set('telephony.avg_call_duration', 0);
    this.metrics.set('telephony.call_quality', 0);
  }

  // Metrics Collection
  recordMetric(metricName, value, tags = {}) {
    const timestamp = new Date().toISOString();
    
    if (this.metrics.has(metricName)) {
      this.metrics.set(metricName, value);
    } else {
      this.metrics.set(metricName, value);
    }
    
    // Store metric with timestamp and tags
    const metricRecord = {
      name: metricName,
      value,
      tags,
      timestamp
    };
    
    this.logMetric(metricRecord);
  }

  incrementMetric(metricName, increment = 1, tags = {}) {
    const currentValue = this.metrics.get(metricName) || 0;
    this.recordMetric(metricName, currentValue + increment, tags);
  }

  getMetric(metricName) {
    return this.metrics.get(metricName);
  }

  getAllMetrics() {
    const metrics = {};
    for (const [name, value] of this.metrics) {
      metrics[name] = value;
    }
    return metrics;
  }

  // Logging
  log(level, message, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      service: 'robert-ai'
    };
    
    this.logs.push(logEntry);
    
    // Keep only last 1000 logs in memory
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
    
    // Write to file
    this.writeLogToFile(logEntry);
    
    console.log(`[${level.toUpperCase()}] ${message}`, context);
  }

  info(message, context = {}) {
    this.log('info', message, context);
  }

  warn(message, context = {}) {
    this.log('warn', message, context);
  }

  error(message, context = {}) {
    this.log('error', message, context);
  }

  debug(message, context = {}) {
    this.log('debug', message, context);
  }

  // Tracing
  startTrace(operationName, context = {}) {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const spanId = `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const trace = {
      traceId,
      spanId,
      operationName,
      startTime: Date.now(),
      context,
      status: 'started'
    };
    
    this.traces.push(trace);
    return traceId;
  }

  endTrace(traceId, result = {}) {
    const trace = this.traces.find(t => t.traceId === traceId);
    if (trace) {
      trace.endTime = Date.now();
      trace.duration = trace.endTime - trace.startTime;
      trace.status = 'completed';
      trace.result = result;
      
      this.logMetric('trace.duration', trace.duration, { operation: trace.operationName });
    }
  }

  // Performance Monitoring
  recordPerformance(operation, duration, metadata = {}) {
    const perfData = {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      metadata
    };
    
    if (!this.performanceData.has(operation)) {
      this.performanceData.set(operation, []);
    }
    
    const operationData = this.performanceData.get(operation);
    operationData.push(perfData);
    
    // Keep only last 100 performance records per operation
    if (operationData.length > 100) {
      operationData.splice(0, operationData.length - 100);
    }
    
    this.recordMetric(`performance.${operation}`, duration);
  }

  getPerformanceData(operation) {
    return this.performanceData.get(operation) || [];
  }

  getPerformanceSummary(operation) {
    const data = this.getPerformanceData(operation);
    if (data.length === 0) return null;
    
    const durations = data.map(d => d.duration);
    return {
      operation,
      count: data.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p95Duration: this.percentile(durations, 0.95),
      p99Duration: this.percentile(durations, 0.99)
    };
  }

  percentile(arr, p) {
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }

  // Alerting
  createAlert(alertType, severity, message, context = {}) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: alertType,
      severity,
      message,
      context,
      timestamp: new Date().toISOString(),
      status: 'active',
      acknowledged: false
    };
    
    this.alerts.push(alert);
    
    // Send alert notification
    this.sendAlertNotification(alert);
    
    return alert;
  }

  acknowledgeAlert(alertId, acknowledgedBy) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date().toISOString();
    }
  }

  resolveAlert(alertId, resolvedBy) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedBy = resolvedBy;
      alert.resolvedAt = new Date().toISOString();
    }
  }

  getActiveAlerts() {
    return this.alerts.filter(a => a.status === 'active');
  }

  // Health Checks
  async performHealthCheck() {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {}
    };
    
    // Database health
    healthCheck.checks.database = await this.checkDatabaseHealth();
    
    // AI service health
    healthCheck.checks.ai = await this.checkAIHealth();
    
    // Telephony health
    healthCheck.checks.telephony = await this.checkTelephonyHealth();
    
    // Overall status
    const allChecks = Object.values(healthCheck.checks);
    healthCheck.status = allChecks.every(check => check.status === 'healthy') ? 'healthy' : 'unhealthy';
    
    return healthCheck;
  }

  async checkDatabaseHealth() {
    try {
      // In a real implementation, this would check database connection
      return {
        status: 'healthy',
        responseTime: 50,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }

  async checkAIHealth() {
    try {
      // In a real implementation, this would check AI service
      return {
        status: 'healthy',
        responseTime: 200,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }

  async checkTelephonyHealth() {
    try {
      // In a real implementation, this would check Twilio connection
      return {
        status: 'healthy',
        responseTime: 100,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }

  // Reporting
  generateReport(period = 'hourly') {
    const report = {
      period,
      generatedAt: new Date().toISOString(),
      metrics: this.getAllMetrics(),
      performance: this.getPerformanceSummary('all'),
      alerts: this.getActiveAlerts().length,
      health: 'healthy' // Would be determined by health check
    };
    
    return report;
  }

  // File Operations
  writeLogToFile(logEntry) {
    try {
      const logDir = './logs';
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const logFile = path.join(logDir, `app_${new Date().toISOString().split('T')[0]}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }

  logMetric(metricRecord) {
    try {
      const metricsDir = './metrics';
      if (!fs.existsSync(metricsDir)) {
        fs.mkdirSync(metricsDir, { recursive: true });
      }
      
      const metricsFile = path.join(metricsDir, `metrics_${new Date().toISOString().split('T')[0]}.json`);
      const metricLine = JSON.stringify(metricRecord) + '\n';
      
      fs.appendFileSync(metricsFile, metricLine);
    } catch (error) {
      console.error('Failed to write metric to file:', error);
    }
  }

  sendAlertNotification(alert) {
    // In a real implementation, this would send notifications via email, Slack, etc.
    console.log(`🚨 ALERT [${alert.severity.toUpperCase()}] ${alert.message}`, alert.context);
  }
}

export default new ObservabilityService();
