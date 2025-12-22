/**
 * Alert Service
 * Handles alert management
 */

import loggingService from './loggingService.js';

class AlertService {
  constructor() {
    this.alerts = new Map(); // In-memory alerts storage
    this.alertCounter = 0;
    this.config = {
      maxAlerts: 500, // Maximum number of alerts to keep in memory
      enableConsole: process.env.NODE_ENV !== 'production' // Console logging in dev
    };
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

    loggingService.warn('Alert created', { alertId, severity: alert.severity, title: alert.title });

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

    loggingService.info('Alert acknowledged', { alertId, userId });

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

    loggingService.info('Alert resolved', { alertId, userId });

    return alert;
  }
}

export default new AlertService();

