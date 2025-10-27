import authenticatedApiClient from '../api/authenticatedApi.js';

const observabilityService = {
  // Get system logs
  async getSystemLogs(filters = {}) {
    const response = await authenticatedApiClient.get('/api/observability/logs', {
      params: filters
    });
    return response.data;
  },

  // Get system metrics
  async getSystemMetrics(timeRange = '1h') {
    const response = await authenticatedApiClient.get('/api/observability/metrics', {
      params: { timeRange }
    });
    return response.data;
  }
};

export default observabilityService;