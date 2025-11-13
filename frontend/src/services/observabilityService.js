import authenticatedApiClient from '../api/authenticatedApi.js';

const observabilityService = {
  // Get system logs
  async getSystemLogs(filters = {}) {
    const response = await authenticatedApiClient.get('/api/observability/logs', {
      params: filters
    });
    return response.data?.data || response.data;
  },

  // Get system metrics
  async getSystemMetrics(timeRange = '1h') {
    const response = await authenticatedApiClient.get('/api/observability/metrics', {
      params: { timeRange }
    });
    return response.data?.data || response.data;
  },

  // Get performance metrics
  async getPerformanceMetrics(timeRange = '1h', operation = null) {
    const response = await authenticatedApiClient.get('/api/observability/performance', {
      params: { timeRange, operation }
    });
    return response.data?.data || response.data;
  },

  // Get traces
  async getTraces(filters = {}) {
    const response = await authenticatedApiClient.get('/api/observability/traces', {
      params: filters
    });
    return response.data?.data || response.data;
  },

  // Get live calls
  async getLiveCalls() {
    const response = await authenticatedApiClient.get('/api/observability/calls/live');
    return response.data?.data || response.data;
  },

  // Get call timeline
  async getCallTimeline(callSid) {
    const response = await authenticatedApiClient.get(`/api/observability/calls/${callSid}/timeline`);
    return response.data?.data || response.data;
  },

  // Get call tool traces
  async getCallToolTraces(callSid) {
    const response = await authenticatedApiClient.get(`/api/observability/calls/${callSid}/tool-traces`);
    return response.data?.data || response.data;
  },

  // Get error budgets
  async getErrorBudgets(timeRange = '24h') {
    const response = await authenticatedApiClient.get('/api/observability/error-budgets', {
      params: { timeRange }
    });
    return response.data?.data || response.data;
  },

  // Get alerts
  async getAlerts(filters = {}) {
    const response = await authenticatedApiClient.get('/api/observability/alerts', {
      params: filters
    });
    return response.data?.data || response.data;
  },

  // Create alert
  async createAlert(alertData) {
    const response = await authenticatedApiClient.post('/api/observability/alerts', alertData);
    return response.data?.data || response.data;
  },

  // Acknowledge alert
  async acknowledgeAlert(alertId) {
    const response = await authenticatedApiClient.post(`/api/observability/alerts/${alertId}/acknowledge`);
    return response.data?.data || response.data;
  },

  // Resolve alert
  async resolveAlert(alertId) {
    const response = await authenticatedApiClient.post(`/api/observability/alerts/${alertId}/resolve`);
    return response.data?.data || response.data;
  },

  // Get health
  async getHealth() {
    const response = await authenticatedApiClient.get('/api/observability/health');
    return response.data?.data || response.data;
  },

  // Export data
  async exportData(format = 'json', filters = {}) {
    const response = await authenticatedApiClient.get('/api/observability/export', {
      params: { format, ...filters },
      responseType: format === 'csv' ? 'blob' : 'json'
    });
    // For CSV, response.data is the blob directly
    // For JSON, response.data might be wrapped in { success: true, data: ... }
    if (format === 'csv') {
      return response.data;
    }
    return response.data?.data || response.data;
  }
};

export default observabilityService;