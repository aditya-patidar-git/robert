/**
 * SIP Health Monitor
 * Monitors active SIP sessions, tracks usage, and logs failures
 */

import sipSessionManager from './sipSessionManager.js';
import sipStatusTracker from './sipStatusTracker.js';
import CallRecord from '../../database/models/CallRecord.js';
import Alert from '../../database/models/Alert.js';

class SipHealthMonitor {
  constructor() {
    this.metrics = {
      totalSipCalls: 0,
      totalMediaStreamsCalls: 0,
      sipFailures: 0,
      sipRetries: 0,
      lastFailure: null,
      lastSuccess: null
    };
    this.alertThreshold = {
      failureRate: 0.1, // 10% failure rate
      consecutiveFailures: 5
    };
    this.consecutiveFailures = 0;
  }

  /**
   * Track SIP call attempt
   * @param {string} callSid - Call SID
   * @param {string} method - 'SIP' or 'Media Streams'
   * @param {boolean} success - Whether call succeeded
   * @param {string} failureReason - Failure reason if failed
   */
  trackCall(callSid, method, success, failureReason = null) {
    if (method === 'SIP') {
      this.metrics.totalSipCalls++;
      if (!success) {
        this.metrics.sipFailures++;
        this.consecutiveFailures++;
        this.metrics.lastFailure = {
          callSid,
          timestamp: new Date(),
          reason: failureReason
        };
      } else {
        this.consecutiveFailures = 0;
        this.metrics.lastSuccess = {
          callSid,
          timestamp: new Date()
        };
      }
    } else {
      this.metrics.totalMediaStreamsCalls++;
    }

    // Check for alert conditions
    this.checkAlerts();
  }

  /**
   * Track SIP retry
   */
  trackRetry() {
    this.metrics.sipRetries++;
  }

  /**
   * Get current health status
   * @returns {Object} Health status
   */
  getHealthStatus() {
    const totalCalls = this.metrics.totalSipCalls;
    const failureRate = totalCalls > 0 
      ? this.metrics.sipFailures / totalCalls 
      : 0;
    
    const sipUsageRatio = (this.metrics.totalSipCalls + this.metrics.totalMediaStreamsCalls) > 0
      ? this.metrics.totalSipCalls / (this.metrics.totalSipCalls + this.metrics.totalMediaStreamsCalls)
      : 0;

    return {
      status: this.getStatus(failureRate),
      metrics: {
        ...this.metrics,
        failureRate: Math.round(failureRate * 10000) / 100, // Percentage with 2 decimals
        sipUsageRatio: Math.round(sipUsageRatio * 10000) / 100,
        activeSessions: sipSessionManager.getSessionCount()
      },
      alerts: {
        failureRateExceeded: failureRate > this.alertThreshold.failureRate,
        consecutiveFailures: this.consecutiveFailures >= this.alertThreshold.consecutiveFailures
      }
    };
  }

  /**
   * Get status based on metrics
   * @private
   * @param {number} failureRate - Failure rate
   * @returns {string} Status
   */
  getStatus(failureRate) {
    if (this.consecutiveFailures >= this.alertThreshold.consecutiveFailures) {
      return 'critical';
    }
    if (failureRate > this.alertThreshold.failureRate) {
      return 'warning';
    }
    return 'healthy';
  }

  /**
   * Check for alert conditions and trigger alerts if needed
   * Writes alerts directly to database (no HTTP calls or imports)
   * @private
   */
  async checkAlerts() {
    const healthStatus = this.getHealthStatus();
    
    if (healthStatus.alerts.failureRateExceeded || healthStatus.alerts.consecutiveFailures) {
      try {
        const alert = new Alert({
          title: 'SIP Health Alert',
          message: healthStatus.alerts.consecutiveFailures
            ? `SIP has ${this.consecutiveFailures} consecutive failures`
            : `SIP failure rate is ${healthStatus.metrics.failureRate}%, exceeding threshold of ${this.alertThreshold.failureRate * 100}%`,
          severity: healthStatus.status === 'critical' ? 'critical' : 'warning',
          component: 'sip',
          source: 'agent-service',
          metadata: {
            failureRate: healthStatus.metrics.failureRate,
            consecutiveFailures: this.consecutiveFailures,
            totalSipCalls: this.metrics.totalSipCalls,
            sipFailures: this.metrics.sipFailures,
            activeSessions: healthStatus.metrics.activeSessions,
            sipUsageRatio: healthStatus.metrics.sipUsageRatio
          }
        });

        await alert.save();
        console.log(`📢 [SIP Health Monitor] Created alert in database: ${alert.title}`);
      } catch (error) {
        console.warn('⚠️ [SIP Health Monitor] Failed to create alert:', error.message);
      }
    }
  }

  /**
   * Get SIP vs Media Streams usage statistics
   * @param {string} timeRange - Time range ('1h', '24h', '7d')
   * @returns {Promise<Object>} Usage statistics
   */
  async getUsageStatistics(timeRange = '24h') {
    try {
      const now = new Date();
      let hours = 24;
      
      switch (timeRange) {
        case '1h':
          hours = 1;
          break;
        case '24h':
          hours = 24;
          break;
        case '7d':
          hours = 24 * 7;
          break;
      }

      const startDate = new Date(now.getTime() - hours * 60 * 60 * 1000);

      const [sipCalls, totalCalls] = await Promise.all([
        CallRecord.countDocuments({
          createdAt: { $gte: startDate },
          entryPath: 'SIP'
        }),
        CallRecord.countDocuments({
          createdAt: { $gte: startDate }
        })
      ]);

      const mediaStreamsCalls = totalCalls - sipCalls;

      return {
        sip: {
          count: sipCalls,
          percentage: totalCalls > 0 ? Math.round((sipCalls / totalCalls) * 100) : 0
        },
        mediaStreams: {
          count: mediaStreamsCalls,
          percentage: totalCalls > 0 ? Math.round((mediaStreamsCalls / totalCalls) * 100) : 0
        },
        total: totalCalls
      };
    } catch (error) {
      console.error('Error getting usage statistics:', error);
      return {
        sip: { count: 0, percentage: 0 },
        mediaStreams: { count: 0, percentage: 0 },
        total: 0
      };
    }
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics() {
    this.metrics = {
      totalSipCalls: 0,
      totalMediaStreamsCalls: 0,
      sipFailures: 0,
      sipRetries: 0,
      lastFailure: null,
      lastSuccess: null
    };
    this.consecutiveFailures = 0;
  }
}

export default new SipHealthMonitor();

