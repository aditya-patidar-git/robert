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
    this.initializeSampleLogs();
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
    
    // Business metrics - Initialize with sample data for demo
    this.metrics.set('business.total_calls', 1247);
    this.metrics.set('business.active_calls', 3);
    this.metrics.set('business.total_bookings', 89);
    this.metrics.set('business.total_users', 156);
    
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

  initializeSampleLogs() {
    // Add some sample logs for demo purposes
    const sampleLogs = [
      {
        timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
        level: 'error',
        message: 'Database connection timeout',
        context: { service: 'database', retryCount: 3 },
        service: 'robert-ai'
      },
      {
        timestamp: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
        level: 'warn',
        message: 'High memory usage detected',
        context: { memoryUsage: '85%', threshold: '80%' },
        service: 'robert-ai'
      },
      {
        timestamp: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
        level: 'error',
        message: 'AI service response timeout',
        context: { service: 'openai', timeout: '30s' },
        service: 'robert-ai'
      }
    ];
    
    this.logs = sampleLogs;
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

}

export default new ObservabilityService();
