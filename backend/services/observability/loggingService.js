/**
 * Logging Service
 * Handles structured logging with filtering
 */

import { maskLogPayload } from '../../utils/logPiiMasker.js';

const isPiiMaskingEnabled = () => {
  const v = process.env.PII_MASKING_ENABLED;
  return v === 'true' || v === '1';
};

class LoggingService {
  constructor() {
    this.logs = [];
    this.config = {
      maxLogs: 10000,
      logLevel: process.env.LOG_LEVEL || 'info',
      enableConsole: process.env.NODE_ENV !== 'production',
      piiMaskingEnabled: isPiiMaskingEnabled()
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
    if (this.logLevels[level] > this.logLevels[this.config.logLevel]) {
      return;
    }
    const ctx = context ?? {};
    const { message: msg, context: maskedCtx } = this.config.piiMaskingEnabled
      ? maskLogPayload(message, ctx)
      : { message, context: ctx };
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: msg,
      context: maskedCtx,
      traceId: maskedCtx.traceId ?? ctx.traceId ?? null
    };
    this.logs.push(logEntry);
    if (this.logs.length > this.config.maxLogs) {
      this.logs = this.logs.slice(-this.config.maxLogs);
    }
    if (this.config.enableConsole) {
      const emoji = this._getLogEmoji(level);
      console.log(`${emoji} [${level.toUpperCase()}] ${msg}`, maskedCtx);
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
   * Reset all logs
   */
  resetLogs() {
    this.logs = [];
    if (this.config.enableConsole) {
      console.log('🔄 LOGS RESET');
    }
  }
}

export default new LoggingService();

