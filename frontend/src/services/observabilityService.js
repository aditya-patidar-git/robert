import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const observabilityService = {
  // Get system logs
  async getSystemLogs(filters = {}) {
    const response = await apiClient.get('/api/observability/logs', {
      params: filters
    });
    return response.data;
  },

  // Get system metrics
  async getSystemMetrics(timeRange = '1h') {
    const response = await apiClient.get('/api/observability/metrics', {
      params: { timeRange }
    });
    return response.data;
  }
};

export default observabilityService;