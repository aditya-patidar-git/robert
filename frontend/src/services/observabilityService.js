import { BaseService } from './baseService';

/**
 * Observability Service
 * Handles system logs, metrics, traces, alerts, and health monitoring
 * @extends BaseService
 */
class ObservabilityService extends BaseService {
  constructor() {
    super('/api/observability', {
      dataPath: 'data',
      normalizeResponse: true
    });
  }

  /**
   * Get system logs
   * @param {Object} filters - Log filters
   * @returns {Promise<Array<Object>>} Array of log entries
   */
  async getSystemLogs(filters = {}) {
    const response = await this.get('/logs', filters);
    return response.data || [];
  }

  /**
   * Get system metrics
   * @param {string} timeRange - Time range (default: '1h')
   * @returns {Promise<Object>} System metrics
   */
  async getSystemMetrics(timeRange = '1h') {
    const response = await this.get('/metrics', { timeRange });
    return response.data || {};
  }

  /**
   * Get performance metrics
   * @param {string} timeRange - Time range (default: '1h')
   * @param {string|null} operation - Optional operation filter
   * @returns {Promise<Object>} Performance metrics
   */
  async getPerformanceMetrics(timeRange = '1h', operation = null) {
    const params = { timeRange };
    if (operation) params.operation = operation;
    const response = await this.get('/performance', params);
    return response.data || {};
  }

  /**
   * Get traces
   * @param {Object} filters - Trace filters
   * @returns {Promise<Array<Object>>} Array of traces
   */
  async getTraces(filters = {}) {
    const response = await this.get('/traces', filters);
    return response.data || [];
  }

  /**
   * Get live calls
   * @returns {Promise<Array<Object>>} Array of live calls
   */
  async getLiveCalls() {
    const response = await this.get('/calls/live');
    return response.data || [];
  }

  /**
   * Get call timeline
   * @param {string} callSid - Call SID
   * @returns {Promise<Object>} Call timeline
   */
  async getCallTimeline(callSid) {
    const response = await this.get(`/calls/${callSid}/timeline`);
    return response.data || null;
  }

  /**
   * Get call tool traces
   * @param {string} callSid - Call SID
   * @returns {Promise<Array<Object>>} Array of tool traces
   */
  async getCallToolTraces(callSid) {
    const response = await this.get(`/calls/${callSid}/tool-traces`);
    return response.data || [];
  }

  /**
   * Get error budgets
   * @param {string} timeRange - Time range (default: '24h')
   * @returns {Promise<Object>} Error budgets
   */
  async getErrorBudgets(timeRange = '24h') {
    const response = await this.get('/error-budgets', { timeRange });
    return response.data || {};
  }

  /**
   * Get alerts
   * @param {Object} filters - Alert filters
   * @returns {Promise<Array<Object>>} Array of alerts
   */
  async getAlerts(filters = {}) {
    const response = await this.get('/alerts', filters);
    return response.data || [];
  }

  /**
   * Create alert
   * @param {Object} alertData - Alert data
   * @returns {Promise<Object>} Created alert
   */
  async createAlert(alertData) {
    const response = await this.post('/alerts', alertData);
    return response.data || {};
  }

  /**
   * Acknowledge alert
   * @param {string} alertId - Alert ID
   * @returns {Promise<Object>} Acknowledged alert
   */
  async acknowledgeAlert(alertId) {
    const response = await this.post(`/alerts/${alertId}/acknowledge`);
    return response.data || {};
  }

  /**
   * Resolve alert
   * @param {string} alertId - Alert ID
   * @returns {Promise<Object>} Resolved alert
   */
  async resolveAlert(alertId) {
    const response = await this.post(`/alerts/${alertId}/resolve`);
    return response.data || {};
  }

  /**
   * Get health status
   * @returns {Promise<Object>} Health status
   */
  async getHealth() {
    const response = await this.get('/health');
    return response.data || {};
  }

  /**
   * Export data
   * @param {string} format - Export format ('json' or 'csv')
   * @param {Object} filters - Export filters
   * @returns {Promise<Blob|Object>} Exported data (Blob for CSV, Object for JSON)
   */
  async exportData(format = 'json', filters = {}) {
    const response = await this.get('/export', { format, ...filters }, {
      responseType: format === 'csv' ? 'text' : 'json', // Use 'text' for CSV to get string
      normalizeResponse: false // Don't normalize, handle manually
    });
    
    // For CSV, response.data is the CSV text string
    if (format === 'csv') {
      // Backend sends CSV as text with headers, return as string
      return typeof response.data === 'string' ? response.data : response.data?.data || '';
    }
    
    // For JSON, backend returns: { success: true, data: { format, data, filename } }
    // Or directly: { format, data, filename }
    if (response.data?.success !== undefined) {
      // Response wrapped in success object
      return response.data.data || response.data;
    }
    
    // Direct response structure
    return response.data;
  }

  /**
   * Get trace statistics
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Trace statistics
   */
  async getTraceStatistics(filters = {}) {
    const response = await this.get('/traces/statistics', filters);
    return response.data || {};
  }

  /**
   * Get groundedness metrics
   * @param {Object} filters - Filter criteria (dateRange, status)
   * @returns {Promise<Object>} Groundedness metrics
   */
  async getGroundednessMetrics(filters = {}) {
    const response = await this.get('/groundedness', filters);
    return response.data || {};
  }

  /**
   * Get RAG analytics
   * @param {Object} filters - Filter criteria (dateRange)
   * @returns {Promise<Object>} RAG analytics
   */
  async getRAGAnalytics(filters = {}) {
    const response = await this.get('/rag-analytics', filters);
    return response.data || {};
  }

  /**
   * Get tool performance metrics
   * @param {string} timeRange - Time range (default: '24h')
   * @returns {Promise<Object>} Tool metrics
   */
  async getToolMetrics(timeRange = '24h') {
    const response = await this.get('/tools/metrics', { timeRange });
    return response.data || {};
  }

  /**
   * Get SIP metrics
   * @param {string} timeRange - Time range (default: '24h')
   * @returns {Promise<Object>} SIP metrics
   */
  async getSIPMetrics(timeRange = '24h') {
    const response = await this.get('/sip/metrics', { timeRange });
    return response.data || {};
  }
}

// Export singleton instance
const observabilityService = new ObservabilityService();
export default observabilityService;
