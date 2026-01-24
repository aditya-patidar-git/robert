/**
 * Health Check Service
 * 
 * Single Responsibility: Collect and aggregate health metrics
 * - Memory usage
 * - Session status
 * - Browser pool status
 * - Distributed state status
 * - Active connections
 * - Overall system health determination
 * 
 * Reusable by: /health endpoint, monitoring systems, alerts
 */

import { conversations, realtimeClients } from '../shared/state.js';

/**
 * Health status enumeration
 */
export const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy'
};

/**
 * Thresholds for health determination
 */
const THRESHOLDS = {
  memory: {
    heapUsedPercent: {
      warning: 70,  // Degraded above 70%
      critical: 90  // Unhealthy above 90%
    }
  },
  sessions: {
    usagePercent: {
      warning: 80,  // Degraded above 80%
      critical: 95  // Unhealthy above 95%
    }
  },
  browserPool: {
    availablePercent: {
      warning: 20,  // Degraded below 20% available
      critical: 0   // Unhealthy at 0%
    }
  }
};

class HealthCheckService {
  constructor() {
    this.startTime = Date.now();
    this.lastCheckTime = null;
    this.checkCount = 0;
  }

  /**
   * Get current memory metrics
   * @returns {Object}
   */
  getMemoryMetrics() {
    const memUsage = process.memoryUsage();
    const heapTotal = memUsage.heapTotal;
    const heapUsed = memUsage.heapUsed;
    const heapUsedPercent = Math.round((heapUsed / heapTotal) * 100);

    return {
      heapUsed: Math.round(heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapUsedPercent,
      status: this.determineStatus(heapUsedPercent, THRESHOLDS.memory.heapUsedPercent)
    };
  }

  /**
   * Get session metrics
   * @param {Object} [sessionManagementService] - Optional service reference
   * @returns {Promise<Object>}
   */
  async getSessionMetrics(sessionManagementService = null) {
    // Try to get metrics from sessionManagementService if available
    if (sessionManagementService?.getSessionMetrics) {
      try {
        return await sessionManagementService.getSessionMetrics();
      } catch (error) {
        console.warn('[HealthCheck] Error getting session metrics:', error.message);
      }
    }

    // Fallback to basic metrics from state
    const sessionCount = Object.keys(conversations).length;
    const maxSessions = parseInt(process.env.MAX_SESSIONS || '100', 10);
    const usagePercent = Math.round((sessionCount / maxSessions) * 100);

    return {
      activeSessions: sessionCount,
      maxSessions,
      memoryUsagePercent: usagePercent,
      status: this.determineStatus(usagePercent, THRESHOLDS.sessions.usagePercent)
    };
  }

  /**
   * Get browser pool status
   * @param {Object} [browserAgentService] - Optional service reference
   * @returns {Object|null}
   */
  getBrowserPoolStatus(browserAgentService = null) {
    // Try to get pool status from browserAgentService
    if (browserAgentService?.getPoolStatus) {
      try {
        const poolStatus = browserAgentService.getPoolStatus();
        if (poolStatus) {
          const availablePercent = poolStatus.total > 0 
            ? Math.round((poolStatus.available / poolStatus.total) * 100)
            : 100;
          
          return {
            ...poolStatus,
            availablePercent,
            status: this.determinePoolStatus(poolStatus)
          };
        }
      } catch (error) {
        console.warn('[HealthCheck] Error getting browser pool status:', error.message);
      }
    }

    // Return null if pool not available
    return null;
  }

  /**
   * Determine pool health status
   * @param {Object} poolStatus
   * @returns {string}
   */
  determinePoolStatus(poolStatus) {
    if (!poolStatus.initialized) {
      return HealthStatus.DEGRADED;
    }

    const availablePercent = poolStatus.total > 0
      ? Math.round((poolStatus.available / poolStatus.total) * 100)
      : 100;

    // Check queue
    if (poolStatus.queued > poolStatus.config?.maxQueueSize * 0.8) {
      return HealthStatus.DEGRADED;
    }

    // Check available browsers
    if (availablePercent === 0 && poolStatus.inUse === poolStatus.total) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }

  /**
   * Get distributed state status
   * @param {Object} [distributedStateService] - Optional service reference
   * @returns {Promise<Object>}
   */
  async getDistributedStateStatus(distributedStateService = null) {
    if (distributedStateService?.getStatus) {
      try {
        const status = await distributedStateService.getStatus();
        return {
          ...status,
          status: status.mode === 'sync' ? HealthStatus.HEALTHY : HealthStatus.DEGRADED
        };
      } catch (error) {
        return {
          mode: 'error',
          error: error.message,
          status: HealthStatus.DEGRADED
        };
      }
    }

    return {
      mode: 'local',
      status: HealthStatus.HEALTHY
    };
  }

  /**
   * Get active connection metrics
   * @returns {Object}
   */
  getConnectionMetrics() {
    const activeConversations = Object.keys(conversations).length;
    const activeRealtimeClients = Object.keys(realtimeClients).length;

    return {
      activeConversations,
      activeRealtimeClients,
      totalConnections: activeConversations + activeRealtimeClients
    };
  }

  /**
   * Get active executions from browser agent service
   * @param {Object} [browserAgentService] - Optional service reference
   * @returns {Array}
   */
  getActiveExecutions(browserAgentService = null) {
    if (browserAgentService?.getActiveExecutions) {
      try {
        return browserAgentService.getActiveExecutions();
      } catch (error) {
        console.warn('[HealthCheck] Error getting active executions:', error.message);
      }
    }
    return [];
  }

  /**
   * Determine status based on value and thresholds
   * @param {number} value - Current value
   * @param {Object} thresholds - Warning and critical thresholds
   * @returns {string} Health status
   */
  determineStatus(value, thresholds) {
    if (value >= thresholds.critical) {
      return HealthStatus.UNHEALTHY;
    }
    if (value >= thresholds.warning) {
      return HealthStatus.DEGRADED;
    }
    return HealthStatus.HEALTHY;
  }

  /**
   * Determine overall system health status
   * @param {Object} components - Component statuses
   * @returns {string}
   */
  determineOverallStatus(components) {
    const statuses = Object.values(components)
      .filter(c => c && c.status)
      .map(c => c.status);

    if (statuses.includes(HealthStatus.UNHEALTHY)) {
      return HealthStatus.UNHEALTHY;
    }
    if (statuses.includes(HealthStatus.DEGRADED)) {
      return HealthStatus.DEGRADED;
    }
    return HealthStatus.HEALTHY;
  }

  /**
   * Get full health status
   * @param {Object} [services] - Optional service references
   * @param {Object} [services.sessionManagementService]
   * @param {Object} [services.browserAgentService]
   * @param {Object} [services.distributedStateService]
   * @returns {Promise<Object>}
   */
  async getFullStatus(services = {}) {
    this.lastCheckTime = Date.now();
    this.checkCount++;

    const memory = this.getMemoryMetrics();
    const sessions = await this.getSessionMetrics(services.sessionManagementService);
    const browserPool = this.getBrowserPoolStatus(services.browserAgentService);
    const distributedState = await this.getDistributedStateStatus(services.distributedStateService);
    const connections = this.getConnectionMetrics();
    const activeExecutions = this.getActiveExecutions(services.browserAgentService);

    const components = {
      memory,
      sessions,
      browserPool,
      distributedState
    };

    const overallStatus = this.determineOverallStatus(components);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.round((Date.now() - this.startTime) / 1000),
      uptimeFormatted: this.formatUptime(Date.now() - this.startTime),
      checkCount: this.checkCount,
      components: {
        memory,
        sessions,
        browserPool,
        distributedState
      },
      connections,
      activeExecutions: {
        count: activeExecutions.length,
        details: activeExecutions
      },
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    };
  }

  /**
   * Format uptime as human-readable string
   * @param {number} uptimeMs - Uptime in milliseconds
   * @returns {string}
   */
  formatUptime(uptimeMs) {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Quick health check (minimal computation)
   * @returns {Object}
   */
  getQuickStatus() {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    const sessionCount = Object.keys(conversations).length;
    const maxSessions = parseInt(process.env.MAX_SESSIONS || '100', 10);

    const isHealthy = heapUsedPercent < 90 && sessionCount < maxSessions;

    return {
      status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
      uptime: Math.round((Date.now() - this.startTime) / 1000),
      activeSessions: sessionCount,
      heapUsedPercent
    };
  }
}

// Export singleton instance
const healthCheckService = new HealthCheckService();
export default healthCheckService;

// Also export class for testing (HealthStatus already exported above)
export { HealthCheckService, THRESHOLDS };
