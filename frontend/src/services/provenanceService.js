import authenticatedApiClient from '../api/authenticatedApi.js';

const provenanceService = {
  async trackFileUsage(data) {
    const response = await authenticatedApiClient.post('/api/provenance/track', data);
    return response.data;
  },

  async getCallProvenance(callId) {
    const response = await authenticatedApiClient.get(`/api/provenance/call/${callId}`);
    return response.data;
  },

  async getFileProvenance(fileId) {
    const response = await authenticatedApiClient.get(`/api/provenance/file/${fileId}`);
    return response.data;
  },

  async getProvenanceAnalytics(filters = {}) {
    const response = await authenticatedApiClient.get('/api/provenance/analytics', { params: filters });
    return response.data;
  },

  async getFileUsageStats(fileId) {
    const response = await authenticatedApiClient.get(`/api/provenance/stats/${fileId}`);
    return response.data;
  },

  async exportProvenanceData(userId, startDate, endDate) {
    const response = await authenticatedApiClient.get('/api/provenance/export', {
      params: { userId, startDate, endDate }
    });
    return response.data;
  },

  async cleanupOldRecords() {
    const response = await authenticatedApiClient.post('/api/provenance/cleanup');
    return response.data;
  }
};

export default provenanceService;





