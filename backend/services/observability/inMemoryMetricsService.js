/**
 * In-Memory Metrics Service
 * Handles in-memory metric storage and retrieval
 */

class InMemoryMetricsService {
  constructor() {
    this.metrics = new Map();
    this.config = {
      enableConsole: process.env.NODE_ENV !== 'production'
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
   * Reset all metrics
   */
  resetMetrics() {
    this.metrics.clear();
    if (this.config.enableConsole) {
      console.log('🔄 METRICS RESET');
    }
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

export default new InMemoryMetricsService();

