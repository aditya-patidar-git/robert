import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

const provenanceService = {
  async trackFileUsage(data) {
    const response = await apiClient.post('/api/provenance/track', data);
    return response.data;
  },

  async getCallProvenance(callId) {
    const response = await apiClient.get(`/api/provenance/call/${callId}`);
    return response.data;
  },

  async getFileProvenance(fileId) {
    const response = await apiClient.get(`/api/provenance/file/${fileId}`);
    return response.data;
  },

  async getProvenanceAnalytics(filters = {}) {
    const response = await apiClient.get('/api/provenance/analytics', { params: filters });
    return response.data;
  },

  async getFileUsageStats(fileId) {
    const response = await apiClient.get(`/api/provenance/stats/${fileId}`);
    return response.data;
  },

  async exportProvenanceData(userId, startDate, endDate) {
    const response = await apiClient.get('/api/provenance/export', {
      params: { userId, startDate, endDate }
    });
    return response.data;
  },

  async cleanupOldRecords() {
    const response = await apiClient.post('/api/provenance/cleanup');
    return response.data;
  }
};

export default provenanceService;
